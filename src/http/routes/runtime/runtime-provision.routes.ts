import type { FastifyInstance } from "fastify";

import {
  parseCreateRuntimeInstanceInput,
  parseProvisionJobParams,
  parseRuntimeReconcileInput,
  parsePositiveIntegerUnknown
} from "../../../parsers.js";
import type { RuntimeRouteDeps } from "./types.js";

export function registerRuntimeProvisionRoutes(app: FastifyInstance, deps: RuntimeRouteDeps): void {
  const {
    store,
    config,
    getAuthContextOrThrow,
    toPublicRuntimeInstance,
    resolveRuntimeCreationInput,
    createProvisioningRuntimeRecord,
    runProvisionWork,
    provisionService,
    reconcileService,
    appendRuntimeEvent
  } = deps;

  app.get("/api/runtime/catalog", async (request) => {
    getAuthContextOrThrow(request);
    return {
      items: config.runtimeCatalog
    };
  });

  app.get("/api/runtime/provision-requests", async (request) => {
    const auth = getAuthContextOrThrow(request);
    const tenantIds = new Set(store.listTenants(auth.orgId).map((tenant) => tenant.id));
    return {
      items: store
        .listRuntimeProvisionRequests()
        .filter((item) => tenantIds.has(item.tenantId))
    };
  });

  app.get("/api/runtime/provision-requests/:requestId", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const params = request.params as { requestId?: unknown };
    const requestId = typeof params.requestId === "string" ? params.requestId.trim() : "";
    if (!requestId) {
      return reply.status(400).send({
        message: "Validation failed: requestId is required"
      });
    }

    const provisionRequest = store.getRuntimeProvisionRequest(requestId);
    if (!provisionRequest) {
      return reply.status(404).send({
        message: `Provision request ${requestId} not found`
      });
    }
    const tenant = store.getTenant(provisionRequest.tenantId);
    if (!tenant || tenant.identityOrgId !== auth.orgId) {
      return reply.status(404).send({
        message: `Provision request ${requestId} not found`
      });
    }

    return provisionRequest;
  });

  app.get("/api/runtime/events", async (request) => {
    const auth = getAuthContextOrThrow(request);
    const query = request.query as {
      instanceId?: unknown;
      limit?: unknown;
    };
    const requestedInstanceId =
      typeof query.instanceId === "string" ? query.instanceId.trim() : undefined;
    const limit = parsePositiveIntegerUnknown(query.limit, 100);
    const tenantIds = new Set(store.listTenants(auth.orgId).map((tenant) => tenant.id));

    return {
      items: listVisibleRuntimeEvents(store, tenantIds, {
        instanceId: requestedInstanceId,
        limit
      })
    };
  });

  app.get("/api/runtime/events/export", async (request) => {
    const auth = getAuthContextOrThrow(request);
    const query = request.query as {
      instanceId?: unknown;
    };
    const requestedInstanceId =
      typeof query.instanceId === "string" ? query.instanceId.trim() : undefined;
    const tenantIds = new Set(store.listTenants(auth.orgId).map((tenant) => tenant.id));

    return {
      exportedAt: new Date().toISOString(),
      retention: {
        maxEntries: config.runtimeEventsMaxEntries,
        maxAgeDays: config.runtimeEventsMaxAgeDays
      },
      filters: requestedInstanceId ? { instanceId: requestedInstanceId } : {},
      items: listVisibleRuntimeEvents(store, tenantIds, {
        instanceId: requestedInstanceId
      })
    };
  });

  app.get("/api/runtime/provision-jobs", async (request) => {
    const auth = getAuthContextOrThrow(request);
    const tenantIds = new Set(store.listTenants(auth.orgId).map((tenant) => tenant.id));
    return {
      items: provisionService.listJobs().filter((job) => tenantIds.has(job.tenantId))
    };
  });

  app.get("/api/runtime/provision-jobs/:jobId", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const params = parseProvisionJobParams(request.params);
    const job = provisionService.getJob(params.jobId);
    if (!job) {
      return reply.status(404).send({
        message: `Provision job ${params.jobId} not found`
      });
    }
    const tenant = store.getTenant(job.tenantId);
    if (!tenant || tenant.identityOrgId !== auth.orgId) {
      return reply.status(404).send({
        message: `Provision job ${params.jobId} not found`
      });
    }

    return job;
  });

  app.post("/api/runtime/provision-jobs", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const input = parseCreateRuntimeInstanceInput(request.body, config);
    const resolved = resolveRuntimeCreationInput({
      tenantId: input.tenantId,
      agentId: input.agentId,
      identityOrgId: auth.orgId
    });
    if (!resolved.ok) {
      return reply.status(resolved.statusCode).send({
        message: resolved.message
      });
    }

    const provisionRequest = store.createRuntimeProvisionRequest({
      tenantId: resolved.tenant.id,
      agentId: resolved.agent.id,
      status: "pending_requested"
    });
    appendRuntimeEvent({
      requestId: request.id,
      tenantId: resolved.tenant.id,
      agentId: resolved.agent.id,
      action: "provision_requested",
      outcome: "started",
      message: "Provision request accepted."
    });

    let runtimeRecord;
    try {
      runtimeRecord = await createProvisioningRuntimeRecord({
        tenantId: resolved.tenant.id,
        agentId: resolved.agent.id,
        runtimeType: input.runtimeType,
        llmProvider: input.llmProvider,
        llmModel: input.llmModel,
        llmApiKey: input.llmApiKey,
        gatewayPort: input.gatewayPort,
        requirePairing: input.requirePairing,
        allowPublicBind: input.allowPublicBind,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown runtime record creation error";
      store.updateRuntimeProvisionRequest(provisionRequest.id, {
        status: "failed",
        error: message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: resolved.tenant.id,
        agentId: resolved.agent.id,
        action: "provision_failed",
        outcome: "failed",
        message
      });
      throw error;
    }

    const job = provisionService.createJob({
      tenantId: resolved.tenant.id,
      agentId: resolved.agent.id,
      instanceId: runtimeRecord.id,
      requestId: provisionRequest.id
    });

    store.updateRuntimeProvisionRequest(provisionRequest.id, {
      status: "provisioning",
      instanceId: runtimeRecord.id,
      jobId: job.id,
      error: undefined
    });
    appendRuntimeEvent({
      requestId: request.id,
      tenantId: resolved.tenant.id,
      agentId: resolved.agent.id,
      instanceId: runtimeRecord.id,
      action: "provision_started",
      outcome: "started",
      message: "Provisioning runtime container started.",
      metadata: {
        jobId: job.id,
        provisionRequestId: provisionRequest.id
      }
    });

    provisionService.enqueueJob(job.id, async () => {
      await runProvisionWork(runtimeRecord.id);
    });

    return reply.status(202).send({
      provisionRequest,
      job,
      instance: toPublicRuntimeInstance(runtimeRecord)
    });
  });

  app.post("/api/runtime/reconcile", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const input = parseRuntimeReconcileInput(request.body);
    const tenantIds = new Set(store.listTenants(auth.orgId).map((tenant) => tenant.id));

    const targetInstances = input.instanceId
      ? (() => {
          const runtimeInstance = store.getRuntimeInstance(input.instanceId);
          if (!runtimeInstance || !tenantIds.has(runtimeInstance.tenantId)) {
            return undefined;
          }
          return [runtimeInstance];
        })()
      : store.listRuntimeInstances().filter((instance) => tenantIds.has(instance.tenantId));

    if (!targetInstances || targetInstances.length === 0) {
      if (input.instanceId) {
        return reply.status(404).send({
          message: `Runtime instance ${input.instanceId} not found`
        });
      }
      return {
        dryRun: input.dryRun,
        scope: "org",
        summary: {
          checked: 0,
          updated: 0,
          unchanged: 0,
          errors: 0
        },
        actions: []
      };
    }

    const outcome = await reconcileService.reconcileInstances({
      instances: targetInstances,
      dryRun: input.dryRun,
      source: "manual"
    });
    for (const action of outcome.actions) {
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: action.tenantId,
        instanceId: action.instanceId,
        action: "reconcile",
        outcome: action.error ? "failed" : "succeeded",
        message: action.reason,
        metadata: {
          dryRun: input.dryRun,
          changed: action.changed,
          statusBefore: action.statusBefore,
          statusAfter: action.statusAfter,
          provisioningStale: action.provisioningStale,
          containerRunning: action.containerRunning,
          error: action.error
        }
      });
    }

    return {
      dryRun: input.dryRun,
      scope: input.instanceId ? "instance" : "org",
      summary: outcome.summary,
      actions: outcome.actions
    };
  });
}

function listVisibleRuntimeEvents(
  store: RuntimeRouteDeps["store"],
  tenantIds: Set<string>,
  input: {
    instanceId?: string;
    limit?: number;
  }
) {
  return store
    .listRuntimeEvents({
      instanceId: input.instanceId,
      limit: input.limit
    })
    .filter((item) => Boolean(item.tenantId && tenantIds.has(item.tenantId)));
}
