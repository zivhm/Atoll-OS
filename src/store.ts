import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { DEFAULT_AGENT_TYPE_ID, normalizeAgentSkills, normalizeAgentTypeId, type AgentTypeId } from "./agent-types.js";
import { buildInitialAgentPresetCatalog, type AgentPresetCatalogItem } from "./agent-presets.js";
import { normalizeIdentityColorToken } from "./identity-colors.js";

export type Channel = "whatsapp" | "telegram" | "custom";

export const WORKSPACE_KINDS = ["default", "dedicated"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const WORKSPACE_RESOURCE_MODES = ["individual", "shared"] as const;
export type WorkspaceResourceMode = (typeof WORKSPACE_RESOURCE_MODES)[number];

export const DEFAULT_WORKSPACE_NAME = "Default Workspace";

export type Tenant = {
  id: string;
  name: string;
  kind: WorkspaceKind;
  resourceMode: WorkspaceResourceMode;
  isDefault: boolean;
  sharedVolumeName?: string;
  sharedNetworkName?: string;
  identityOrgId?: string;
  createdAt: string;
};

export type CreateTenantInput = {
  name: string;
  kind?: WorkspaceKind;
  identityOrgId?: string;
};

export type AgentAvatarStyle = "notionists";

export type AgentAvatar = {
  style: AgentAvatarStyle;
  seed: string;
  backgroundColor: string;
};

export type Agent = {
  id: string;
  tenantId: string;
  name: string;
  avatar?: AgentAvatar;
  agentType: AgentTypeId;
  skills: string[];
  roleTitle?: string;
  presetId?: string;
  presetName?: string;
  presetSourcePath?: string;
  presetSummary?: string;
  presetIdentityMarkdown?: string;
  presetSoulMarkdown?: string;
  presetToolsMarkdown?: string;
  presetSoulTemplateMarkdown?: string;
  channel: Channel;
  status: "running" | "paused";
  createdAt: string;
};

export type CreateAgentInput = {
  tenantId: string;
  name: string;
  avatar?: AgentAvatar;
  agentType?: AgentTypeId;
  skills?: string[];
  roleTitle?: string;
  presetId?: string;
  presetName?: string;
  presetSourcePath?: string;
  presetSummary?: string;
  presetIdentityMarkdown?: string;
  presetSoulMarkdown?: string;
  presetToolsMarkdown?: string;
  presetSoulTemplateMarkdown?: string;
  channel: Channel;
};

type UpdateAgentPatch = Partial<Pick<Agent, "name" | "roleTitle" | "status" | "avatar">>;

export const RUNTIME_INSTANCE_STATUSES = [
  "provisioning",
  "running",
  "stopped",
  "error"
] as const;
export type RuntimeInstanceStatus = (typeof RUNTIME_INSTANCE_STATUSES)[number];

export const RUNTIME_TYPES = ["openclaw", "zeroclaw", "hermes"] as const;
export type RuntimeType = (typeof RUNTIME_TYPES)[number];

export type RuntimeInstance = {
  id: string;
  tenantId: string;
  agentId: string;
  runtimeType: RuntimeType;
  containerName: string;
  volumeName: string;
  networkName: string;
  baseUrl?: string;
  gatewayPort: number;
  requirePairing: boolean;
  allowPublicBind: boolean;
  llmProvider: string;
  llmModel: string;
  llmApiKey?: string;
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
  status: RuntimeInstanceStatus;
  bearerToken?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProvisionJobStatus = "queued" | "running" | "succeeded" | "failed";

export type ProvisionJob = {
  id: string;
  tenantId: string;
  agentId: string;
  instanceId: string;
  requestId?: string;
  status: ProvisionJobStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export const RUNTIME_PROVISION_REQUEST_STATUSES = [
  "pending_requested",
  "provisioning",
  "succeeded",
  "failed"
] as const;
export type RuntimeProvisionRequestStatus =
  (typeof RUNTIME_PROVISION_REQUEST_STATUSES)[number];

export type RuntimeProvisionRequest = {
  id: string;
  tenantId: string;
  agentId: string;
  instanceId?: string;
  jobId?: string;
  status: RuntimeProvisionRequestStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export const RUNTIME_EVENT_ACTIONS = [
  "provision_requested",
  "provision_started",
  "provision_succeeded",
  "provision_failed",
  "start",
  "stop",
  "restart",
  "delete",
  "pair",
  "token_set",
  "chat",
  "webhook",
  "llm_update",
  "telegram_update",
  "slack_update",
  "discord_update",
  "limits_update",
  "runtime_config_update",
  "reconcile",
  "sync",
  "repair"
] as const;
export type RuntimeEventAction = (typeof RUNTIME_EVENT_ACTIONS)[number];

export const RUNTIME_EVENT_OUTCOMES = [
  "started",
  "succeeded",
  "failed"
] as const;
export type RuntimeEventOutcome = (typeof RUNTIME_EVENT_OUTCOMES)[number];

export type RuntimeEvent = {
  id: string;
  requestId?: string;
  tenantId?: string;
  agentId?: string;
  instanceId?: string;
  action: RuntimeEventAction;
  outcome: RuntimeEventOutcome;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export const RUNTIME_CHAT_ROLES = ["user", "assistant", "system", "error"] as const;
export type RuntimeChatRole = (typeof RUNTIME_CHAT_ROLES)[number];

export type RuntimeChatMessage = {
  id: string;
  instanceId: string;
  role: RuntimeChatRole;
  content: string;
  createdAt: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};

export type CreateRuntimeInstanceInput = {
  tenantId: string;
  agentId: string;
  runtimeType?: RuntimeType;
  containerName: string;
  volumeName: string;
  networkName: string;
  baseUrl?: string;
  gatewayPort: number;
  requirePairing: boolean;
  allowPublicBind: boolean;
  llmProvider: string;
  llmModel: string;
  llmApiKey?: string;
  telegramEnabled?: boolean;
  telegramBotToken?: string;
  telegramAllowFrom?: string[];
  telegramReplyInPrivate?: boolean;
  slackEnabled?: boolean;
  slackBotToken?: string;
  slackAppToken?: string;
  slackAllowedChannelIds?: string[];
  slackAllowedUserIds?: string[];
  slackReplyInThread?: boolean;
  discordEnabled?: boolean;
  discordBotToken?: string;
  discordAllowedGuildIds?: string[];
  discordAllowedChannelIds?: string[];
  discordReplyInThread?: boolean;
  discordRequireMention?: boolean;
  dailyMessageLimit?: number;
  dailyTokenLimit?: number;
  monthlySpendLimitUsd?: number;
  runtimeOptions?: Record<string, unknown>;
  runtimeSecrets?: Record<string, string>;
};

type SerializedRuntimeInstance = Omit<
  RuntimeInstance,
  | "bearerToken"
  | "llmApiKey"
  | "telegramBotToken"
  | "slackBotToken"
  | "slackAppToken"
  | "discordBotToken"
  | "runtimeSecrets"
> & {
  bearerToken?: string;
  llmApiKey?: string;
  telegramBotToken?: string;
  slackBotToken?: string;
  slackAppToken?: string;
  slackSigningSecret?: string;
  discordBotToken?: string;
  runtimeSecrets?: Record<string, string>;
  slackWebhookUrl?: string;
  slackDefaultChannel?: string;
  discordWebhookUrl?: string;
  discordDefaultChannel?: string;
};

type StoreSnapshot = {
  version: 1;
  tenants: Tenant[];
  agents: Agent[];
  agentPresets?: AgentPresetCatalogItem[];
  runtimeInstances: SerializedRuntimeInstance[];
  provisionJobs?: ProvisionJob[];
  runtimeProvisionRequests?: RuntimeProvisionRequest[];
  runtimeEvents?: RuntimeEvent[];
  runtimeChatMessages?: RuntimeChatMessage[];
};

type StoreOptions = {
  stateFilePath: string;
  secretsKey: string;
  runtimeEventsMaxEntries?: number;
  runtimeEventsMaxAgeDays?: number;
};

type UpdateRuntimePatch = Partial<
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
>;

const STORE_VERSION = 1;
const ENCRYPTION_PREFIX = "enc:v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RUNTIME_EVENTS_MAX_ENTRIES = 5000;
export const DEFAULT_RUNTIME_EVENTS_MAX_AGE_DAYS = 30;

export type Store = ReturnType<typeof createStore>;

export function createStore(options: StoreOptions) {
  if (!options.stateFilePath.trim()) {
    throw new Error("stateFilePath is required");
  }

  if (!options.secretsKey.trim()) {
    throw new Error("secretsKey is required");
  }

  const stateFilePath = resolve(options.stateFilePath);
  const encryptionKey = createHash("sha256").update(options.secretsKey).digest();
  const runtimeEventsMaxEntries = normalizeNonNegativeInteger(
    options.runtimeEventsMaxEntries,
    DEFAULT_RUNTIME_EVENTS_MAX_ENTRIES
  );
  const runtimeEventsMaxAgeDays = normalizeNonNegativeInteger(
    options.runtimeEventsMaxAgeDays,
    DEFAULT_RUNTIME_EVENTS_MAX_AGE_DAYS
  );
  const runtimeEventsMaxAgeMs = runtimeEventsMaxAgeDays > 0 ? runtimeEventsMaxAgeDays * DAY_MS : 0;

  if (encryptionKey.length !== KEY_BYTES) {
    throw new Error("Invalid encryption key");
  }

  const tenants = new Map<string, Tenant>();
  const agents = new Map<string, Agent>();
  const agentPresets = new Map<string, AgentPresetCatalogItem>();
  const runtimeInstances = new Map<string, RuntimeInstance>();
  const runtimeInstanceByAgentId = new Map<string, string>();
  const provisionJobs = new Map<string, ProvisionJob>();
  const runtimeProvisionRequests = new Map<string, RuntimeProvisionRequest>();
  const runtimeEvents = new Map<string, RuntimeEvent>();
  const runtimeChatMessages = new Map<string, RuntimeChatMessage>();

  loadState();

  return {
    listTenants,
    getDefaultTenantByIdentityOrgId,
    getTenantByIdentityOrgId,
    ensureDefaultTenant,
    createTenant,
    getTenant,
    listAgents,
    createAgent,
    getAgent,
    deleteAgent,
    updateAgent,
    listAgentPresets,
    getAgentPreset,
    createAgentPreset,
    updateAgentPreset,
    replaceAgentPresets,
    reorderAgentPresets,
    listRuntimeInstances,
    getRuntimeInstance,
    getRuntimeInstanceForAgent,
    createRuntimeInstance,
    updateRuntimeInstance,
    deleteRuntimeInstance,
    listProvisionJobs,
    getProvisionJob,
    saveProvisionJob,
    listRuntimeProvisionRequests,
    getRuntimeProvisionRequest,
    createRuntimeProvisionRequest,
    updateRuntimeProvisionRequest,
    listRuntimeEvents,
    appendRuntimeEvent,
    listRuntimeChatMessages,
    appendRuntimeChatMessage
  };

  function listTenants(identityOrgId?: string): Tenant[] {
    const values = [...tenants.values()];
    const filtered = identityOrgId
      ? values.filter((tenant) => tenant.identityOrgId === identityOrgId)
      : values;
    return filtered.sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      if (a.createdAt !== b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
      }
      return a.name.localeCompare(b.name);
    });
  }

  function getDefaultTenantByIdentityOrgId(identityOrgId: string): Tenant | undefined {
    if (!identityOrgId.trim()) {
      return undefined;
    }
    return [...tenants.values()].find(
      (tenant) => tenant.identityOrgId === identityOrgId && tenant.isDefault
    );
  }

  function getTenantByIdentityOrgId(identityOrgId: string): Tenant | undefined {
    return getDefaultTenantByIdentityOrgId(identityOrgId);
  }

  function ensureDefaultTenant(identityOrgId: string): Tenant {
    const orgId = identityOrgId.trim();
    if (!orgId) {
      throw new Error("identityOrgId is required");
    }

    const existing = getDefaultTenantByIdentityOrgId(orgId);
    if (existing) {
      return existing;
    }

    return createTenant({
      name: DEFAULT_WORKSPACE_NAME,
      kind: "default",
      identityOrgId: orgId
    });
  }

  function createTenant(input: CreateTenantInput): Tenant {
    const identityOrgId = input.identityOrgId?.trim() || undefined;
    const kind = input.kind === "dedicated" ? "dedicated" : "default";
    if (kind === "default" && identityOrgId) {
      const existing = getDefaultTenantByIdentityOrgId(identityOrgId);
      if (existing) {
        return existing;
      }
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const resourceMode = kind === "dedicated" ? "shared" : "individual";
    const tenant: Tenant = {
      id,
      name: kind === "default" ? DEFAULT_WORKSPACE_NAME : input.name,
      kind,
      resourceMode,
      isDefault: kind === "default",
      sharedVolumeName: resourceMode === "shared" ? buildWorkspaceSharedVolumeName(id) : undefined,
      sharedNetworkName: resourceMode === "shared" ? buildWorkspaceSharedNetworkName(id) : undefined,
      identityOrgId,
      createdAt: now
    };

    tenants.set(tenant.id, tenant);
    persistState();
    return tenant;
  }

  function getTenant(tenantId: string): Tenant | undefined {
    return tenants.get(tenantId);
  }

  function listAgents(tenantId?: string): Agent[] {
    const values = [...agents.values()];
    const filtered = tenantId ? values.filter((agent) => agent.tenantId === tenantId) : values;
    return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function createAgent(input: CreateAgentInput): Agent {
    const now = new Date().toISOString();
    const agent: Agent = {
      id: randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      avatar: normalizeAgentAvatar(input.avatar),
      agentType: normalizeAgentTypeId(input.agentType),
      skills: normalizeAgentSkills(input.skills),
      roleTitle: input.roleTitle?.trim() || undefined,
      presetId: input.presetId?.trim() || undefined,
      presetName: input.presetName?.trim() || undefined,
      presetSourcePath: input.presetSourcePath?.trim() || undefined,
      presetSummary: input.presetSummary?.trim() || undefined,
      presetIdentityMarkdown: input.presetIdentityMarkdown?.trim() || undefined,
      presetSoulMarkdown: input.presetSoulMarkdown?.trim() || undefined,
      presetToolsMarkdown: input.presetToolsMarkdown?.trim() || undefined,
      presetSoulTemplateMarkdown: input.presetSoulTemplateMarkdown?.trim() || undefined,
      channel: input.channel,
      status: "running",
      createdAt: now
    };

    agents.set(agent.id, agent);
    persistState();
    return agent;
  }

  function getAgent(agentId: string): Agent | undefined {
    return agents.get(agentId);
  }

  function deleteAgent(agentId: string): Agent | undefined {
    const current = agents.get(agentId);
    if (!current) {
      return undefined;
    }

    if (runtimeInstanceByAgentId.has(agentId)) {
      throw new Error(`Cannot delete agent ${agentId} while a runtime instance still exists`);
    }

    agents.delete(agentId);
    persistState();
    return current;
  }

  function updateAgent(agentId: string, patch: UpdateAgentPatch): Agent | undefined {
    const current = agents.get(agentId);
    if (!current) {
      return undefined;
    }

    const nextName = patch.name === undefined ? current.name : patch.name.trim();
    if (!nextName) {
      throw new Error("Validation failed: agent name is required");
    }

    const updated: Agent = {
      ...current,
      name: nextName,
      avatar: patch.avatar === undefined ? current.avatar : normalizeAgentAvatar(patch.avatar),
      roleTitle:
        patch.roleTitle === undefined
          ? current.roleTitle
          : patch.roleTitle.trim() || undefined,
      status: patch.status ?? current.status
    };
    agents.set(updated.id, updated);
    persistState();
    return updated;
  }

  function listAgentPresets(options: { activeOnly?: boolean } = {}): AgentPresetCatalogItem[] {
    const values = [...agentPresets.values()];
    const filtered = options.activeOnly ? values.filter((preset) => preset.active) : values;
    return filtered.sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  function getAgentPreset(presetId: string): AgentPresetCatalogItem | undefined {
    return agentPresets.get(presetId);
  }

  function createAgentPreset(
    input: Omit<AgentPresetCatalogItem, "createdAt" | "updatedAt" | "position"> & { position?: number }
  ): AgentPresetCatalogItem {
    const now = new Date().toISOString();
    const position = normalizePresetPosition(input.position, agentPresets.size);
    const preset: AgentPresetCatalogItem = {
      ...input,
      color: normalizeIdentityColorToken(input.color),
      recommendedSkills: normalizeAgentSkills(input.recommendedSkills),
      tools: input.tools.trim(),
      position,
      createdAt: now,
      updatedAt: now
    };

    insertOrReplaceAgentPreset(preset);
    persistState();
    return preset;
  }

  function updateAgentPreset(
    presetId: string,
    patch: Partial<
      Omit<AgentPresetCatalogItem, "id" | "createdAt" | "updatedAt" | "position">
    > & { position?: number }
  ): AgentPresetCatalogItem | undefined {
    const current = agentPresets.get(presetId);
    if (!current) return undefined;

    const updated: AgentPresetCatalogItem = {
      ...current,
      ...patch,
      color:
        patch.color === undefined
          ? current.color
          : normalizeIdentityColorToken(patch.color),
      recommendedSkills:
        patch.recommendedSkills === undefined
          ? current.recommendedSkills
          : normalizeAgentSkills(patch.recommendedSkills),
      tools: patch.tools === undefined ? current.tools : patch.tools.trim(),
      position:
        patch.position === undefined ? current.position : normalizePresetPosition(patch.position, current.position),
      updatedAt: new Date().toISOString()
    };

    insertOrReplaceAgentPreset(updated);
    persistState();
    return updated;
  }

  function replaceAgentPresets(
    items: Array<
      Omit<AgentPresetCatalogItem, "createdAt" | "updatedAt"> & {
        createdAt?: string;
        updatedAt?: string;
      }
    >
  ): AgentPresetCatalogItem[] {
    agentPresets.clear();
    const now = new Date().toISOString();
    items.forEach((item, index) => {
      const preset: AgentPresetCatalogItem = {
        ...item,
        color: normalizeIdentityColorToken(item.color),
        recommendedSkills: normalizeAgentSkills(item.recommendedSkills),
        tools: item.tools.trim(),
        position: normalizePresetPosition(item.position, index),
        createdAt: item.createdAt?.trim() || now,
        updatedAt: item.updatedAt?.trim() || now
      };
      agentPresets.set(preset.id, preset);
    });
    normalizeAgentPresetPositions();
    persistState();
    return listAgentPresets();
  }

  function reorderAgentPresets(presetIds: string[]): AgentPresetCatalogItem[] {
    const ordered = listAgentPresets();
    const rank = new Map(presetIds.map((id, index) => [id, index]));
    const resorted = [...ordered].sort((a, b) => {
      const aRank = rank.get(a.id);
      const bRank = rank.get(b.id);
      if (aRank === undefined && bRank === undefined) {
        return a.position - b.position;
      }
      if (aRank === undefined) return 1;
      if (bRank === undefined) return -1;
      return aRank - bRank;
    });

    const now = new Date().toISOString();
    resorted.forEach((preset, index) => {
      agentPresets.set(preset.id, {
        ...preset,
        position: index,
        updatedAt: now
      });
    });

    persistState();
    return listAgentPresets();
  }

  function listRuntimeInstances(tenantId?: string): RuntimeInstance[] {
    const values = [...runtimeInstances.values()];
    const filtered = tenantId
      ? values.filter((runtimeInstance) => runtimeInstance.tenantId === tenantId)
      : values;
    return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function getRuntimeInstance(instanceId: string): RuntimeInstance | undefined {
    return runtimeInstances.get(instanceId);
  }

  function getRuntimeInstanceForAgent(agentId: string): RuntimeInstance | undefined {
    const instanceId = runtimeInstanceByAgentId.get(agentId);
    if (!instanceId) return undefined;
    return runtimeInstances.get(instanceId);
  }

  function createRuntimeInstance(input: CreateRuntimeInstanceInput): RuntimeInstance {
    if (runtimeInstanceByAgentId.has(input.agentId)) {
      throw new Error(`Runtime instance for agent ${input.agentId} already exists`);
    }

    const now = new Date().toISOString();
    const runtimeInstance: RuntimeInstance = {
      id: randomUUID(),
      tenantId: input.tenantId,
      agentId: input.agentId,
      runtimeType: normalizeRuntimeType(input.runtimeType),
      containerName: input.containerName,
      volumeName: input.volumeName,
      networkName: input.networkName,
      baseUrl: input.baseUrl?.trim() || undefined,
      gatewayPort: input.gatewayPort,
      requirePairing: input.requirePairing,
      allowPublicBind: input.allowPublicBind,
      llmProvider: input.llmProvider,
      llmModel: input.llmModel,
      llmApiKey: input.llmApiKey,
      telegramEnabled: input.telegramEnabled ?? false,
      telegramBotToken: normalizeOptionalString(input.telegramBotToken),
      telegramAllowFrom: input.telegramAllowFrom ?? [],
      telegramReplyInPrivate: input.telegramReplyInPrivate ?? true,
      slackEnabled: input.slackEnabled ?? false,
      slackBotToken: normalizeOptionalString(input.slackBotToken),
      slackAppToken: normalizeOptionalString(input.slackAppToken),
      slackAllowedChannelIds: normalizeIdList(input.slackAllowedChannelIds),
      slackAllowedUserIds: normalizeIdList(input.slackAllowedUserIds),
      slackReplyInThread: input.slackReplyInThread ?? true,
      discordEnabled: input.discordEnabled ?? false,
      discordBotToken: normalizeOptionalString(input.discordBotToken),
      discordAllowedGuildIds: normalizeIdList(input.discordAllowedGuildIds),
      discordAllowedChannelIds: normalizeIdList(input.discordAllowedChannelIds),
      discordReplyInThread: input.discordReplyInThread ?? true,
      discordRequireMention: input.discordRequireMention ?? true,
      dailyMessageLimit: normalizeOptionalLimitValue(input.dailyMessageLimit),
      dailyTokenLimit: normalizeOptionalLimitValue(input.dailyTokenLimit),
      monthlySpendLimitUsd: normalizeOptionalLimitValue(input.monthlySpendLimitUsd),
      runtimeOptions: normalizeRuntimeOptions(input.runtimeOptions),
      runtimeSecrets: normalizeSecretMap(input.runtimeSecrets),
      status: "provisioning",
      createdAt: now,
      updatedAt: now
    };

    runtimeInstances.set(runtimeInstance.id, runtimeInstance);
    runtimeInstanceByAgentId.set(input.agentId, runtimeInstance.id);
    persistState();
    return runtimeInstance;
  }

  function updateRuntimeInstance(
    instanceId: string,
    patch: UpdateRuntimePatch
  ): RuntimeInstance | undefined {
    const current = runtimeInstances.get(instanceId);
    if (!current) return undefined;
    const has = (key: keyof UpdateRuntimePatch) =>
      Object.prototype.hasOwnProperty.call(patch, key);

    const updated: RuntimeInstance = {
      ...current,
      ...patch,
      slackEnabled: has("slackEnabled") ? Boolean(patch.slackEnabled) : current.slackEnabled,
      slackBotToken: has("slackBotToken")
        ? normalizeOptionalString(patch.slackBotToken)
        : current.slackBotToken,
      slackAppToken: has("slackAppToken")
        ? normalizeOptionalString(patch.slackAppToken)
        : current.slackAppToken,
      slackAllowedChannelIds: has("slackAllowedChannelIds")
        ? normalizeIdList(patch.slackAllowedChannelIds)
        : current.slackAllowedChannelIds,
      slackAllowedUserIds: has("slackAllowedUserIds")
        ? normalizeIdList(patch.slackAllowedUserIds)
        : current.slackAllowedUserIds,
      slackReplyInThread: has("slackReplyInThread")
        ? Boolean(patch.slackReplyInThread)
        : current.slackReplyInThread,
      discordEnabled: has("discordEnabled") ? Boolean(patch.discordEnabled) : current.discordEnabled,
      discordBotToken: has("discordBotToken")
        ? normalizeOptionalString(patch.discordBotToken)
        : current.discordBotToken,
      discordAllowedGuildIds: has("discordAllowedGuildIds")
        ? normalizeIdList(patch.discordAllowedGuildIds)
        : current.discordAllowedGuildIds,
      discordAllowedChannelIds: has("discordAllowedChannelIds")
        ? normalizeIdList(patch.discordAllowedChannelIds)
        : current.discordAllowedChannelIds,
      discordReplyInThread: has("discordReplyInThread")
        ? Boolean(patch.discordReplyInThread)
        : current.discordReplyInThread,
      discordRequireMention: has("discordRequireMention")
        ? Boolean(patch.discordRequireMention)
        : current.discordRequireMention,
      dailyMessageLimit: has("dailyMessageLimit")
        ? normalizeOptionalLimitValue(patch.dailyMessageLimit)
        : current.dailyMessageLimit,
      dailyTokenLimit: has("dailyTokenLimit")
        ? normalizeOptionalLimitValue(patch.dailyTokenLimit)
        : current.dailyTokenLimit,
      monthlySpendLimitUsd: has("monthlySpendLimitUsd")
        ? normalizeOptionalLimitValue(patch.monthlySpendLimitUsd)
        : current.monthlySpendLimitUsd,
      runtimeOptions:
        patch.runtimeOptions === undefined
          ? current.runtimeOptions
          : normalizeRuntimeOptions(patch.runtimeOptions),
      runtimeSecrets:
        patch.runtimeSecrets === undefined
          ? current.runtimeSecrets
          : normalizeSecretMap(patch.runtimeSecrets),
      updatedAt: new Date().toISOString()
    };

    runtimeInstances.set(instanceId, updated);
    persistState();
    return updated;
  }

  function deleteRuntimeInstance(instanceId: string): RuntimeInstance | undefined {
    const current = runtimeInstances.get(instanceId);
    if (!current) return undefined;

    runtimeInstances.delete(instanceId);
    runtimeInstanceByAgentId.delete(current.agentId);
    persistState();
    return current;
  }

  function listProvisionJobs(): ProvisionJob[] {
    return [...provisionJobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function getProvisionJob(jobId: string): ProvisionJob | undefined {
    return provisionJobs.get(jobId);
  }

  function saveProvisionJob(job: ProvisionJob): ProvisionJob {
    provisionJobs.set(job.id, job);
    persistState();
    return job;
  }

  function listRuntimeProvisionRequests(tenantId?: string): RuntimeProvisionRequest[] {
    const values = [...runtimeProvisionRequests.values()];
    const filtered = tenantId ? values.filter((request) => request.tenantId === tenantId) : values;
    return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function getRuntimeProvisionRequest(requestId: string): RuntimeProvisionRequest | undefined {
    return runtimeProvisionRequests.get(requestId);
  }

  function createRuntimeProvisionRequest(input: {
    tenantId: string;
    agentId: string;
    instanceId?: string;
    jobId?: string;
    status?: RuntimeProvisionRequestStatus;
    error?: string;
  }): RuntimeProvisionRequest {
    const now = new Date().toISOString();
    const request: RuntimeProvisionRequest = {
      id: randomUUID(),
      tenantId: input.tenantId,
      agentId: input.agentId,
      instanceId: input.instanceId,
      jobId: input.jobId,
      status: input.status ?? "pending_requested",
      error: input.error,
      createdAt: now,
      updatedAt: now
    };

    runtimeProvisionRequests.set(request.id, request);
    persistState();
    return request;
  }

  function updateRuntimeProvisionRequest(
    requestId: string,
    patch: Partial<
      Pick<RuntimeProvisionRequest, "instanceId" | "jobId" | "status" | "error">
    >
  ): RuntimeProvisionRequest | undefined {
    const current = runtimeProvisionRequests.get(requestId);
    if (!current) return undefined;

    const updated: RuntimeProvisionRequest = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    runtimeProvisionRequests.set(requestId, updated);
    persistState();
    return updated;
  }

  function listRuntimeEvents(input: {
    tenantId?: string;
    instanceId?: string;
    limit?: number;
  } = {}): RuntimeEvent[] {
    const values = [...runtimeEvents.values()];
    const filtered = values.filter((event) => {
      if (input.tenantId && event.tenantId !== input.tenantId) return false;
      if (input.instanceId && event.instanceId !== input.instanceId) return false;
      return true;
    });
    const sorted = filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const limit = input.limit && input.limit > 0 ? Math.floor(input.limit) : sorted.length;
    return sorted.slice(0, limit);
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
  }): RuntimeEvent {
    const event: RuntimeEvent = {
      id: randomUUID(),
      requestId: input.requestId?.trim() || undefined,
      tenantId: input.tenantId?.trim() || undefined,
      agentId: input.agentId?.trim() || undefined,
      instanceId: input.instanceId?.trim() || undefined,
      action: input.action,
      outcome: input.outcome,
      message: input.message?.trim() || undefined,
      metadata: input.metadata,
      createdAt: new Date().toISOString()
    };

    runtimeEvents.set(event.id, event);
    pruneRuntimeEvents();
    persistState();
    return event;
  }

  function listRuntimeChatMessages(input: {
    instanceId: string;
    limit?: number;
  }): RuntimeChatMessage[] {
    const sorted = [...runtimeChatMessages.values()]
      .filter((message) => message.instanceId === input.instanceId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const limit = input.limit && input.limit > 0 ? Math.floor(input.limit) : sorted.length;
    return sorted.slice(Math.max(0, sorted.length - limit));
  }

  function appendRuntimeChatMessage(input: {
    instanceId: string;
    role: RuntimeChatRole;
    content: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }): RuntimeChatMessage {
    const message: RuntimeChatMessage = {
      id: randomUUID(),
      instanceId: input.instanceId.trim(),
      role: input.role,
      content: input.content.trim(),
      requestId: input.requestId?.trim() || undefined,
      metadata: input.metadata,
      createdAt: new Date().toISOString()
    };

    runtimeChatMessages.set(message.id, message);
    persistState();
    return message;
  }

  function loadState(): void {
    if (!existsSync(stateFilePath)) {
      seedDefaultAgentPresets();
      return;
    }

    try {
      const raw = readFileSync(stateFilePath, "utf8");
      const parsed = JSON.parse(raw) as StoreSnapshot;

      if (!parsed || parsed.version !== STORE_VERSION) {
        throw new Error(`Unsupported store version in ${stateFilePath}`);
      }

      const normalizedTenants = normalizeTenantList(parsed.tenants ?? []);
      normalizedTenants.items.forEach((tenant) => tenants.set(tenant.id, tenant));
      const normalizedAgents = normalizeAgentList(parsed.agents ?? []);
      normalizedAgents.items.forEach((agent) => agents.set(agent.id, agent));
      if ((parsed.agentPresets ?? []).length > 0) {
        parsed.agentPresets?.forEach((preset) => {
          agentPresets.set(preset.id, {
            ...preset,
            color: normalizeIdentityColorToken(preset.color),
            recommendedSkills: normalizeAgentSkills(preset.recommendedSkills),
            tools: normalizeOptionalString(preset.tools) ?? ""
          });
        });
        normalizeAgentPresetPositions();
      } else {
        seedDefaultAgentPresets();
      }
      parsed.runtimeInstances.forEach((serialized) => {
        const runtime = deserializeRuntimeInstance(serialized);
        runtimeInstances.set(runtime.id, runtime);
        runtimeInstanceByAgentId.set(runtime.agentId, runtime.id);
      });
      (parsed.provisionJobs ?? []).forEach((job) => {
        provisionJobs.set(job.id, job);
      });
      (parsed.runtimeProvisionRequests ?? []).forEach((request) => {
        runtimeProvisionRequests.set(request.id, request);
      });
      (parsed.runtimeEvents ?? []).forEach((event) => {
        runtimeEvents.set(event.id, event);
      });
      (parsed.runtimeChatMessages ?? []).forEach((message) => {
        runtimeChatMessages.set(message.id, message);
      });
      const prunedOnLoad = pruneRuntimeEvents();
      const prunedOrphanedAgents = pruneOrphanedAgentsWithTerminalProvisionHistory();
      if (
        prunedOnLoad ||
        prunedOrphanedAgents ||
        normalizedTenants.changed ||
        normalizedAgents.changed
      ) {
        persistState();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to load state file ${stateFilePath}: ${message}`);
    }
  }

  function persistState(): void {
    const snapshot: StoreSnapshot = {
      version: STORE_VERSION,
      tenants: [...tenants.values()],
      agents: [...agents.values()],
      agentPresets: listAgentPresets(),
      runtimeInstances: [...runtimeInstances.values()].map(serializeRuntimeInstance),
      provisionJobs: [...provisionJobs.values()],
      runtimeProvisionRequests: [...runtimeProvisionRequests.values()],
      runtimeEvents: [...runtimeEvents.values()],
      runtimeChatMessages: [...runtimeChatMessages.values()]
    };

    const output = `${JSON.stringify(snapshot, null, 2)}\n`;
    const tempPath = `${stateFilePath}.${randomUUID()}.tmp`;
    mkdirSync(dirname(stateFilePath), { recursive: true });
    writeFileSync(tempPath, output, "utf8");
    renameSync(tempPath, stateFilePath);
  }

  function serializeRuntimeInstance(runtime: RuntimeInstance): SerializedRuntimeInstance {
    return {
      ...runtime,
      llmApiKey: encryptSecret(runtime.llmApiKey),
      telegramBotToken: encryptSecret(runtime.telegramBotToken),
      slackBotToken: encryptSecret(runtime.slackBotToken),
      slackAppToken: encryptSecret(runtime.slackAppToken),
      discordBotToken: encryptSecret(runtime.discordBotToken),
      bearerToken: encryptSecret(runtime.bearerToken),
      runtimeSecrets: encryptSecretMap(runtime.runtimeSecrets)
    };
  }

  function deserializeRuntimeInstance(serialized: SerializedRuntimeInstance): RuntimeInstance {
    return {
      ...serialized,
      runtimeType: normalizeRuntimeType((serialized as Partial<RuntimeInstance>).runtimeType),
      telegramEnabled: Boolean((serialized as Partial<RuntimeInstance>).telegramEnabled),
      telegramAllowFrom: (serialized as Partial<RuntimeInstance>).telegramAllowFrom ?? [],
      telegramReplyInPrivate:
        (serialized as Partial<RuntimeInstance>).telegramReplyInPrivate ?? true,
      runtimeOptions: normalizeRuntimeOptions(serialized.runtimeOptions),
      llmApiKey: decryptSecret(serialized.llmApiKey),
      telegramBotToken: decryptSecret(serialized.telegramBotToken),
      slackEnabled: Boolean((serialized as Partial<RuntimeInstance>).slackEnabled),
      slackBotToken: decryptSecret(serialized.slackBotToken),
      slackAppToken: decryptSecret(serialized.slackAppToken ?? serialized.slackSigningSecret),
      slackAllowedChannelIds: normalizeIdList(
        (serialized as Partial<RuntimeInstance>).slackAllowedChannelIds
      ),
      slackAllowedUserIds: normalizeIdList(
        (serialized as Partial<RuntimeInstance>).slackAllowedUserIds
      ),
      slackReplyInThread:
        (serialized as Partial<RuntimeInstance>).slackReplyInThread ?? true,
      discordEnabled: Boolean((serialized as Partial<RuntimeInstance>).discordEnabled),
      discordBotToken: decryptSecret(serialized.discordBotToken),
      discordAllowedGuildIds: normalizeIdList(
        (serialized as Partial<RuntimeInstance>).discordAllowedGuildIds
      ),
      discordAllowedChannelIds: normalizeIdList(
        (serialized as Partial<RuntimeInstance>).discordAllowedChannelIds
      ),
      discordReplyInThread:
        (serialized as Partial<RuntimeInstance>).discordReplyInThread ?? true,
      discordRequireMention:
        (serialized as Partial<RuntimeInstance>).discordRequireMention ?? true,
      dailyMessageLimit: normalizeOptionalLimitValue((serialized as Partial<RuntimeInstance>).dailyMessageLimit),
      dailyTokenLimit: normalizeOptionalLimitValue((serialized as Partial<RuntimeInstance>).dailyTokenLimit),
      monthlySpendLimitUsd: normalizeOptionalLimitValue((serialized as Partial<RuntimeInstance>).monthlySpendLimitUsd),
      bearerToken: decryptSecret(serialized.bearerToken),
      runtimeSecrets: decryptSecretMap(serialized.runtimeSecrets)
    };
  }

  function encryptSecret(value?: string): string | undefined {
    if (!value) return undefined;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      ENCRYPTION_PREFIX,
      iv.toString("base64"),
      authTag.toString("base64"),
      encrypted.toString("base64")
    ].join(":");
  }

  function decryptSecret(value?: string): string | undefined {
    if (!value) return undefined;
    if (!value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
      return value;
    }

    const parts = value.split(":");
    if (parts.length !== 5) {
      throw new Error("Invalid encrypted secret format");
    }
    const ivB64 = parts[2];
    const authTagB64 = parts[3];
    const encryptedB64 = parts[4];
    if (!ivB64 || !authTagB64 || !encryptedB64) {
      throw new Error("Invalid encrypted secret payload");
    }

    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const encrypted = Buffer.from(encryptedB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  }

  function encryptSecretMap(
    value?: Record<string, string>
  ): Record<string, string> | undefined {
    if (!value) {
      return undefined;
    }

    const entries = Object.entries(value)
      .map(([key, secret]) => [key.trim(), encryptSecret(secret)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1]));

    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(entries);
  }

  function decryptSecretMap(
    value?: Record<string, string>
  ): Record<string, string> | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const entries = Object.entries(value)
      .map(([key, secret]) => [key.trim(), decryptSecret(secret)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1]));

    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(entries);
  }

  function normalizeSecretMap(
    value?: Record<string, string>
  ): Record<string, string> | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const entries = Object.entries(value)
      .map(([key, secret]) => [key.trim(), typeof secret === "string" ? secret.trim() : ""] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1]));

    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(entries);
  }

  function pruneOrphanedAgentsWithTerminalProvisionHistory(): boolean {
    let changed = false;

    for (const agent of agents.values()) {
      if (runtimeInstanceByAgentId.has(agent.id)) {
        continue;
      }

      const relatedRequests = [...runtimeProvisionRequests.values()].filter(
        (request) => request.agentId === agent.id
      );
      const relatedJobs = [...provisionJobs.values()].filter((job) => job.agentId === agent.id);
      const hasProvisionHistory = relatedRequests.length > 0 || relatedJobs.length > 0;
      const hasActiveProvisionRequest = relatedRequests.some(
        (request) =>
          request.status === "pending_requested" || request.status === "provisioning"
      );

      if (!hasProvisionHistory || hasActiveProvisionRequest) {
        continue;
      }

      agents.delete(agent.id);
      changed = true;
    }

    return changed;
  }

  function normalizeRuntimeOptions(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).filter(([key]) => key.trim().length > 0)
    );
  }

  function seedDefaultAgentPresets(): void {
    const seeded = buildInitialAgentPresetCatalog();
    seeded.forEach((preset) => {
      agentPresets.set(preset.id, preset);
    });
  }

  function normalizePresetPosition(value: number | undefined, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return Math.floor(fallback);
    }
    return Math.floor(value);
  }

  function insertOrReplaceAgentPreset(preset: AgentPresetCatalogItem): void {
    agentPresets.set(preset.id, preset);
    normalizeAgentPresetPositions();
  }

  function normalizeAgentPresetPositions(): void {
    const ordered = [...agentPresets.values()].sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });

    ordered.forEach((preset, index) => {
      agentPresets.set(preset.id, {
        ...preset,
        position: index
      });
    });
  }

  function normalizeRuntimeType(value: unknown): RuntimeType {
    if (value === "openclaw" || value === "zeroclaw" || value === "hermes") {
      return value;
    }
    return "openclaw";
  }

  function pruneRuntimeEvents(nowMs = Date.now()): boolean {
    let changed = false;

    if (runtimeEventsMaxAgeMs > 0) {
      for (const [id, event] of runtimeEvents.entries()) {
        const createdAtMs = Date.parse(event.createdAt);
        const isValidDate = Number.isFinite(createdAtMs);
        const isExpired = isValidDate ? nowMs - createdAtMs >= runtimeEventsMaxAgeMs : true;
        if (isExpired) {
          runtimeEvents.delete(id);
          changed = true;
        }
      }
    }

    if (runtimeEventsMaxEntries > 0 && runtimeEvents.size > runtimeEventsMaxEntries) {
      const keepIds = new Set(
        [...runtimeEvents.values()]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, runtimeEventsMaxEntries)
          .map((event) => event.id)
      );

      for (const id of runtimeEvents.keys()) {
        if (!keepIds.has(id)) {
          runtimeEvents.delete(id);
          changed = true;
        }
      }
    }

    return changed;
  }
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number") return fallback;
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeAgentAvatar(value: AgentAvatar | undefined): AgentAvatar | undefined {
  if (!value) {
    return undefined;
  }

  const seed = normalizeOptionalString(value.seed);
  const backgroundColor = normalizeOptionalString(value.backgroundColor)?.toLowerCase();
  if (!seed || !backgroundColor) {
    return undefined;
  }

  return {
    style: "notionists",
    seed,
    backgroundColor
  };
}

function normalizeIdList(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    const candidate = normalizeOptionalString(item);
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

function normalizeOptionalLimitValue(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function normalizeAgentList(items: Agent[]): { items: Agent[]; changed: boolean } {
  let changed = false;
  const normalized = items.map((agent) => {
    const nextAgent: Agent = {
      ...agent,
      avatar: normalizeAgentAvatar(agent.avatar),
      agentType: normalizeAgentTypeId(agent.agentType),
      skills: normalizeAgentSkills(agent.skills)
    };

    if (
      JSON.stringify(agent.avatar ?? null) !== JSON.stringify(nextAgent.avatar ?? null) ||
      agent.agentType !== nextAgent.agentType ||
      JSON.stringify(agent.skills ?? []) !== JSON.stringify(nextAgent.skills)
    ) {
      changed = true;
    }

    return nextAgent;
  });

  return {
    items: normalized,
    changed
  };
}

function normalizeTenantList(items: Tenant[]): { items: Tenant[]; changed: boolean } {
  const changed = { value: false };
  const normalized: Tenant[] = [];
  const byOrgId = new Map<string, Tenant[]>();

  for (const tenant of items) {
    const orgId = tenant.identityOrgId?.trim();
    if (!orgId) {
      normalized.push(normalizeTenant(tenant, changed));
      continue;
    }

    const current = byOrgId.get(orgId) ?? [];
    current.push(tenant);
    byOrgId.set(orgId, current);
  }

  for (const tenantsInOrg of byOrgId.values()) {
    const ordered = [...tenantsInOrg].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const preferredDefault =
      ordered.find((tenant) => tenant.isDefault || tenant.kind === "default") ?? ordered[0];

    ordered.forEach((tenant) => {
      const isDefault = tenant.id === preferredDefault?.id;
      const kind: WorkspaceKind = isDefault
        ? "default"
        : tenant.kind === "dedicated"
          ? "dedicated"
          : "dedicated";
      normalized.push(
        normalizeTenant(
          {
            ...tenant,
            kind,
            isDefault
          },
          changed
        )
      );
    });
  }

  return {
    items: normalized.sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      if (a.createdAt !== b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
      }
      return a.name.localeCompare(b.name);
    }),
    changed: changed.value
  };
}

function normalizeTenant(tenant: Tenant, changed: { value: boolean }): Tenant {
  const kind: WorkspaceKind = tenant.kind === "dedicated" ? "dedicated" : "default";
  const resourceMode: WorkspaceResourceMode =
    tenant.resourceMode === "shared" || tenant.resourceMode === "individual"
      ? tenant.resourceMode
      : kind === "dedicated"
        ? "shared"
        : "individual";
  const isDefault = tenant.isDefault === true || kind === "default";
  const normalizedKind: WorkspaceKind = isDefault ? "default" : kind;
  const normalizedResourceMode: WorkspaceResourceMode =
    normalizedKind === "dedicated" ? "shared" : resourceMode === "shared" ? "individual" : "individual";
  const sharedVolumeName =
    normalizedResourceMode === "shared"
      ? normalizeWorkspaceResourceName(tenant.sharedVolumeName) ?? buildWorkspaceSharedVolumeName(tenant.id)
      : undefined;
  const sharedNetworkName =
    normalizedResourceMode === "shared"
      ? normalizeWorkspaceResourceName(tenant.sharedNetworkName) ?? buildWorkspaceSharedNetworkName(tenant.id)
      : undefined;
  const normalizedName =
    normalizedKind === "default"
      ? DEFAULT_WORKSPACE_NAME
      : typeof tenant.name === "string" && tenant.name.trim()
        ? tenant.name.trim()
        : "Workspace";
  const normalizedOrgId = tenant.identityOrgId?.trim() || undefined;

  const normalizedTenant: Tenant = {
    ...tenant,
    name: normalizedName,
    kind: normalizedKind,
    resourceMode: normalizedResourceMode,
    isDefault: normalizedKind === "default",
    sharedVolumeName,
    sharedNetworkName,
    identityOrgId: normalizedOrgId
  };

  if (
    tenant.name !== normalizedTenant.name ||
    tenant.kind !== normalizedTenant.kind ||
    tenant.resourceMode !== normalizedTenant.resourceMode ||
    tenant.isDefault !== normalizedTenant.isDefault ||
    tenant.sharedVolumeName !== normalizedTenant.sharedVolumeName ||
    tenant.sharedNetworkName !== normalizedTenant.sharedNetworkName ||
    tenant.identityOrgId !== normalizedTenant.identityOrgId
  ) {
    changed.value = true;
  }

  return normalizedTenant;
}

function buildWorkspaceSharedVolumeName(tenantId: string): string {
  const suffix = tenantId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `atoll_ws_${suffix || "shared"}`;
}

function buildWorkspaceSharedNetworkName(tenantId: string): string {
  const suffix = tenantId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `atoll-ws-${suffix || "shared"}`;
}

function normalizeWorkspaceResourceName(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
