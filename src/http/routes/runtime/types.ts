import type { FastifyReply, FastifyRequest } from "fastify";

import type { RuntimeCatalogItem } from "../../../runtime-kind.js";
import type { RuntimeReconcileAction } from "../../../runtime-reconcile.js";
import type { RuntimeProvider } from "../../../runtime-provider.js";
import type { RuntimeChatMessage, RuntimeInstance, RuntimeType, Store } from "../../../store.js";

export type RuntimeRouteAuthContext = {
  sub: string;
  orgId: string;
};

export type RuntimeRouteConfig = {
  runtimeImage: string;
  runtimeOpenclawImage: string;
  runtimeEventsMaxEntries: number;
  runtimeEventsMaxAgeDays: number;
  supportedRuntimeTypes: RuntimeType[];
  defaultRuntimeType: RuntimeType;
  runtimeCatalog: RuntimeCatalogItem[];
  runtimeNetwork: string;
  runtimeApiKey: string;
  runtimeTelegramModelOverride?: string;
  runtimeHttpTimeoutMs: number;
  runtimeProvider: string;
  runtimeModel: string;
  runtimeGatewayPort: number;
  runtimeRequirePairing: boolean;
  runtimeAllowPublicBind: boolean;
};

export type RuntimeRouteDeps = {
  store: Store;
  config: RuntimeRouteConfig;
  runtimeProvider: RuntimeProvider;
  getAuthContextOrThrow: (request: FastifyRequest) => RuntimeRouteAuthContext;
  toPublicRuntimeInstance: (instance: RuntimeInstance) => unknown;
  appendRuntimeEvent: (input: {
    requestId?: string;
    tenantId?: string;
    agentId?: string;
    instanceId?: string;
    action:
      | "provision_requested"
      | "provision_started"
      | "provision_succeeded"
      | "provision_failed"
      | "start"
      | "stop"
      | "restart"
      | "delete"
      | "pair"
      | "token_set"
      | "chat"
      | "webhook"
      | "llm_update"
      | "telegram_update"
      | "slack_update"
      | "discord_update"
      | "limits_update"
      | "runtime_config_update"
      | "reconcile"
      | "sync"
      | "repair";
    outcome: "started" | "succeeded" | "failed";
    message?: string;
    metadata?: Record<string, unknown>;
  }) => void;
  appendRuntimeChatMessage: (input: {
    instanceId: string;
    role: RuntimeChatMessage["role"];
    content: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }) => RuntimeChatMessage;
  listRuntimeChatMessages: (input: {
    instanceId: string;
    limit?: number;
  }) => RuntimeChatMessage[];
  resolveRuntimeCreationInput: (input: {
    tenantId: string;
    agentId: string;
    identityOrgId: string;
  }) =>
    | { ok: true; tenant: { id: string }; agent: { id: string; tenantId: string } }
    | { ok: false; statusCode: number; message: string };
  createProvisioningRuntimeRecord: (input: {
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
  }) => Promise<RuntimeInstance>;
  runProvisionWork: (instanceId: string) => Promise<RuntimeInstance>;
  resolveRuntimeInstanceOrReply: (
    request: FastifyRequest,
    paramsPayload: unknown,
    reply: FastifyReply
  ) => RuntimeInstance | undefined;
  updateInstanceOrThrow: (
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
  ) => RuntimeInstance;
  applyRuntimeConfigForInstance: (runtimeInstance: RuntimeInstance) => Promise<RuntimeInstance>;
  parseJsonObject: (response: Response) => Promise<Record<string, unknown> | null>;
  provisionService: {
    listJobs: () => Array<{ tenantId: string; id: string; instanceId: string; status: string }>;
    getJob: (jobId: string) =>
      | { tenantId: string; id: string; instanceId: string; status: string; requestId?: string }
      | undefined;
    createJob: (input: {
      tenantId: string;
      agentId: string;
      instanceId: string;
      requestId?: string;
      createdAt?: string;
    }) => { id: string; instanceId: string; status: string };
    enqueueJob: (jobId: string, work: () => Promise<void>) => void;
  };
  reconcileService: {
    reconcileInstances: (input: {
      instances: RuntimeInstance[];
      dryRun: boolean;
      source: "manual" | "interval";
    }) => Promise<{
      summary: {
        checked: number;
        updated: number;
        unchanged: number;
        errors: number;
      };
      actions: RuntimeReconcileAction[];
    }>;
  };
};
