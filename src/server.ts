import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

import {
  createStore,
  type RuntimeEventAction,
  type RuntimeEventOutcome,
  type RuntimeInstance
} from "./store.js";
import { type VerifiedAuthToken } from "./auth.js";
import {
  buildFailurePayload,
  classifyFailureClass,
  failureHintForClass,
  formatFailureForJob
} from "./errors.js";
import {
  resolveLocalAuthContext
} from "./local-auth.js";
import { registerAuthRoutes } from "./http/routes/auth.routes.js";
import { registerRuntimeRoutes } from "./http/routes/runtime.routes.js";
import { registerSettingsConfigRoutes } from "./http/routes/settings-config.routes.js";
import { registerTenantAgentRoutes } from "./http/routes/tenants-agents.routes.js";
import {
  createRuntimeReconcileService
} from "./runtime-reconcile.js";
import { createRuntimeProvisionService } from "./runtime-provision.js";
import {
  getOptionalTrimmedString,
  parseBooleanEnv,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parseRuntimeInstanceParams
} from "./parsers.js";
import { runtimeOps as defaultRuntimeOps, type RuntimeOps } from "./runtime.js";
import {
  createLocalRuntimeProvider,
  type RuntimeProvider
} from "./runtime-provider.js";
import {
  ALL_RUNTIME_TYPES,
  buildRuntimeCatalog,
  DEFAULT_OPENCLAW_RUNTIME_IMAGE,
  DEFAULT_ZEROCLAW_RUNTIME_IMAGE,
  getRuntimeDescriptor,
  resolveDefaultRuntimeType,
  resolveSupportedRuntimeTypes,
  resolveRuntimeImageForType
} from "./runtime-kind.js";
import type { RuntimeType } from "./store.js";
import { getEnvValue, loadEnvFileIfPresent } from "./ops-env.js";
import {
  resolveRuntimeSharedWorkspaceMount,
  resolveRuntimeWorkspaceProfile
} from "./runtime-workspace-profile.js";

loadEnvFileIfPresent();

type PublicRuntimeInstance = Omit<
  RuntimeInstance,
  | "bearerToken"
  | "llmApiKey"
  | "telegramBotToken"
  | "slackBotToken"
  | "slackAppToken"
  | "discordBotToken"
  | "runtimeSecrets"
> & {
  hasToken: boolean;
  hasLlmApiKey: boolean;
  hasTelegramBotToken: boolean;
  hasSlackBotToken: boolean;
  hasSlackAppToken: boolean;
  hasDiscordBotToken: boolean;
  hasRuntimeSecrets: boolean;
};

type AppConfig = {
  host: string;
  port: number;
  managedEnvFilePath: string;
  corsAllowedOrigins: string[];
  secretsKey: string;
  stateFilePath: string;
  runtimeImage: string;
  runtimeOpenclawImage: string;
  supportedRuntimeTypes: RuntimeType[];
  defaultRuntimeType: RuntimeType;
  runtimeCatalog: ReturnType<typeof buildRuntimeCatalog>;
  runtimeNetwork: string;
  runtimeGatewayPort: number;
  runtimeProvider: string;
  runtimeModel: string;
  runtimeTelegramModelOverride?: string;
  runtimeApiKey: string;
  runtimeRequirePairing: boolean;
  runtimeAllowPublicBind: boolean;
  runtimeHttpTimeoutMs: number;
  runtimeProvisioningStaleMs: number;
  runtimeReconcileIntervalMs: number;
  runtimeEventsMaxEntries: number;
  runtimeEventsMaxAgeDays: number;
  runtimeStartupValidation: "strict" | "warn" | "off";
  localAuthSub: string;
  localAuthOrgId: string;
  localAuthAllowHeaderOverrides: boolean;
};

type BuildAppOptions = {
  config?: Partial<AppConfig>;
  runtimeOps?: RuntimeOps;
  runtimeProvider?: RuntimeProvider;
  logger?: boolean;
  publicRoot?: string;
};

type RequestWithAuth = FastifyRequest & {
  authContext?: VerifiedAuthToken;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const config = resolveConfig(options.config);
  const runtimeOps = options.runtimeOps ?? defaultRuntimeOps;
  const runtimeProvider = options.runtimeProvider ?? createLocalRuntimeProvider(runtimeOps);
  const publicRoot = resolvePublicRoot(options.publicRoot);
  const store = createStore({
    stateFilePath: config.stateFilePath,
    secretsKey: config.secretsKey,
    runtimeEventsMaxEntries: config.runtimeEventsMaxEntries,
    runtimeEventsMaxAgeDays: config.runtimeEventsMaxAgeDays
  });

  const app = Fastify({
    logger: options.logger ?? true,
    requestIdHeader: "x-atoll-request-id",
    requestIdLogLabel: "requestId"
  });
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, config.corsAllowedOrigins.includes(origin));
    }
  });

  const provisionService = createRuntimeProvisionService({
    listProvisionJobs: () => store.listProvisionJobs(),
    getProvisionJob: (jobId) => store.getProvisionJob(jobId),
    saveProvisionJob: (job) => store.saveProvisionJob(job),
    listRuntimeInstances: () => store.listRuntimeInstances(),
    formatJobError: formatFailureForJob
  });

  const reconcileService = createRuntimeReconcileService({
    runtimeProvider,
    runtimeNetwork: config.runtimeNetwork,
    resolveRuntimeImage: (instance) =>
      resolveRuntimeImageForType({
        runtimeType: instance.runtimeType,
        zeroclawImage: config.runtimeImage,
        openclawImage: config.runtimeOpenclawImage
      }),
    runtimeProvisioningStaleMs: config.runtimeProvisioningStaleMs,
    runtimeReconcileIntervalMs: config.runtimeReconcileIntervalMs,
    listRuntimeInstances: () => store.listRuntimeInstances(),
    getProvisionJob: (jobId) => provisionService.getJob(jobId),
    updateProvisionJob: (jobId, patch) => provisionService.updateJob(jobId, patch),
    updateInstance: (instanceId, patch) => updateInstanceOrThrow(instanceId, patch),
    logger: app.log
  });

  if (publicRoot) {
    await app.register(staticPlugin, {
      root: publicRoot,
      prefix: "/"
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (path.startsWith("/api/")) {
      return reply.status(404).send({
        message: `Route ${path} not found`
      });
    }

    if (publicRoot && !hasFileExtension(path)) {
      return reply.type("text/html").sendFile("index.html");
    }

    if (!path.startsWith("/api/") && !hasFileExtension(path)) {
      return reply.status(503).send({
        message: "Frontend build missing. Run npm run build or use npm run dev."
      });
    }

    return reply.status(404).send({
      message: `Route ${path} not found`
    });
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-atoll-request-id", request.id);

    const path = request.url.split("?")[0] ?? request.url;
    if (!path.startsWith("/api/")) {
      return;
    }

    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        path
      },
      "API request started"
    );

    if (path === "/api/healthz") {
      return;
    }

    const authResolution = resolveLocalAuthContext(request.headers, config, {
      allowHeaderOverrides: config.localAuthAllowHeaderOverrides
    });
    if (!authResolution.ok) {
      return reply.status(400).send({
        message: authResolution.message
      });
    }
    const authContext = authResolution.auth;

    if (!authContext.orgId) {
      return reply.status(403).send({
        message: "Forbidden: local auth is missing orgId"
      });
    }

    (request as RequestWithAuth).authContext = authContext;
  });

  app.addHook("onResponse", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (!path.startsWith("/api/")) {
      return;
    }
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        path,
        statusCode: reply.statusCode
      },
      "API request completed"
    );
  });

  registerAuthRoutes(app, {
    config,
    getAuthContextOrThrow,
    resolveRuntimeProcessMode
  });

  registerSettingsConfigRoutes(app, {
    envFilePath: config.managedEnvFilePath,
    getAuthContextOrThrow
  });

  registerTenantAgentRoutes(app, {
    store,
    getAuthContextOrThrow
  });

  registerRuntimeRoutes(app, {
    store,
    config,
    runtimeProvider,
    getAuthContextOrThrow,
    appendRuntimeEvent,
    appendRuntimeChatMessage: (input) =>
      store.appendRuntimeChatMessage({
        instanceId: input.instanceId,
        role: input.role,
        content: input.content,
        requestId: input.requestId,
        metadata: input.metadata
      }),
    listRuntimeChatMessages: (input) =>
      store.listRuntimeChatMessages({
        instanceId: input.instanceId,
        limit: input.limit
      }),
    toPublicRuntimeInstance,
    resolveRuntimeCreationInput,
    createProvisioningRuntimeRecord,
    runProvisionWork,
    resolveRuntimeInstanceOrReply,
    updateInstanceOrThrow,
    applyRuntimeConfigForInstance,
    parseJsonObject,
    provisionService,
    reconcileService
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error instanceof Error && error.message.startsWith("Validation failed:")) {
      const failureClass = classifyFailureClass(error.message);
      return reply.status(400).send({
        message: error.message,
        failureClass,
        failureHint: failureHintForClass(failureClass)
      });
    }

    return reply.status(500).send(buildFailurePayload(error, "Internal server error"));
  });

  app.addHook("onClose", async () => {
    reconcileService.stopLoop();
  });

  await recoverManagedRuntimeContainersOnStartup();
  provisionService.requeueProvisioningInstancesOnStartup(runProvisionWork);
  reconcileService.startLoop();

  return app;

  async function recoverManagedRuntimeContainersOnStartup(): Promise<void> {
    const discoverContainers = runtimeProvider.listManagedRuntimeContainers;
    if (!discoverContainers) {
      return;
    }

    let managedContainers;
    try {
      managedContainers = await discoverContainers();
    } catch (error) {
      app.log.warn(
        { error: buildFailurePayload(error, "Failed to discover managed runtime containers").message },
        "Skipping runtime container recovery on startup"
      );
      return;
    }

    const runningContainers = managedContainers.filter(
      (container) => container.running && container.name.startsWith("atoll-rt-")
    );
    if (runningContainers.length === 0) {
      return;
    }

    const existingByContainer = new Map(
      store.listRuntimeInstances().map((instance) => [instance.containerName, instance])
    );
    let adoptedCount = 0;
    let relinkedCount = 0;
    let enrichedCount = 0;
    let skippedCount = 0;

    for (const container of runningContainers) {
      const existing = existingByContainer.get(container.name);
      if (existing) {
        if (existing.status !== "running" || existing.lastError) {
          updateInstanceOrThrow(existing.id, {
            status: "running",
            lastError: undefined
          });
          relinkedCount += 1;
        }
        if (await enrichRecoveredAgentMetadata({
          agentId: existing.agentId,
          runtimeType: existing.runtimeType,
          volumeName: existing.volumeName,
          container
        })) {
          enrichedCount += 1;
        }
        continue;
      }

      const recoveryInput = resolveRecoveredRuntimeInput(container);
      if (!recoveryInput) {
        skippedCount += 1;
        continue;
      }

      const identity = await resolveRecoveredIdentityProfile({
        runtimeType: recoveryInput.runtimeType,
        volumeName: recoveryInput.volumeName
      });
      const tenant = resolveRecoveryTenant(container, identity);
      const agent = resolveRecoveryAgent(container, tenant.id, identity);
      const recovered = store.createRuntimeInstance({
        tenantId: tenant.id,
        agentId: agent.id,
        runtimeType: recoveryInput.runtimeType,
        containerName: container.name,
        volumeName: recoveryInput.volumeName,
        networkName: recoveryInput.networkName,
        baseUrl: recoveryInput.baseUrl,
        gatewayPort: recoveryInput.gatewayPort,
        requirePairing: recoveryInput.requirePairing,
        allowPublicBind: recoveryInput.allowPublicBind,
        llmProvider: config.runtimeProvider,
        llmModel: config.runtimeModel,
        llmApiKey: config.runtimeApiKey,
        telegramEnabled: false,
        telegramAllowFrom: []
      });

      updateInstanceOrThrow(recovered.id, {
        status: "running",
        lastError: undefined
      });
      appendRuntimeEvent({
        tenantId: recovered.tenantId,
        agentId: recovered.agentId,
        instanceId: recovered.id,
        action: "reconcile",
        outcome: "succeeded",
        message: "Recovered running runtime container on startup.",
        metadata: {
          source: "startup-recovery",
          containerId: container.id,
          containerName: container.name,
          runtimeType: recoveryInput.runtimeType
        }
      });
      adoptedCount += 1;
    }

    if (adoptedCount > 0 || relinkedCount > 0 || skippedCount > 0) {
      app.log.info(
        {
          discovered: runningContainers.length,
          adopted: adoptedCount,
          relinked: relinkedCount,
          enriched: enrichedCount,
          skipped: skippedCount
        },
        "Runtime startup recovery completed"
      );
    }
  }

  function resolveRecoveryTenant(
    container: {
      labels: Record<string, string>;
    },
    identity?: {
      workspaceName?: string;
    }
  ) {
    const labeledTenantId = container.labels["atoll.tenantId"]?.trim();
    if (labeledTenantId) {
      const tenant = store.getTenant(labeledTenantId);
      if (tenant) {
        return tenant;
      }
    }

    const orgId = container.labels["atoll.orgId"]?.trim() || config.localAuthOrgId;
    const identityWorkspaceName = identity?.workspaceName?.trim();
    if (identityWorkspaceName) {
      const existingByName = store
        .listTenants(orgId)
        .find((tenant) => tenant.name.trim().toLowerCase() === identityWorkspaceName.toLowerCase());
      if (existingByName) {
        return existingByName;
      }
    }
    return store.ensureDefaultTenant(orgId);
  }

  function resolveRecoveryAgent(
    container: {
      name: string;
      labels: Record<string, string>;
    },
    tenantId: string,
    identity?: {
      helperName?: string;
      roleTitle?: string;
    }
  ) {
    const labeledAgentId = container.labels["atoll.agentId"]?.trim();
    if (labeledAgentId) {
      const existing = store.getAgent(labeledAgentId);
      if (existing && existing.tenantId === tenantId && !store.getRuntimeInstanceForAgent(existing.id)) {
        return existing;
      }
    }

    const suggestedName =
      container.labels["atoll.helperName"]?.trim() ||
      identity?.helperName?.trim() ||
      `Recovered ${container.name.replace(/^atoll-rt-/u, "")}`;
    const roleTitle = identity?.roleTitle?.trim() || "Recovered runtime container";
    return store.createAgent({
      tenantId,
      name: suggestedName.slice(0, 80) || "Recovered runtime helper",
      roleTitle: roleTitle.slice(0, 120),
      channel: "custom"
    });
  }

  async function enrichRecoveredAgentMetadata(input: {
    agentId: string;
    runtimeType: RuntimeType;
    volumeName: string;
    container: {
      labels: Record<string, string>;
      name: string;
    };
  }): Promise<boolean> {
    const agent = store.getAgent(input.agentId);
    if (!agent) {
      return false;
    }

    const labeledName = input.container.labels["atoll.helperName"]?.trim();
    const shouldTryIdentity = !labeledName && (isRecoveredPlaceholderName(agent.name) || !agent.roleTitle);
    if (!shouldTryIdentity) {
      return false;
    }

    const identity = await resolveRecoveredIdentityProfile({
      runtimeType: input.runtimeType,
      volumeName: input.volumeName
    });
    if (!identity) {
      return false;
    }

    const namePatch = identity.helperName?.trim();
    const rolePatch = identity.roleTitle?.trim();
    const patch: { name?: string; roleTitle?: string } = {};
    if (namePatch && isRecoveredPlaceholderName(agent.name)) {
      patch.name = namePatch.slice(0, 80);
    }
    if (rolePatch && !agent.roleTitle) {
      patch.roleTitle = rolePatch.slice(0, 120);
    }

    if (Object.keys(patch).length === 0) {
      return false;
    }

    store.updateAgent(agent.id, patch);
    return true;
  }

  function isRecoveredPlaceholderName(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized.startsWith("recovered ");
  }

  async function resolveRecoveredIdentityProfile(input: {
    runtimeType: RuntimeType;
    volumeName: string;
  }): Promise<
    | {
        helperName?: string;
        workspaceName?: string;
        roleTitle?: string;
      }
    | undefined
  > {
    const readRuntimeIdentity = runtimeProvider.readRuntimeIdentity;
    if (!readRuntimeIdentity) {
      return undefined;
    }
    try {
      return await readRuntimeIdentity({
        runtimeType: input.runtimeType,
        volumeName: input.volumeName
      });
    } catch (error) {
      app.log.debug(
        {
          error: buildFailurePayload(error, "Failed to read runtime identity").message,
          runtimeType: input.runtimeType,
          volumeName: input.volumeName
        },
        "Skipped runtime identity metadata recovery"
      );
      return undefined;
    }
  }

  function resolveRecoveredRuntimeInput(container: {
    name: string;
    image: string;
    labels: Record<string, string>;
    mounts: Array<{ type: string; name?: string; destination: string }>;
    networkNames: string[];
    hostPorts: number[];
    exposedPorts: number[];
  }):
    | {
        runtimeType: RuntimeType;
        volumeName: string;
        networkName: string;
        gatewayPort: number;
        allowPublicBind: boolean;
        requirePairing: boolean;
        baseUrl?: string;
      }
    | undefined {
    const runtimeType = resolveRecoveredRuntimeType(container);
    if (!runtimeType) {
      return undefined;
    }

    const descriptor = getRuntimeDescriptor(runtimeType);
    const labeledVolumeName = container.labels["atoll.volumeName"]?.trim();
    const mountedVolumeName =
      container.mounts.find(
        (mount) => mount.type === "volume" && mount.destination === descriptor.mountPath
      )?.name ??
      container.mounts.find((mount) => mount.type === "volume")?.name;
    const volumeName = labeledVolumeName || mountedVolumeName;
    if (!volumeName) {
      return undefined;
    }

    const networkName =
      container.labels["atoll.networkName"]?.trim() ||
      container.networkNames.find((name) => Boolean(name && name.trim())) ||
      config.runtimeNetwork;
    const allowPublicBind = container.hostPorts.length > 0;
    const gatewayPort = resolveRecoveredGatewayPort(container, runtimeType);
    const runtimeCatalogItem = config.runtimeCatalog.find((item) => item.id === runtimeType);
    const requirePairing = runtimeCatalogItem?.defaultRequirePairing ?? config.runtimeRequirePairing;
    const baseUrl =
      runtimeCatalogItem?.healthMode === "http"
        ? allowPublicBind
          ? `http://127.0.0.1:${gatewayPort}`
          : `http://${container.name}:${gatewayPort}`
        : undefined;

    return {
      runtimeType,
      volumeName,
      networkName,
      gatewayPort,
      allowPublicBind,
      requirePairing,
      baseUrl
    };
  }

  function resolveRecoveredRuntimeType(container: {
    image: string;
    labels: Record<string, string>;
    mounts: Array<{ destination: string }>;
  }): RuntimeType | undefined {
    const labeledRuntimeType = container.labels["atoll.runtimeType"]?.trim();
    if (labeledRuntimeType && config.supportedRuntimeTypes.includes(labeledRuntimeType as RuntimeType)) {
      return labeledRuntimeType as RuntimeType;
    }

    const byImage = config.supportedRuntimeTypes.find((runtimeType) => {
      const expectedImage = resolveRuntimeImageForType({
        runtimeType,
        zeroclawImage: config.runtimeImage,
        openclawImage: config.runtimeOpenclawImage
      });
      return normalizeImageRef(container.image) === normalizeImageRef(expectedImage);
    });
    if (byImage) {
      return byImage;
    }

    const mountDestinations = new Set(container.mounts.map((mount) => mount.destination));
    for (const runtimeType of config.supportedRuntimeTypes) {
      const descriptor = getRuntimeDescriptor(runtimeType);
      if (mountDestinations.has(descriptor.mountPath)) {
        return runtimeType;
      }
    }

    return undefined;
  }

  function resolveRecoveredGatewayPort(
    container: { labels: Record<string, string>; hostPorts: number[]; exposedPorts: number[] },
    runtimeType: RuntimeType
  ): number {
    const labeledPort = Number.parseInt(container.labels["atoll.gatewayPort"] || "", 10);
    if (Number.isFinite(labeledPort) && labeledPort > 0) {
      return labeledPort;
    }

    const hostPort = container.hostPorts.find((port) => Number.isFinite(port) && port > 0);
    if (hostPort) {
      return hostPort;
    }

    const exposedPort = container.exposedPorts.find((port) => Number.isFinite(port) && port > 0);
    if (exposedPort) {
      return exposedPort;
    }

    return (
      config.runtimeCatalog.find((item) => item.id === runtimeType)?.defaultGatewayPort ||
      config.runtimeGatewayPort
    );
  }

  function normalizeImageRef(value: string): string {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return "";
    }
    const noDigest = trimmed.split("@", 1)[0] || "";
    const lastSlash = noDigest.lastIndexOf("/");
    const lastColon = noDigest.lastIndexOf(":");
    if (lastColon > lastSlash) {
      return noDigest.slice(0, lastColon);
    }
    return noDigest;
  }

  function resolveRuntimeCreationInput(input: {
    tenantId: string;
    agentId: string;
    identityOrgId: string;
  }):
    | { ok: true; tenant: { id: string }; agent: { id: string; tenantId: string } }
    | { ok: false; statusCode: number; message: string } {
    const tenant = store.getTenant(input.tenantId);
    if (!tenant || tenant.identityOrgId !== input.identityOrgId) {
      return {
        ok: false,
        statusCode: 404,
        message: `Tenant ${input.tenantId} not found`
      };
    }

    const agent = store.getAgent(input.agentId);
    if (!agent) {
      return {
        ok: false,
        statusCode: 404,
        message: `Agent ${input.agentId} not found`
      };
    }

    if (agent.tenantId !== tenant.id) {
      return {
        ok: false,
        statusCode: 400,
        message: "Agent does not belong to tenant"
      };
    }

    if (store.getRuntimeInstanceForAgent(agent.id)) {
      return {
        ok: false,
        statusCode: 409,
        message: `Agent ${agent.id} already has a runtime instance`
      };
    }

    return {
      ok: true,
      tenant,
      agent
    };
  }

  async function createProvisioningRuntimeRecord(input: {
    tenantId: string;
    agentId: string;
    runtimeType: RuntimeInstance["runtimeType"];
    llmProvider: string;
    llmModel: string;
    llmApiKey: string;
    gatewayPort: number;
    requirePairing: boolean;
    allowPublicBind: boolean;
      telegramEnabled: boolean;
      telegramBotToken?: string;
      telegramAllowFrom: string[];
      telegramReplyInPrivate: boolean;
      slackEnabled: boolean;
      slackBotToken?: string;
      slackAppToken?: string;
      slackAllowedChannelIds: string[];
      slackAllowedUserIds: string[];
      slackReplyInThread: boolean;
      discordEnabled: boolean;
      discordBotToken?: string;
      discordAllowedGuildIds: string[];
      discordAllowedChannelIds: string[];
      discordReplyInThread: boolean;
      discordRequireMention: boolean;
    dailyMessageLimit?: number;
    dailyTokenLimit?: number;
    monthlySpendLimitUsd?: number;
    runtimeOptions: Record<string, unknown>;
    runtimeSecrets?: Record<string, string>;
  }): Promise<RuntimeInstance> {
    const tenant = store.getTenant(input.tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${input.tenantId} not found`);
    }
    const gatewayPort = await resolveProvisionGatewayPort({
      requestedGatewayPort: input.gatewayPort,
      allowPublicBind: input.allowPublicBind
    });
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const containerName = `atoll-rt-${suffix}`;
    const volumeName = `atoll_rt_${suffix}`;
    const networkName =
      tenant.resourceMode === "shared" && tenant.sharedNetworkName
        ? tenant.sharedNetworkName
        : config.runtimeNetwork;
    const runtimeCatalogItem = config.runtimeCatalog.find((item) => item.id === input.runtimeType);
    const baseUrl = runtimeCatalogItem?.healthMode === "http"
      ? input.allowPublicBind
        ? `http://127.0.0.1:${gatewayPort}`
        : `http://${containerName}:${gatewayPort}`
      : undefined;

    const created = store.createRuntimeInstance({
      tenantId: input.tenantId,
      agentId: input.agentId,
      runtimeType: input.runtimeType,
      containerName,
      volumeName,
      networkName,
      baseUrl,
      gatewayPort,
      requirePairing: input.requirePairing,
      allowPublicBind: input.allowPublicBind,
      llmProvider: input.llmProvider,
      llmModel: input.llmModel,
      llmApiKey: input.llmApiKey,
      telegramEnabled: input.telegramEnabled,
      telegramBotToken: input.telegramBotToken,
      telegramAllowFrom: input.telegramAllowFrom,
      telegramReplyInPrivate: input.telegramReplyInPrivate,
      slackEnabled: input.slackEnabled,
      slackBotToken: input.slackBotToken,
      slackAppToken: input.slackAppToken,
      slackAllowedChannelIds: input.slackAllowedChannelIds,
      slackAllowedUserIds: input.slackAllowedUserIds,
      slackReplyInThread: input.slackReplyInThread,
      discordEnabled: input.discordEnabled,
      discordBotToken: input.discordBotToken,
      discordAllowedGuildIds: input.discordAllowedGuildIds,
      discordAllowedChannelIds: input.discordAllowedChannelIds,
      discordReplyInThread: input.discordReplyInThread,
      discordRequireMention: input.discordRequireMention,
      dailyMessageLimit: input.dailyMessageLimit,
      dailyTokenLimit: input.dailyTokenLimit,
      monthlySpendLimitUsd: input.monthlySpendLimitUsd,
      runtimeOptions: input.runtimeOptions,
      runtimeSecrets: input.runtimeSecrets
    });

    return ensureRuntimeBearerToken(created);
  }

  async function resolveProvisionGatewayPort(input: {
    requestedGatewayPort: number;
    allowPublicBind: boolean;
  }): Promise<number> {
    const preferred = Math.max(1, Math.floor(input.requestedGatewayPort || config.runtimeGatewayPort));
    if (!input.allowPublicBind) {
      return preferred;
    }

    const usedPorts = new Set(
      store
        .listRuntimeInstances()
        .filter((instance) => instance.allowPublicBind)
        .map((instance) => instance.gatewayPort)
        .filter((value) => Number.isFinite(value) && value > 0)
    );
    if (!usedPorts.has(preferred)) {
      return preferred;
    }

    const maxAttempts = 1000;
    for (let offset = 1; offset <= maxAttempts; offset += 1) {
      const candidate = preferred + offset;
      if (!usedPorts.has(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      `Unable to allocate runtime gateway port. Tried ${preferred}-${preferred + maxAttempts}.`
    );
  }

  async function runProvisionWork(instanceId: string): Promise<RuntimeInstance> {
    const initialRuntimeInstance = store.getRuntimeInstance(instanceId);
    if (!initialRuntimeInstance) {
      throw new Error(`Runtime instance ${instanceId} not found`);
    }
    let runtimeInstance = ensureRuntimeBearerToken(initialRuntimeInstance);
    const tenant = store.getTenant(runtimeInstance.tenantId);
    const workspaceProfile = resolveRuntimeWorkspaceProfile(store, runtimeInstance);
    const sharedWorkspaceMount = resolveRuntimeSharedWorkspaceMount(tenant);
    const provisionJob = provisionService.getJob(instanceId);
    const provisionRequestId = provisionJob?.requestId;

    try {
      const maxPortRetryAttempts = runtimeInstance.allowPublicBind ? 20 : 0;
      for (let attempt = 0; ; attempt += 1) {
        try {
          await runtimeProvider.provisionRuntimeContainer({
            runtimeType: runtimeInstance.runtimeType,
            containerName: runtimeInstance.containerName,
            volumeName: runtimeInstance.volumeName,
            networkName: runtimeInstance.networkName,
            instanceId: runtimeInstance.id,
            tenantId: runtimeInstance.tenantId,
            agentId: runtimeInstance.agentId,
            identityOrgId: tenant?.identityOrgId,
            createNetworkIfMissing: true,
            sharedWorkspaceMount,
            llm: {
              provider: runtimeInstance.llmProvider,
              model: runtimeInstance.llmModel,
              apiKey: runtimeInstance.llmApiKey ?? ""
            },
            telegram: {
              enabled: runtimeInstance.telegramEnabled,
              botToken: runtimeInstance.telegramBotToken,
              allowFrom: runtimeInstance.telegramAllowFrom,
              replyInPrivate: runtimeInstance.telegramReplyInPrivate
            },
            slack: {
              enabled: runtimeInstance.slackEnabled,
              botToken: runtimeInstance.slackBotToken,
              appToken: runtimeInstance.slackAppToken,
              allowedChannelIds: runtimeInstance.slackAllowedChannelIds,
              allowedUserIds: runtimeInstance.slackAllowedUserIds,
              replyInThread: runtimeInstance.slackReplyInThread
            },
            discord: {
              enabled: runtimeInstance.discordEnabled,
              botToken: runtimeInstance.discordBotToken,
              allowedGuildIds: runtimeInstance.discordAllowedGuildIds,
              allowedChannelIds: runtimeInstance.discordAllowedChannelIds,
              replyInThread: runtimeInstance.discordReplyInThread,
              requireMention: runtimeInstance.discordRequireMention
            },
            workspaceProfile,
            image: resolveRuntimeImageForType({
              runtimeType: runtimeInstance.runtimeType,
              zeroclawImage: config.runtimeImage,
              openclawImage: config.runtimeOpenclawImage
            }),
            gatewayPort: runtimeInstance.gatewayPort,
            requirePairing: runtimeInstance.requirePairing,
            allowPublicBind: runtimeInstance.allowPublicBind,
            bearerToken: runtimeInstance.bearerToken,
            runtimeOptions: runtimeInstance.runtimeOptions,
            runtimeSecrets: runtimeInstance.runtimeSecrets
          });
          break;
        } catch (error) {
          const canRetryPort =
            runtimeInstance.allowPublicBind &&
            attempt < maxPortRetryAttempts &&
            isGatewayPortAllocationFailure(error);
          if (!canRetryPort) {
            throw error;
          }

          const previousGatewayPort = runtimeInstance.gatewayPort;
          const nextGatewayPort = await resolveProvisionGatewayPort({
            requestedGatewayPort: previousGatewayPort + 1,
            allowPublicBind: true
          });
          const runtimeCatalogItem = config.runtimeCatalog.find(
            (item) => item.id === runtimeInstance.runtimeType
          );
          runtimeInstance = updateInstanceOrThrow(instanceId, {
            gatewayPort: nextGatewayPort,
            baseUrl:
              runtimeCatalogItem?.healthMode === "http"
                ? `http://127.0.0.1:${nextGatewayPort}`
                : undefined
          });
          appendRuntimeEvent({
            requestId: provisionRequestId,
            tenantId: runtimeInstance.tenantId,
            agentId: runtimeInstance.agentId,
            instanceId,
            action: "provision_started",
            outcome: "started",
            message: `Gateway port ${previousGatewayPort} busy. Retrying with ${nextGatewayPort}.`,
            metadata: {
              attempt: attempt + 1,
              previousGatewayPort,
              nextGatewayPort
            }
          });
        }
      }

      const updated = updateInstanceOrThrow(instanceId, {
        status: "running",
        lastError: undefined
      });
      if (provisionRequestId) {
        store.updateRuntimeProvisionRequest(provisionRequestId, {
          status: "succeeded",
          instanceId,
          jobId: provisionJob?.id,
          error: undefined
        });
      }
      appendRuntimeEvent({
        requestId: provisionRequestId,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId,
        action: "provision_succeeded",
        outcome: "succeeded",
        message: "Runtime provisioning completed successfully.",
        metadata: {
          jobId: provisionJob?.id
        }
      });
      return updated;
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to provision runtime instance");

      await runtimeProvider
        .destroyRuntimeContainer({
          containerName: runtimeInstance.containerName,
          volumeName: runtimeInstance.volumeName,
          destroyVolume: true
        })
        .catch(() => undefined);

      updateInstanceOrThrow(instanceId, {
        status: "error",
        lastError: failure.message
      });
      if (provisionRequestId) {
        store.updateRuntimeProvisionRequest(provisionRequestId, {
          status: "failed",
          instanceId,
          jobId: provisionJob?.id,
          error: failure.message
        });
      }
      appendRuntimeEvent({
        requestId: provisionRequestId,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId,
        action: "provision_failed",
        outcome: "failed",
        message: failure.message,
        metadata: {
          jobId: provisionJob?.id,
          failureClass: failure.failureClass
        }
      });

      throw error;
    }
  }

  async function applyRuntimeConfigForInstance(runtimeInstance: RuntimeInstance): Promise<RuntimeInstance> {
    const configuredRuntimeInstance = ensureRuntimeBearerToken(runtimeInstance);
    const workspaceProfile = resolveRuntimeWorkspaceProfile(store, configuredRuntimeInstance);
    await runtimeProvider.writeRuntimeConfig({
      runtimeType: configuredRuntimeInstance.runtimeType,
      volumeName: configuredRuntimeInstance.volumeName,
      llm: {
        provider: configuredRuntimeInstance.llmProvider,
        model: configuredRuntimeInstance.llmModel,
        apiKey: configuredRuntimeInstance.llmApiKey ?? ""
      },
      telegram: {
        enabled: configuredRuntimeInstance.telegramEnabled,
        botToken: configuredRuntimeInstance.telegramBotToken,
        allowFrom: configuredRuntimeInstance.telegramAllowFrom,
        replyInPrivate: configuredRuntimeInstance.telegramReplyInPrivate
      },
      slack: {
        enabled: configuredRuntimeInstance.slackEnabled,
        botToken: configuredRuntimeInstance.slackBotToken,
        appToken: configuredRuntimeInstance.slackAppToken,
        allowedChannelIds: configuredRuntimeInstance.slackAllowedChannelIds,
        allowedUserIds: configuredRuntimeInstance.slackAllowedUserIds,
        replyInThread: configuredRuntimeInstance.slackReplyInThread
      },
      discord: {
        enabled: configuredRuntimeInstance.discordEnabled,
        botToken: configuredRuntimeInstance.discordBotToken,
        allowedGuildIds: configuredRuntimeInstance.discordAllowedGuildIds,
        allowedChannelIds: configuredRuntimeInstance.discordAllowedChannelIds,
        replyInThread: configuredRuntimeInstance.discordReplyInThread,
        requireMention: configuredRuntimeInstance.discordRequireMention
      },
      workspaceProfile,
      gatewayPort: configuredRuntimeInstance.gatewayPort,
      requirePairing: configuredRuntimeInstance.requirePairing,
      allowPublicBind: configuredRuntimeInstance.allowPublicBind,
      bearerToken: configuredRuntimeInstance.bearerToken,
      runtimeOptions: configuredRuntimeInstance.runtimeOptions,
      runtimeSecrets: configuredRuntimeInstance.runtimeSecrets
    });

    const shouldRestart =
      configuredRuntimeInstance.status !== "stopped" && configuredRuntimeInstance.status !== "provisioning";
    if (shouldRestart) {
      await runtimeProvider.restartRuntimeContainer(configuredRuntimeInstance.containerName);
      return updateInstanceOrThrow(configuredRuntimeInstance.id, {
        status: "running",
        lastError: undefined
      });
    }

    return updateInstanceOrThrow(configuredRuntimeInstance.id, {
      lastError: undefined
    });
  }

  function ensureRuntimeBearerToken(runtimeInstance: RuntimeInstance): RuntimeInstance {
    if (
      runtimeInstance.runtimeType !== "openclaw" &&
      runtimeInstance.runtimeType !== "zeroclaw"
    ) {
      return runtimeInstance;
    }
    if (runtimeInstance.requirePairing) {
      return runtimeInstance;
    }
    if (runtimeInstance.bearerToken?.trim()) {
      return runtimeInstance;
    }

    return updateInstanceOrThrow(runtimeInstance.id, {
      bearerToken: randomBytes(24).toString("hex")
    });
  }

  function resolveRuntimeInstanceOrReply(
    request: FastifyRequest,
    paramsPayload: unknown,
    reply: FastifyReply
  ): RuntimeInstance | undefined {
    const auth = getAuthContextOrThrow(request);
    const params = parseRuntimeInstanceParams(paramsPayload);
    const runtimeInstance = store.getRuntimeInstance(params.instanceId);

    if (!runtimeInstance) {
      void reply.status(404).send({
        message: `Runtime instance ${params.instanceId} not found`
      });
      return undefined;
    }
    const tenant = store.getTenant(runtimeInstance.tenantId);
    if (!tenant || tenant.identityOrgId !== auth.orgId) {
      void reply.status(404).send({
        message: `Runtime instance ${params.instanceId} not found`
      });
      return undefined;
    }

    return runtimeInstance;
  }

  function getAuthContextOrThrow(request: FastifyRequest): {
    sub: string;
    orgId: string;
  } {
    const auth = (request as RequestWithAuth).authContext;
    if (!auth || !auth.orgId) {
      throw new Error("Unauthorized request context is missing identity");
    }
    return {
      sub: auth.sub,
      orgId: auth.orgId
    };
  }

  function updateInstanceOrThrow(
    instanceId: string,
    patch: Partial<
      Pick<
        RuntimeInstance,
        | "status"
        | "bearerToken"
        | "lastError"
        | "baseUrl"
        | "gatewayPort"
        | "requirePairing"
        | "allowPublicBind"
        | "llmProvider"
        | "llmModel"
        | "llmApiKey"
        | "telegramEnabled"
        | "telegramBotToken"
        | "telegramAllowFrom"
        | "telegramReplyInPrivate"
        | "slackEnabled"
        | "slackBotToken"
        | "slackAppToken"
        | "slackAllowedChannelIds"
        | "slackAllowedUserIds"
        | "slackReplyInThread"
        | "discordEnabled"
        | "discordBotToken"
        | "discordAllowedGuildIds"
        | "discordAllowedChannelIds"
        | "discordReplyInThread"
        | "discordRequireMention"
        | "dailyMessageLimit"
        | "dailyTokenLimit"
        | "monthlySpendLimitUsd"
        | "runtimeOptions"
        | "runtimeSecrets"
      >
    >
  ): RuntimeInstance {
    const updated = store.updateRuntimeInstance(instanceId, patch);
    if (!updated) {
      throw new Error(`Runtime instance ${instanceId} not found`);
    }
    return updated;
  }

  function isGatewayPortAllocationFailure(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    return (
      normalized.includes("port is already allocated") ||
      (normalized.includes("bind for") && normalized.includes("failed"))
    );
  }

  function appendRuntimeEvent(input: {
    requestId?: string;
    tenantId?: string;
    agentId?: string;
    instanceId?: string;
    action: RuntimeEventAction;
    outcome: RuntimeEventOutcome;
    message?: string;
    metadata?: Record<string, unknown>;
  }): void {
    store.appendRuntimeEvent({
      requestId: input.requestId,
      tenantId: input.tenantId,
      agentId: input.agentId,
      instanceId: input.instanceId,
      action: input.action,
      outcome: input.outcome,
      message: input.message,
      metadata: input.metadata
    });
  }

}

function resolvePublicRoot(explicitPublicRoot?: string): string | undefined {
  const candidates = [
    explicitPublicRoot,
    process.env.ATOLL_WEB_DIST?.trim(),
    resolve(process.cwd(), "web/dist")
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));

  for (const candidate of candidates) {
    const resolvedCandidate = resolve(candidate);
    if (existsSync(join(resolvedCandidate, "index.html"))) {
      return resolvedCandidate;
    }
  }

  return undefined;
}

function hasFileExtension(path: string): boolean {
  return /\.[A-Za-z0-9]+$/u.test(path);
}

async function parseJsonObject(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const payload = (await response.json()) as unknown;
    if (payload && typeof payload === "object") {
      return payload as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function toPublicRuntimeInstance(instance: RuntimeInstance): PublicRuntimeInstance {
  const {
    bearerToken,
    llmApiKey,
    telegramBotToken,
    slackBotToken,
    slackAppToken,
    discordBotToken,
    runtimeSecrets,
    ...rest
  } = instance;
  return {
    ...rest,
    hasToken: Boolean(bearerToken),
    hasLlmApiKey: Boolean(llmApiKey),
    hasTelegramBotToken: Boolean(telegramBotToken),
    hasSlackBotToken: Boolean(slackBotToken),
    hasSlackAppToken: Boolean(slackAppToken),
    hasDiscordBotToken: Boolean(discordBotToken),
    hasRuntimeSecrets: Boolean(runtimeSecrets && Object.keys(runtimeSecrets).length > 0)
  };
}

function resolveConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const host = overrides.host ?? process.env.HOST ?? "0.0.0.0";
  const port = overrides.port ?? parsePositiveInteger(process.env.PORT, 4000);
  const managedEnvFilePath = overrides.managedEnvFilePath ?? resolve(process.cwd(), ".env");
  const corsAllowedOrigins =
    overrides.corsAllowedOrigins ??
    parseCorsAllowedOrigins(getEnvValue("ATOLL_CORS_ALLOWED_ORIGINS"), "ATOLL_CORS_ALLOWED_ORIGINS");
  const secretsKey = overrides.secretsKey ?? getEnvValue("ATOLL_SECRETS_KEY") ?? "";
  const stateFilePath =
    overrides.stateFilePath ?? getEnvValue("ATOLL_STATE_FILE") ?? "./atoll-state.json";
  const runtimeImage =
    overrides.runtimeImage ??
    process.env.RUNTIME_ZEROCLAW_IMAGE ??
    DEFAULT_ZEROCLAW_RUNTIME_IMAGE;
  const runtimeOpenclawImage =
    overrides.runtimeOpenclawImage ??
    process.env.RUNTIME_OPENCLAW_IMAGE ??
    DEFAULT_OPENCLAW_RUNTIME_IMAGE;
  const supportedRuntimeTypes =
    overrides.supportedRuntimeTypes ??
    resolveSupportedRuntimeTypes(process.env.ATOLL_SUPPORTED_RUNTIME_TYPES, ALL_RUNTIME_TYPES);
  const defaultRuntimeType =
    overrides.defaultRuntimeType ??
    resolveDefaultRuntimeType(process.env.ATOLL_DEFAULT_RUNTIME_TYPE, supportedRuntimeTypes);
  const runtimeNetwork =
    overrides.runtimeNetwork ??
    process.env.RUNTIME_DOCKER_NETWORK ??
    "atoll-network";
  const runtimeGatewayPort =
    overrides.runtimeGatewayPort ?? parsePositiveInteger(process.env.RUNTIME_GATEWAY_PORT, 42617);
  const runtimeProvider = overrides.runtimeProvider ?? process.env.RUNTIME_PROVIDER ?? "openrouter";
  const runtimeModel =
    overrides.runtimeModel ?? process.env.RUNTIME_MODEL ?? "anthropic/claude-sonnet-4.6";
  const runtimeTelegramModelOverride =
    overrides.runtimeTelegramModelOverride ??
    getOptionalTrimmedString(process.env.RUNTIME_TELEGRAM_MODEL_OVERRIDE);
  const runtimeApiKey =
    overrides.runtimeApiKey ??
    getEnvValue("ATOLL_LLM_PROVIDER_API_KEY") ??
    "";
  const runtimeRequirePairing = parseBooleanEnv(
    overrides.runtimeRequirePairing === undefined
      ? process.env.RUNTIME_REQUIRE_PAIRING
      : String(overrides.runtimeRequirePairing),
    false
  );
  const runtimeAllowPublicBind = parseBooleanEnv(
    overrides.runtimeAllowPublicBind === undefined
      ? process.env.RUNTIME_ALLOW_PUBLIC_BIND
      : String(overrides.runtimeAllowPublicBind),
    true
  );
  const runtimeHttpTimeoutMs =
    overrides.runtimeHttpTimeoutMs ?? parseNonNegativeInteger(process.env.RUNTIME_HTTP_TIMEOUT_MS, 15000);
  const runtimeProvisioningStaleMs =
    overrides.runtimeProvisioningStaleMs ??
    parsePositiveInteger(process.env.RUNTIME_PROVISIONING_STALE_MS, 30 * 60 * 1000);
  const runtimeReconcileIntervalMs =
    overrides.runtimeReconcileIntervalMs ??
    parsePositiveInteger(process.env.RUNTIME_RECONCILE_INTERVAL_MS, 0);
  const runtimeEventsMaxEntries =
    overrides.runtimeEventsMaxEntries ??
    parseNonNegativeInteger(getEnvValue("ATOLL_RUNTIME_EVENTS_MAX"), 5000);
  const runtimeEventsMaxAgeDays =
    overrides.runtimeEventsMaxAgeDays ??
    parseNonNegativeInteger(
      getEnvValue("ATOLL_RUNTIME_EVENTS_MAX_AGE_DAYS"),
      30
    );
  const localAuthSub = (
    overrides.localAuthSub ??
    getEnvValue("ATOLL_LOCAL_AUTH_SUB") ??
    "local-admin"
  ).trim();
  const localAuthOrgId = (
    overrides.localAuthOrgId ??
    getEnvValue("ATOLL_LOCAL_AUTH_ORG_ID") ??
    "local-org"
  ).trim();
  const localAuthAllowHeaderOverrides = parseBooleanEnv(
    overrides.localAuthAllowHeaderOverrides === undefined
      ? getEnvValue("ATOLL_LOCAL_AUTH_ALLOW_HEADER_OVERRIDES")
      : String(overrides.localAuthAllowHeaderOverrides),
    false
  );
  const runtimeStartupValidation = resolveRuntimeStartupValidationMode(
    overrides.runtimeStartupValidation,
    process.env.RUNTIME_STARTUP_VALIDATION
  );
  const runtimeCatalog =
    overrides.runtimeCatalog ??
    buildRuntimeCatalog({
      runtimeTypes: supportedRuntimeTypes,
      runtimeImages: {
        openclaw: runtimeOpenclawImage,
        zeroclaw: runtimeImage
      },
      runtimeGatewayPort,
      runtimeRequirePairing,
      runtimeAllowPublicBind
    });

  if (!secretsKey) {
    throw new Error("ATOLL_SECRETS_KEY is required");
  }
  if (!localAuthSub) {
    throw new Error("ATOLL_LOCAL_AUTH_SUB cannot be empty");
  }
  if (!localAuthOrgId) {
    throw new Error("ATOLL_LOCAL_AUTH_ORG_ID cannot be empty");
  }

  return {
    host,
    port,
    managedEnvFilePath,
    corsAllowedOrigins,
    secretsKey,
    stateFilePath,
    runtimeImage,
    runtimeOpenclawImage,
    supportedRuntimeTypes,
    defaultRuntimeType,
    runtimeCatalog,
    runtimeNetwork,
    runtimeGatewayPort,
    runtimeProvider,
    runtimeModel,
    runtimeTelegramModelOverride,
    runtimeApiKey,
    runtimeRequirePairing,
    runtimeAllowPublicBind,
    runtimeHttpTimeoutMs,
    runtimeProvisioningStaleMs,
    runtimeReconcileIntervalMs,
    runtimeEventsMaxEntries,
    runtimeEventsMaxAgeDays,
    runtimeStartupValidation,
    localAuthSub,
    localAuthOrgId,
    localAuthAllowHeaderOverrides
  };
}

function parseCorsAllowedOrigins(rawValue: string | undefined, sourceLabel: string): string[] {
  const rawOrigins = (rawValue ?? "")
    .split(/[\n,]/g)
    .map((value) => value.trim())
    .filter(Boolean);
  if (rawOrigins.length === 0) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawOrigin of rawOrigins) {
    let origin: string;
    try {
      origin = new URL(rawOrigin).origin;
    } catch {
      throw new Error(`${sourceLabel} contains invalid origin '${rawOrigin}'`);
    }
    if (seen.has(origin)) {
      continue;
    }
    seen.add(origin);
    normalized.push(origin);
  }
  return normalized;
}

function resolveRuntimeStartupValidationMode(
  override: AppConfig["runtimeStartupValidation"] | undefined,
  envValue: string | undefined
): AppConfig["runtimeStartupValidation"] {
  if (override === "strict" || override === "warn" || override === "off") {
    return override;
  }

  const normalized = envValue?.trim().toLowerCase();
  if (normalized === "strict" || normalized === "warn" || normalized === "off") {
    return normalized;
  }

  return "strict";
}

async function validateRuntimeStartupPrereqs(
  config: AppConfig,
  runtimeProvider: RuntimeProvider
): Promise<void> {
  if (config.runtimeStartupValidation === "off") {
    return;
  }

  for (const runtimeType of config.supportedRuntimeTypes) {
    let diagnostics;
    try {
      diagnostics = await runtimeProvider.checkPrereqs({
        image: resolveRuntimeImageForType({
          runtimeType,
          zeroclawImage: config.runtimeImage,
          openclawImage: config.runtimeOpenclawImage
        }),
        network: config.runtimeNetwork
      });
    } catch (error) {
      const failure = buildFailurePayload(error, "Runtime startup diagnostics check failed");
      const details = `${failure.message} (${failure.failureClass}) Hint: ${failure.failureHint}`;
      if (config.runtimeStartupValidation === "warn") {
        console.warn(`[startup validation warning] ${details}`);
        continue;
      }
      throw new Error(details);
    }

    const missing: string[] = [];
    if (diagnostics.image.status !== "present") {
      missing.push(`image ${diagnostics.image.name}`);
    }
    if (diagnostics.network.status !== "present") {
      missing.push(`network ${diagnostics.network.name}`);
    }

    if (missing.length === 0) {
      continue;
    }

    const message =
      `Runtime startup prerequisite check failed for ${runtimeType}: missing ${missing.join(", ")}. ` +
      `Container CLI=${diagnostics.containerCli}, process mode=${diagnostics.processMode}. ` +
      `Hint: ${failureHintForClass("container")}`;

    if (config.runtimeStartupValidation === "warn") {
      console.warn(`[startup validation warning] ${message}`);
      continue;
    }

    throw new Error(message);
  }
}

function resolveRuntimeProcessMode(): "daemon" | "gateway" {
  const configured = process.env.RUNTIME_PROCESS_MODE?.trim().toLowerCase();
  return configured === "gateway" ? "gateway" : "daemon";
}

async function start(): Promise<void> {
  const config = resolveConfig();
  const runtimeProvider = createLocalRuntimeProvider(defaultRuntimeOps);
  await validateRuntimeStartupPrereqs(config, runtimeProvider);
  const app = await buildApp({ config });
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`API listening on http://${config.host}:${config.port}`);
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}


if (isMainModule()) {
  void start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
