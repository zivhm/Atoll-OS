export type Channel = "whatsapp" | "telegram" | "custom";
export type RuntimeStatus = "provisioning" | "running" | "stopped" | "error";
export type RuntimeType = "zeroclaw" | "openclaw";
export type AgentPresetCategory = string;
export type RuntimeConnectorMaturity = "supported" | "beta";
export type RuntimeHealthMode = "http" | "container";
export type RuntimePresetMode = "exact" | "translated";
export type RuntimeConfigFieldKind = "string" | "number" | "boolean" | "json";
export type SettingsConfigFieldKind = "text" | "boolean" | "select";

export interface RuntimeConnectorCapabilities {
  llmConfig: boolean;
  telegramToken: boolean;
  telegramAllowFrom: boolean;
  telegramReplyInPrivate: boolean;
  pairingInfo: boolean;
  pairingAction: boolean;
  chatAction: boolean;
  webhookAction: boolean;
  httpHealth: boolean;
}

export interface RuntimeConfigFieldDescriptor {
  key: string;
  label: string;
  kind: RuntimeConfigFieldKind;
  secret?: boolean;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: unknown;
}

export interface RuntimeCatalogItem {
  id: RuntimeType;
  label: string;
  maturity: RuntimeConnectorMaturity;
  imageEnvVar: string;
  defaultImage?: string;
  resolvedImage: string;
  defaultGatewayPort: number;
  defaultRequirePairing: boolean;
  defaultAllowPublicBind: boolean;
  healthMode: RuntimeHealthMode;
  healthPath?: string;
  presetMode: RuntimePresetMode;
  capabilities: RuntimeConnectorCapabilities;
  runtimeConfigFields: RuntimeConfigFieldDescriptor[];
}

export interface SessionProfile {
  sub: string;
  orgId: string;
  authMode: "local";
}

export interface SettingsConfigFieldOption {
  value: string;
  label: string;
}

export interface SettingsConfigField {
  key: string;
  label: string;
  kind: SettingsConfigFieldKind;
  helpText: string;
  value: string | boolean;
  source: "env" | "default";
  placeholder?: string;
  options?: SettingsConfigFieldOption[];
}

export interface SettingsConfigGroup {
  id: "local-auth" | "runtime-defaults" | "runtime-behavior";
  title: string;
  description: string;
  fields: SettingsConfigField[];
}

export interface SettingsConfigSnapshot {
  groups: SettingsConfigGroup[];
  restartRequired: boolean;
  restartMessage: string;
  warning: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  runtime: {
    processMode: "daemon" | "gateway";
    containerCli: string;
    image: string;
    openclawImage: string;
    supportedRuntimeTypes: RuntimeType[];
    defaultRuntimeType: RuntimeType;
    network: string;
    hasApiKey: boolean;
    defaultProvider: string;
    defaultModel: string;
    telegramModelOverride: string | null;
    defaultGatewayPort: number;
    defaultRequirePairing: boolean;
    defaultAllowPublicBind: boolean;
    runtimeHttpTimeoutMs: number;
    runtimeProvisioningStaleMs: number;
    runtimeReconcileIntervalMs: number;
    runtimeEventsMaxEntries: number;
    runtimeEventsMaxAgeDays: number;
    startupValidationMode: "strict" | "warn" | "off";
    authMode: "local";
  };
}

export interface Tenant {
  id: string;
  name: string;
  kind: "default" | "dedicated";
  resourceMode: "individual" | "shared";
  isDefault: boolean;
  sharedVolumeName?: string;
  sharedNetworkName?: string;
  identityOrgId?: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  tenantId: string;
  name: string;
  avatar?: AgentAvatar;
  agentType: "general" | "frontend" | "backend";
  skills: string[];
  roleTitle?: string;
  presetId?: string;
  presetName?: string;
  presetSourcePath?: string;
  presetSummary?: string;
  channel: Channel;
  status: "running" | "paused";
  createdAt: string;
}

export interface AgentAvatar {
  style: "notionists";
  seed: string;
  backgroundColor: string;
}

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  color: string;
  category: AgentPresetCategory;
  sourceRepoUrl?: string;
  sourcePath?: string;
  summary: string;
  suggestedRoleTitle: string;
  recommendedSkills: string[];
  active: boolean;
  position: number;
}

export interface AdminAgentPreset extends AgentPreset {
  identity: string;
  soul: string;
  tools: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPresetExportSnapshot {
  version: 1;
  exportedAt: string;
  items: AdminAgentPreset[];
}

export interface RuntimeInstance {
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
  telegramEnabled: boolean;
  telegramAllowFrom: string[];
  telegramReplyInPrivate: boolean;
  slackEnabled: boolean;
  slackAllowedChannelIds: string[];
  slackAllowedUserIds: string[];
  slackReplyInThread: boolean;
  discordEnabled: boolean;
  discordAllowedGuildIds: string[];
  discordAllowedChannelIds: string[];
  discordReplyInThread: boolean;
  dailyMessageLimit?: number;
  dailyTokenLimit?: number;
  monthlySpendLimitUsd?: number;
  runtimeOptions: Record<string, unknown>;
  status: RuntimeStatus;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  hasToken: boolean;
  hasLlmApiKey: boolean;
  hasTelegramBotToken: boolean;
  hasSlackBotToken: boolean;
  hasSlackAppToken: boolean;
  hasDiscordBotToken: boolean;
  hasRuntimeSecrets: boolean;
}

export interface AgentTypeCatalogItem {
  id: Agent["agentType"];
  name: string;
  description: string;
  defaultSkills: string[];
}

export interface RuntimeSharedFile {
  id: string;
  name: string;
  relativePath: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface RuntimeStats {
  instanceId: string;
  messages: {
    total: number | null;
  };
  tokens: {
    input: number | null;
    output: number | null;
    total: number | null;
  };
  cost: {
    usd: number | null;
  };
  lastActivityAt: string | null;
  sourceMetadata: {
    primary: "runtime-health" | "atoll-events";
    runtimeStatsFound: boolean;
    fallbackEventCount: number;
    missing: string[];
  };
}

export interface ProvisionJob {
  id: string;
  tenantId: string;
  agentId: string;
  instanceId: string;
  requestId?: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionRequest {
  id: string;
  tenantId: string;
  agentId: string;
  instanceId?: string;
  jobId?: string;
  status: "pending_requested" | "provisioning" | "succeeded" | "failed";
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeEvent {
  id: string;
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
  createdAt: string;
}

export interface RuntimeChatMessage {
  id: string;
  instanceId: string;
  role: "user" | "assistant" | "system" | "error";
  content: string;
  createdAt: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeChatSendInput {
  message: string;
  token?: string;
}

export interface RuntimeChatSendResponse {
  userMessage: RuntimeChatMessage;
  assistantMessage?: RuntimeChatMessage;
  errorMessage?: RuntimeChatMessage;
  raw?: Record<string, unknown>;
}

export interface RuntimeSlackOnboardingChecklistItem {
  id: string;
  title: string;
  done: boolean;
  hint?: string;
}

export interface RuntimeSlackOnboarding {
  mode: "socket";
  requiredFieldsStatus: {
    slackEnabled: boolean;
    hasSlackBotToken: boolean;
    hasSlackAppToken: boolean;
  };
  recommendedScopes: {
    bot: string[];
    app: string[];
  };
  checklist: RuntimeSlackOnboardingChecklistItem[];
}

export interface RuntimeSlackOnboardingCheckResponse {
  status: "ready" | "needs_config";
  missing: string[];
  message: string;
}

export interface ModelCatalogItem {
  id: string;
  name: string;
  description: string;
  promptPricePer1M: number | null;
  completionPricePer1M: number | null;
  createdAt: string | null;
}

export interface ModelCatalogResponse {
  provider: string;
  source: string;
  fetchedAt: string;
  count: number;
  items: ModelCatalogItem[];
}

export interface RuntimeCatalogResponse {
  items: RuntimeCatalogItem[];
}

export interface RuntimeDiagnostics {
  containerCli: string;
  processMode: string;
  image: {
    name: string;
    status: string;
    message?: string;
  };
  network: {
    name: string;
    status: string;
    message?: string;
  };
  container?: {
    name: string;
    status: string;
    running: boolean;
    message?: string;
  };
  instanceId: string | null;
  instanceStatus: RuntimeStatus | null;
}

export interface PairingInfoResponse {
  requirePairing: boolean;
  pairingCode?: string;
  message?: string;
  logExcerpt?: string;
}

export interface RuntimeContainerLogsResponse {
  containerName: string;
  tail: number;
  logs: string;
  fetchedAt: string;
}

export interface ReconcileResponse {
  dryRun: boolean;
  scope: "instance" | "org";
  summary: {
    checked: number;
    updated: number;
    unchanged: number;
    errors: number;
  };
  actions: Array<Record<string, unknown>>;
}

export interface RuntimeEventsExportResponse {
  exportedAt: string;
  retention: {
    maxEntries: number;
    maxAgeDays: number;
  };
  filters: {
    instanceId?: string;
  };
  items: RuntimeEvent[];
}

export interface RepairResponse {
  outcome: "succeeded" | "failed";
  statusAfter: RuntimeStatus | "running" | "error";
  message?: string;
  steps: Array<{
    step: string;
    ok: boolean;
    detail: string;
  }>;
}

export interface ProvisionJobCreateInput {
  tenantId: string;
  agentId: string;
  runtimeType: RuntimeType;
  llmProvider: string;
  llmModel: string;
  llmApiKey: string;
  telegramEnabled: boolean;
  telegramBotToken?: string;
  telegramAllowFrom: string[];
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
  dailyMessageLimit?: number;
  dailyTokenLimit?: number;
  monthlySpendLimitUsd?: number;
  runtimeOptions?: Record<string, unknown>;
  runtimeSecrets?: Record<string, string>;
}

export interface ProvisionJobCreateResponse {
  provisionRequest: ProvisionRequest;
  job: ProvisionJob;
  instance: RuntimeInstance;
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  failureHint?: string;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.failureHint =
      payload && typeof payload === "object" && typeof (payload as { failureHint?: unknown }).failureHint === "string"
        ? (payload as { failureHint: string }).failureHint
        : undefined;
  }
}

export async function getSessionProfile(): Promise<SessionProfile> {
  return apiRequest<SessionProfile>("/api/auth/me");
}

export async function getSettingsConfig(): Promise<SettingsConfigSnapshot> {
  return apiRequest<SettingsConfigSnapshot>("/api/settings/config");
}

export async function updateSettingsConfig(input: {
  values: Record<string, string | boolean>;
}): Promise<SettingsConfigSnapshot> {
  return apiRequest<SettingsConfigSnapshot>("/api/settings/config", {
    method: "POST",
    body: input,
  });
}

export async function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/api/healthz");
}

export async function listTenants(): Promise<Tenant[]> {
  const response = await apiRequest<{ items: Tenant[] }>("/api/tenants");
  return response.items;
}

export async function createTenant(input: { name: string; kind?: "default" | "dedicated" }): Promise<Tenant> {
  return apiRequest<Tenant>("/api/tenants", {
    method: "POST",
    body: input,
  });
}

export async function listAgents(tenantId?: string): Promise<Agent[]> {
  const suffix = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const response = await apiRequest<{ items: Agent[] }>(`/api/agents${suffix}`);
  return response.items;
}

export async function listAgentPresets(): Promise<AgentPreset[]> {
  const response = await apiRequest<{ items: AgentPreset[] }>("/api/agent-presets");
  return response.items;
}

export async function listAgentTypes(): Promise<AgentTypeCatalogItem[]> {
  const response = await apiRequest<{ items: AgentTypeCatalogItem[] }>("/api/agent-types");
  return response.items;
}

export async function listAdminAgentPresets(): Promise<AdminAgentPreset[]> {
  const response = await apiRequest<{ items: AdminAgentPreset[] }>("/api/admin/agent-presets");
  return response.items;
}

export async function exportAdminAgentPresets(): Promise<AgentPresetExportSnapshot> {
  return apiRequest<AgentPresetExportSnapshot>("/api/admin/agent-presets/export");
}

export async function createAdminAgentPreset(
  input: Omit<AdminAgentPreset, "createdAt" | "updatedAt">
): Promise<AdminAgentPreset> {
  return apiRequest<AdminAgentPreset>("/api/admin/agent-presets", {
    method: "POST",
    body: input,
  });
}

export async function updateAdminAgentPreset(
  presetId: string,
  input: Partial<Omit<AdminAgentPreset, "id" | "createdAt" | "updatedAt">>
): Promise<AdminAgentPreset> {
  return apiRequest<AdminAgentPreset>(`/api/admin/agent-presets/${encodeURIComponent(presetId)}`, {
    method: "POST",
    body: input,
  });
}

export async function reorderAdminAgentPresets(presetIds: string[]): Promise<AdminAgentPreset[]> {
  const response = await apiRequest<{ items: AdminAgentPreset[] }>("/api/admin/agent-presets/reorder", {
    method: "POST",
    body: { presetIds },
  });
  return response.items;
}

export async function archiveAdminAgentPreset(presetId: string, archived: boolean): Promise<AdminAgentPreset> {
  return apiRequest<AdminAgentPreset>(`/api/admin/agent-presets/${encodeURIComponent(presetId)}/archive`, {
    method: "POST",
    body: { archived },
  });
}

export async function importAdminAgentPresets(input: {
  items: Array<Omit<AdminAgentPreset, "createdAt" | "updatedAt">>;
  replaceExisting?: boolean;
}): Promise<{
  summary: {
    imported: number;
    replaceExisting: boolean;
  };
  items: AdminAgentPreset[];
}> {
  return apiRequest("/api/admin/agent-presets/import", {
    method: "POST",
    body: input,
  });
}

export async function createAgent(input: {
  tenantId: string;
  name: string;
  avatar?: AgentAvatar;
  agentType?: Agent["agentType"];
  skills?: string[];
  roleTitle?: string;
  presetId?: string;
  channel: Channel;
}): Promise<Agent> {
  return apiRequest<Agent>("/api/agents", {
    method: "POST",
    body: input,
  });
}

export async function updateAgent(
  agentId: string,
  input: {
    name?: string;
    roleTitle?: string;
    status?: Agent["status"];
    avatar?: AgentAvatar;
  }
): Promise<Agent> {
  return apiRequest<Agent>(`/api/agents/${encodeURIComponent(agentId)}`, {
    method: "POST",
    body: input,
  });
}

export async function listRuntimeInstances(tenantId?: string): Promise<RuntimeInstance[]> {
  const suffix = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const response = await apiRequest<{ items: RuntimeInstance[] }>(`/api/runtime/instances${suffix}`);
  return response.items;
}

export async function listRuntimeCatalog(): Promise<RuntimeCatalogItem[]> {
  const response = await apiRequest<RuntimeCatalogResponse>("/api/runtime/catalog");
  return response.items;
}

export async function getRuntimeInstance(instanceId: string): Promise<RuntimeInstance> {
  return apiRequest<RuntimeInstance>(`/api/runtime/instances/${encodeURIComponent(instanceId)}`);
}

export async function listRuntimeSharedFiles(instanceId: string): Promise<RuntimeSharedFile[]> {
  const response = await apiRequest<{ items: RuntimeSharedFile[] }>(
    `/api/runtime/instances/${encodeURIComponent(instanceId)}/files`
  );
  return response.items;
}

export async function uploadRuntimeSharedFiles(
  instanceId: string,
  files: File[]
): Promise<RuntimeSharedFile[]> {
  const payloadFiles = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      contentBase64: encodeBufferAsBase64(await file.arrayBuffer()),
    }))
  );

  const response = await apiRequest<{ items: RuntimeSharedFile[] }>(
    `/api/runtime/instances/${encodeURIComponent(instanceId)}/files`,
    {
      method: "POST",
      body: { files: payloadFiles },
    }
  );
  return response.items;
}

export async function deleteRuntimeSharedFile(instanceId: string, fileId: string): Promise<void> {
  await apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
}

export async function downloadRuntimeSharedFile(instanceId: string, fileId: string): Promise<Blob> {
  const response = await fetch(
    `/api/runtime/instances/${encodeURIComponent(instanceId)}/files/${encodeURIComponent(fileId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/octet-stream",
      },
    }
  );

  if (!response.ok) {
    const payload = await safeParsePayload(response);
    throw new ApiError(resolveErrorMessage(payload, response.status), response.status, payload);
  }

  return response.blob();
}

export async function getRuntimeStats(instanceId: string): Promise<RuntimeStats> {
  return apiRequest<RuntimeStats>(`/api/runtime/instances/${encodeURIComponent(instanceId)}/stats`);
}

export async function listProvisionJobs(): Promise<ProvisionJob[]> {
  const response = await apiRequest<{ items: ProvisionJob[] }>("/api/runtime/provision-jobs");
  return response.items;
}

export async function listProvisionRequests(): Promise<ProvisionRequest[]> {
  const response = await apiRequest<{ items: ProvisionRequest[] }>("/api/runtime/provision-requests");
  return response.items;
}

export async function getProvisionRequest(requestId: string): Promise<ProvisionRequest> {
  return apiRequest<ProvisionRequest>(`/api/runtime/provision-requests/${encodeURIComponent(requestId)}`);
}

export async function getProvisionJob(jobId: string): Promise<ProvisionJob> {
  return apiRequest<ProvisionJob>(`/api/runtime/provision-jobs/${encodeURIComponent(jobId)}`);
}

export async function createProvisionJob(input: ProvisionJobCreateInput): Promise<ProvisionJobCreateResponse> {
  return apiRequest<ProvisionJobCreateResponse>("/api/runtime/provision-jobs", {
    method: "POST",
    body: input,
  });
}

export async function listRuntimeEvents(instanceId?: string, limit = 100): Promise<RuntimeEvent[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (instanceId) {
    params.set("instanceId", instanceId);
  }
  const response = await apiRequest<{ items: RuntimeEvent[] }>(`/api/runtime/events?${params.toString()}`);
  return response.items;
}

export async function exportRuntimeEvents(instanceId?: string): Promise<RuntimeEventsExportResponse> {
  const suffix = instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : "";
  return apiRequest<RuntimeEventsExportResponse>(`/api/runtime/events/export${suffix}`);
}

export async function getRuntimeDiagnostics(instanceId?: string): Promise<RuntimeDiagnostics> {
  const suffix = instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : "";
  return apiRequest<RuntimeDiagnostics>(`/api/runtime/diagnostics${suffix}`);
}

export async function getRuntimeContainerLogs(
  instanceId: string,
  tail = 250
): Promise<RuntimeContainerLogsResponse> {
  const params = new URLSearchParams();
  params.set("tail", String(tail));
  return apiRequest<RuntimeContainerLogsResponse>(
    `/api/runtime/instances/${encodeURIComponent(instanceId)}/logs?${params.toString()}`
  );
}

export async function getRuntimeHealth(instanceId: string): Promise<Record<string, unknown>> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/health`);
}

export async function listRuntimeChatMessages(
  instanceId: string,
  limit = 100
): Promise<RuntimeChatMessage[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  const response = await apiRequest<{ items: RuntimeChatMessage[] }>(
    `/api/runtime/instances/${encodeURIComponent(instanceId)}/chat-messages?${params.toString()}`
  );
  return response.items;
}

export async function sendRuntimeChat(
  instanceId: string,
  input: RuntimeChatSendInput
): Promise<RuntimeChatSendResponse> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/chat`, {
    method: "POST",
    body: input,
  });
}

export async function getRuntimePairingInfo(instanceId: string): Promise<PairingInfoResponse> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/pairing-info`);
}

export async function startRuntime(instanceId: string): Promise<RuntimeInstance> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/start`, {
    method: "POST",
    body: {},
  });
}

export async function stopRuntime(instanceId: string): Promise<RuntimeInstance> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/stop`, {
    method: "POST",
    body: {},
  });
}

export async function restartRuntime(instanceId: string): Promise<RuntimeInstance> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/restart`, {
    method: "POST",
    body: {},
  });
}

export async function syncRuntime(instanceId: string): Promise<Record<string, unknown>> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/sync`, {
    method: "POST",
    body: {},
  });
}

export async function repairRuntime(instanceId: string): Promise<RepairResponse> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/repair`, {
    method: "POST",
    body: {},
  });
}

export async function deleteRuntime(instanceId: string, destroyVolume: boolean): Promise<{
  deleted: RuntimeInstance;
}> {
  return apiRequest(
    `/api/runtime/instances/${encodeURIComponent(instanceId)}?destroyVolume=${destroyVolume ? "true" : "false"}`,
    {
      method: "DELETE",
    }
  );
}

export async function reconcileRuntime(input: {
  dryRun: boolean;
  instanceId?: string;
}): Promise<ReconcileResponse> {
  return apiRequest("/api/runtime/reconcile", {
    method: "POST",
    body: input,
  });
}

export async function pairRuntime(instanceId: string, pairingCode: string): Promise<Record<string, unknown>> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/pair`, {
    method: "POST",
    body: { pairingCode },
  });
}

export async function setRuntimeToken(instanceId: string, token: string): Promise<{
  status: string;
  hasToken: boolean;
}> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/token`, {
    method: "POST",
    body: { token },
  });
}

export async function sendRuntimeWebhook(
  instanceId: string,
  input: { message: string; token?: string }
): Promise<Record<string, unknown>> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/webhook`, {
    method: "POST",
    body: input,
  });
}

export async function updateRuntimeLlm(
  instanceId: string,
  input: { provider: string; model: string; apiKey: string }
): Promise<RuntimeInstance> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/llm`, {
    method: "POST",
    body: input,
  });
}

export async function updateRuntimeTelegram(
  instanceId: string,
  input: {
    enabled: boolean;
    telegramBotToken?: string;
    telegramAllowFrom: string[];
    telegramReplyInPrivate?: boolean;
  }
): Promise<RuntimeInstance> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/telegram`, {
    method: "POST",
    body: input,
  });
}

export async function updateRuntimeSlack(
  instanceId: string,
  input: {
    enabled: boolean;
    slackBotToken?: string;
    slackAppToken?: string;
    slackSigningSecret?: string;
    slackAllowedChannelIds?: string[];
    slackAllowedUserIds?: string[];
    slackReplyInThread?: boolean;
  }
): Promise<RuntimeInstance> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/slack`, {
    method: "POST",
    body: input,
  });
}

export async function getRuntimeSlackOnboarding(
  instanceId: string
): Promise<RuntimeSlackOnboarding> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/slack/onboarding`);
}

export async function checkRuntimeSlackOnboarding(
  instanceId: string
): Promise<RuntimeSlackOnboardingCheckResponse> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/slack/onboarding/check`, {
    method: "POST",
    body: {},
  });
}

export async function updateRuntimeDiscord(
  instanceId: string,
  input: {
    enabled: boolean;
    discordBotToken?: string;
    discordAllowedGuildIds?: string[];
    discordAllowedChannelIds?: string[];
    discordReplyInThread?: boolean;
  }
): Promise<RuntimeInstance> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/discord`, {
    method: "POST",
    body: input,
  });
}

export async function updateRuntimeLimits(
  instanceId: string,
  input: {
    dailyMessageLimit?: number;
    dailyTokenLimit?: number;
    monthlySpendLimitUsd?: number;
  }
): Promise<RuntimeInstance> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/limits`, {
    method: "POST",
    body: input,
  });
}

export async function updateRuntimeConfig(
  instanceId: string,
  input: {
    runtimeOptions: Record<string, unknown>;
    runtimeSecrets?: Record<string, string>;
  }
): Promise<RuntimeInstance> {
  return apiRequest(`/api/runtime/instances/${encodeURIComponent(instanceId)}/runtime-config`, {
    method: "POST",
    body: input,
  });
}

export async function getModelCatalog(provider: string, apiKey?: string): Promise<ModelCatalogResponse> {
  return apiRequest<ModelCatalogResponse>(
    `/api/runtime/model-catalog?provider=${encodeURIComponent(provider)}&limit=60`,
    {
      headers: {
        "x-openrouter-api-key": apiKey?.trim() || undefined,
      },
    }
  );
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function getRuntimeChatErrorMessage(
  error: unknown,
  fallback = "Could not send message"
): string {
  const message = getErrorMessage(error, fallback);
  if (
    /openclaw gateway socket/i.test(message) ||
    /openclaw gateway did not send connect challenge/i.test(message) ||
    /openclaw gateway is not reachable yet/i.test(message)
  ) {
    return "Runtime chat is unavailable because the helper gateway is not reachable. Start or repair the helper in Advanced, then try again.";
  }
  return message;
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      if (value) {
        headers.set(key, value);
      }
    }
  }

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    signal: options.signal,
  };

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, init);
  const payload = await safeParsePayload(response);
  if (!response.ok) {
    throw new ApiError(resolveErrorMessage(payload, response.status), response.status, payload);
  }

  return payload as T;
}

async function safeParsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      message: text,
    };
  }
}

function resolveErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string") {
    return (payload as { message: string }).message;
  }
  return `Request failed (status=${status})`;
}

function encodeBufferAsBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
