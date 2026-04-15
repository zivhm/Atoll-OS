import type {
  Channel,
  CreateAgentInput,
  CreateTenantInput,
  RuntimeInstance,
  RuntimeType
} from "./store.js";
import { getAgentTypeById, normalizeAgentSkills, normalizeAgentTypeId } from "./agent-types.js";
import { resolveIdentityColorToken } from "./identity-colors.js";
import {
  getRuntimeConnector,
  isRuntimeType,
  normalizeRuntimeType,
  type RuntimeCatalogItem
} from "./runtime-kind.js";

const TELEGRAM_BOT_TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/u;
const SUPPORTED_LLM_PROVIDER = "openrouter";

export type RuntimeCreateDefaults = {
  runtimeProvider: string;
  runtimeModel: string;
  runtimeTelegramModelOverride?: string;
  runtimeApiKey: string;
  supportedRuntimeTypes: RuntimeType[];
  runtimeCatalog: RuntimeCatalogItem[];
  runtimeGatewayPort: number;
  runtimeRequirePairing: boolean;
  runtimeAllowPublicBind: boolean;
};

export function parseCreateRuntimeInstanceInput(
  payload: unknown,
  runtimeDefaults: RuntimeCreateDefaults
): {
  tenantId: string;
  agentId: string;
  runtimeType: RuntimeType;
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
  discordAllowedUserIds: string[];
  discordAllowedGuildIds: string[];
  discordAllowedChannelIds: string[];
  discordReplyInThread: boolean;
  discordRequireMention: boolean;
  dailyMessageLimit?: number;
  dailyTokenLimit?: number;
  monthlySpendLimitUsd?: number;
  runtimeOptions: Record<string, unknown>;
  runtimeSecrets?: Record<string, string>;
} {
  const body = payload as {
    tenantId?: unknown;
    agentId?: unknown;
    provider?: unknown;
    model?: unknown;
    apiKey?: unknown;
    llmProvider?: unknown;
    llmModel?: unknown;
    llmApiKey?: unknown;
    runtimeType?: unknown;
    runtime?: unknown;
    runtimeFlavor?: unknown;
    runtimeGatewayPort?: unknown;
    gatewayPort?: unknown;
    port?: unknown;
    runtimeRequirePairing?: unknown;
    requirePairing?: unknown;
    runtimeAllowPublicBind?: unknown;
    allowPublicBind?: unknown;
    telegramEnabled?: unknown;
    enabled?: unknown;
    telegramBotToken?: unknown;
    botToken?: unknown;
    telegramAllowFrom?: unknown;
    allowFrom?: unknown;
    telegramReplyInPrivate?: unknown;
    replyInPrivate?: unknown;
    slackEnabled?: unknown;
    slackBotToken?: unknown;
    slackAppToken?: unknown;
    slackSigningSecret?: unknown;
    slackAllowedChannelIds?: unknown;
    slackAllowedUserIds?: unknown;
    slackReplyInThread?: unknown;
    discordEnabled?: unknown;
    discordBotToken?: unknown;
    discordAllowedUserIds?: unknown;
    discordAllowedGuildIds?: unknown;
    discordAllowedChannelIds?: unknown;
    discordReplyInThread?: unknown;
    discordRequireMention?: unknown;
    dailyMessageLimit?: unknown;
    dailyTokenLimit?: unknown;
    monthlySpendLimitUsd?: unknown;
    runtimeOptions?: unknown;
    runtimeSecrets?: unknown;
  };

  const tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
  const agentId = typeof body?.agentId === "string" ? body.agentId.trim() : "";
  const requestedRuntimeType =
    getOptionalTrimmedString(body?.runtimeType) ??
    getOptionalTrimmedString(body?.runtime) ??
    getOptionalTrimmedString(body?.runtimeFlavor);
  if (requestedRuntimeType && !isRuntimeType(requestedRuntimeType)) {
    throw new Error(`Validation failed: runtime type '${requestedRuntimeType}' is not supported`);
  }
  const runtimeType = normalizeRuntimeType(requestedRuntimeType);
  const connector =
    runtimeDefaults.runtimeCatalog.find((item) => item.id === runtimeType) ??
    getRuntimeConnector(runtimeType);
  const llmProviderInput =
    getOptionalTrimmedString(body?.llmProvider) ??
    getOptionalTrimmedString(body?.provider) ??
    runtimeDefaults.runtimeProvider;
  const llmProvider = normalizeSupportedLlmProvider(llmProviderInput);
  const llmModelInput =
    getOptionalTrimmedString(body?.llmModel) ??
    getOptionalTrimmedString(body?.model) ??
    runtimeDefaults.runtimeModel;
  const llmApiKey =
    getOptionalTrimmedString(body?.llmApiKey) ??
    getOptionalTrimmedString(body?.apiKey) ??
    runtimeDefaults.runtimeApiKey;
  const providedPairing =
    body?.runtimeRequirePairing !== undefined || body?.requirePairing !== undefined;
  const gatewayPort = parsePositiveIntegerUnknown(
    body?.runtimeGatewayPort ?? body?.gatewayPort ?? body?.port,
    connector.defaultGatewayPort ?? runtimeDefaults.runtimeGatewayPort
  );
  const requirePairing = parseBooleanUnknown(
    body?.runtimeRequirePairing ?? body?.requirePairing,
    connector.defaultRequirePairing
  );
  const allowPublicBind = parseBooleanUnknown(
    body?.runtimeAllowPublicBind ?? body?.allowPublicBind,
    connector.defaultAllowPublicBind
  );
  const telegramEnabled = parseBooleanUnknown(body?.telegramEnabled ?? body?.enabled, false);
  const telegramBotToken =
    getOptionalTrimmedString(body?.telegramBotToken) ?? getOptionalTrimmedString(body?.botToken);
  const telegramAllowFrom =
    parseAllowFromList(body?.telegramAllowFrom) ?? parseAllowFromList(body?.allowFrom) ?? [];
  const providedReplyInPrivate =
    body?.telegramReplyInPrivate !== undefined || body?.replyInPrivate !== undefined;
  const telegramReplyInPrivate = parseBooleanUnknown(
    body?.telegramReplyInPrivate ?? body?.replyInPrivate,
    connector.capabilities.telegramReplyInPrivate
  );
  const slackEnabled = parseBooleanUnknown(body?.slackEnabled, false);
  const slackBotToken = getOptionalTrimmedString(body?.slackBotToken);
  const slackAppToken =
    getOptionalTrimmedString(body?.slackAppToken) ??
    getOptionalTrimmedString(body?.slackSigningSecret);
  const slackAllowedChannelIds = parseIdListUnknown(body?.slackAllowedChannelIds) ?? [];
  const slackAllowedUserIds = parseIdListUnknown(body?.slackAllowedUserIds) ?? [];
  const slackReplyInThread = parseBooleanUnknown(body?.slackReplyInThread, true);
  const discordEnabled = parseBooleanUnknown(body?.discordEnabled, false);
  const discordBotToken = getOptionalTrimmedString(body?.discordBotToken);
  const discordAllowedUserIds = parseIdListUnknown(body?.discordAllowedUserIds) ?? [];
  const discordAllowedGuildIds = parseIdListUnknown(body?.discordAllowedGuildIds) ?? [];
  const discordAllowedChannelIds = parseIdListUnknown(body?.discordAllowedChannelIds) ?? [];
  const discordReplyInThread = parseBooleanUnknown(body?.discordReplyInThread, true);
  const discordRequireMention = parseBooleanUnknown(body?.discordRequireMention, true);
  const dailyMessageLimit = parseOptionalLimitUnknown(body?.dailyMessageLimit);
  const dailyTokenLimit = parseOptionalLimitUnknown(body?.dailyTokenLimit);
  const monthlySpendLimitUsd = parseOptionalLimitUnknown(body?.monthlySpendLimitUsd);
  const runtimeOptions = parseRuntimeOptionsRecord(body?.runtimeOptions);
  const runtimeSecrets = parseRuntimeSecretsRecord(body?.runtimeSecrets);
  const llmModel = resolveTelegramCompatibleModel({
    provider: llmProvider,
    model: llmModelInput,
    telegramEnabled,
    telegramModelOverride: runtimeDefaults.runtimeTelegramModelOverride
  });

  if (!tenantId) {
    throw new Error("Validation failed: tenantId is required");
  }

  if (!agentId) {
    throw new Error("Validation failed: agentId is required");
  }

  if (!llmModel) {
    throw new Error("Validation failed: llm model is required");
  }

  if (!llmApiKey) {
    throw new Error("Validation failed: llm api key is required");
  }

  if (!runtimeDefaults.supportedRuntimeTypes.includes(runtimeType)) {
    throw new Error(
      `Validation failed: runtime type '${runtimeType}' is not enabled on this host`
    );
  }

  if (telegramEnabled && !telegramBotToken) {
    throw new Error("Validation failed: telegram botToken is required when enabled");
  }

  if (slackEnabled && !slackBotToken) {
    throw new Error("Validation failed: slackBotToken is required when enabled");
  }

  if (slackEnabled && !slackAppToken) {
    throw new Error("Validation failed: slackAppToken is required when enabled");
  }

  if (!connector.capabilities.pairingAction && providedPairing && requirePairing) {
    throw new Error(`Validation failed: ${runtimeType} does not support pairing`);
  }

  if (!connector.capabilities.telegramReplyInPrivate && providedReplyInPrivate) {
    throw new Error(
      `Validation failed: ${runtimeType} does not support telegramReplyInPrivate`
    );
  }

  return {
    tenantId,
    agentId,
    runtimeType,
    llmProvider,
    llmModel,
    llmApiKey,
    gatewayPort,
    requirePairing,
    allowPublicBind,
    telegramEnabled,
    telegramBotToken,
    telegramAllowFrom: telegramEnabled && telegramAllowFrom.length === 0 ? ["*"] : telegramAllowFrom,
    telegramReplyInPrivate,
    slackEnabled,
    slackBotToken,
    slackAppToken,
    slackAllowedChannelIds,
    slackAllowedUserIds,
    slackReplyInThread,
    discordEnabled,
    discordBotToken,
    discordAllowedUserIds,
    discordAllowedGuildIds,
    discordAllowedChannelIds,
    discordReplyInThread,
    discordRequireMention,
    dailyMessageLimit,
    dailyTokenLimit,
    monthlySpendLimitUsd,
    runtimeOptions,
    runtimeSecrets
  };
}

export function parseCreateTenantInput(payload: unknown): CreateTenantInput {
  const body = payload as { name?: unknown; kind?: unknown };
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const kind = body?.kind === "dedicated" ? "dedicated" : body?.kind === "default" ? "default" : undefined;
  if (name.length < 2 || name.length > 120) {
    throw new Error("Validation failed: name must be 2-120 characters");
  }
  return { name, kind };
}

export function parseCreateAgentInput(payload: unknown): CreateAgentInput {
  const body = payload as {
    tenantId?: unknown;
    name?: unknown;
    roleTitle?: unknown;
    presetId?: unknown;
    agentType?: unknown;
    skills?: unknown;
    avatar?: unknown;
    style?: unknown;
    agentRoleTitle?: unknown;
    channel?: unknown;
  };
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const presetId = getOptionalTrimmedString(body?.presetId);
  const requestedAgentType = getOptionalTrimmedString(body?.agentType);
  if (requestedAgentType && !getAgentTypeById(requestedAgentType)) {
    throw new Error(`Validation failed: agentType '${requestedAgentType}' is not supported`);
  }
  if (body?.skills !== undefined && !Array.isArray(body.skills)) {
    throw new Error("Validation failed: skills must be an array of strings");
  }
  const rawSkills = Array.isArray(body?.skills)
    ? body.skills.map((item) => (typeof item === "string" ? item.trim() : ""))
    : [];
  if (rawSkills.some((item) => !item)) {
    throw new Error("Validation failed: skills must contain non-empty strings");
  }
  const skills = normalizeAgentSkills(rawSkills);
  const avatar = parseAgentAvatar(body?.avatar);
  const roleTitle =
    getOptionalTrimmedString(body?.roleTitle) ??
    getOptionalTrimmedString(body?.style) ??
    getOptionalTrimmedString(body?.agentRoleTitle);
  const channel = normalizeChannel(body?.channel);

  if (!tenantId) {
    throw new Error("Validation failed: tenantId is required");
  }
  if (name.length < 2 || name.length > 120) {
    throw new Error("Validation failed: name must be 2-120 characters");
  }
  if (roleTitle && roleTitle.length > 160) {
    throw new Error("Validation failed: roleTitle must be 160 characters or less");
  }
  if (presetId && presetId.length > 120) {
    throw new Error("Validation failed: presetId must be 120 characters or less");
  }
  if (skills.length > 25) {
    throw new Error("Validation failed: no more than 25 skills may be assigned");
  }
  if (skills.some((skill) => skill.length < 2 || skill.length > 120)) {
    throw new Error("Validation failed: each skill must be 2-120 characters");
  }

  return {
    tenantId,
    name,
    roleTitle,
    presetId,
    avatar,
    agentType: normalizeAgentTypeId(requestedAgentType),
    skills,
    channel
  };
}

export function parseUpdateAgentInput(payload: unknown): Partial<{
  name: string;
  roleTitle: string;
  status: "running" | "paused";
  avatar: NonNullable<CreateAgentInput["avatar"]>;
}> {
  const body = payload as {
    name?: unknown;
    roleTitle?: unknown;
    status?: unknown;
    avatar?: unknown;
  };

  const name = getOptionalTrimmedString(body?.name);
  const roleTitle = getOptionalTrimmedString(body?.roleTitle);
  const status = body?.status === "running" || body?.status === "paused" ? body.status : undefined;
  const avatar = body?.avatar === undefined ? undefined : parseAgentAvatar(body.avatar);

  if (name !== undefined && (name.length < 2 || name.length > 120)) {
    throw new Error("Validation failed: name must be 2-120 characters");
  }
  if (roleTitle !== undefined && roleTitle.length > 160) {
    throw new Error("Validation failed: roleTitle must be 160 characters or less");
  }
  if (body?.status !== undefined && !status) {
    throw new Error("Validation failed: status must be 'running' or 'paused'");
  }

  return {
    name,
    roleTitle,
    status,
    avatar
  };
}

function parseAgentAvatar(value: unknown): NonNullable<CreateAgentInput["avatar"]> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Validation failed: avatar must be an object");
  }

  const avatar = value as {
    style?: unknown;
    seed?: unknown;
    backgroundColor?: unknown;
  };
  const style = getOptionalTrimmedString(avatar.style);
  const seed = getOptionalTrimmedString(avatar.seed);
  const backgroundColor = getOptionalTrimmedString(avatar.backgroundColor)?.toLowerCase();

  if (style !== "notionists") {
    throw new Error("Validation failed: avatar style must be 'notionists'");
  }
  if (!seed || seed.length > 120) {
    throw new Error("Validation failed: avatar seed must be 1-120 characters");
  }
  if (!backgroundColor || !/^[a-f0-9]{6}$/u.test(backgroundColor)) {
    throw new Error("Validation failed: avatar backgroundColor must be a 6 character hex color");
  }

  return {
    style,
    seed,
    backgroundColor
  };
}

export function parseAgentPresetParams(payload: unknown): { presetId: string } {
  const params = payload as { presetId?: unknown };
  const presetId = getOptionalTrimmedString(params?.presetId) ?? "";
  if (!presetId) {
    throw new Error("Validation failed: presetId is required");
  }
  return { presetId };
}

export function parseAgentPresetInput(
  payload: unknown,
  options: { partial?: boolean } = {}
): {
  id?: string;
  name?: string;
  description?: string;
  color?: string;
  category?: string;
  sourceRepoUrl?: string;
  sourcePath?: string;
  summary?: string;
  suggestedRoleTitle?: string;
  recommendedSkills?: string[];
  identity?: string;
  soul?: string;
  tools?: string;
  active?: boolean;
  position?: number;
} {
  const body = payload as {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    color?: unknown;
    category?: unknown;
    sourceRepoUrl?: unknown;
    sourcePath?: unknown;
    summary?: unknown;
    suggestedRoleTitle?: unknown;
    recommendedSkills?: unknown;
    identity?: unknown;
    soul?: unknown;
    tools?: unknown;
    active?: unknown;
    position?: unknown;
  };

  const partial = options.partial ?? false;
  const id = getOptionalTrimmedString(body?.id);
  const name = getOptionalTrimmedString(body?.name);
  const description = getOptionalTrimmedString(body?.description);
  const color = getOptionalTrimmedString(body?.color);
  const category = getOptionalTrimmedString(body?.category);
  const sourceRepoUrl = getOptionalTrimmedString(body?.sourceRepoUrl);
  const sourcePath = getOptionalTrimmedString(body?.sourcePath);
  const summary = getOptionalTrimmedString(body?.summary);
  const suggestedRoleTitle = getOptionalTrimmedString(body?.suggestedRoleTitle);
  if (body?.recommendedSkills !== undefined && !Array.isArray(body.recommendedSkills)) {
    throw new Error("Validation failed: preset recommendedSkills must be an array of strings");
  }
  const rawRecommendedSkills = Array.isArray(body?.recommendedSkills)
    ? body.recommendedSkills.map((item) => (typeof item === "string" ? item.trim() : ""))
    : undefined;
  if (rawRecommendedSkills?.some((item) => !item)) {
    throw new Error("Validation failed: preset recommendedSkills must contain non-empty strings");
  }
  const recommendedSkills =
    rawRecommendedSkills === undefined ? undefined : normalizeAgentSkills(rawRecommendedSkills);
  const identity = getOptionalTrimmedString(body?.identity);
  const soul = getOptionalTrimmedString(body?.soul);
  const tools = getOptionalTrimmedString(body?.tools);
  const active = body?.active === undefined ? undefined : parseBooleanUnknown(body.active, true);
  const position =
    body?.position === undefined ? undefined : parseNonNegativeInteger(String(body.position), 0);

  if (!partial || id !== undefined) {
    if (!id || id.length < 2 || id.length > 120) {
      throw new Error("Validation failed: preset id must be 2-120 characters");
    }
  }
  if (!partial || name !== undefined) {
    if (!name || name.length < 2 || name.length > 120) {
      throw new Error("Validation failed: preset name must be 2-120 characters");
    }
  }
  if (!partial || description !== undefined) {
    if (!description || description.length < 10 || description.length > 280) {
      throw new Error("Validation failed: preset description must be 10-280 characters");
    }
  }
  if (!partial || color !== undefined) {
    if (!color || !resolveIdentityColorToken(color)) {
      throw new Error("Validation failed: preset color must be a supported palette token");
    }
  }
  if (!partial || category !== undefined) {
    if (!category || category.length < 2 || category.length > 40) {
      throw new Error("Validation failed: preset category must be 2-40 characters");
    }
  }
  if (sourceRepoUrl && sourceRepoUrl.length > 300) {
    throw new Error("Validation failed: preset sourceRepoUrl must be 300 characters or less");
  }
  if (sourcePath && sourcePath.length > 200) {
    throw new Error("Validation failed: preset sourcePath must be 200 characters or less");
  }
  if (!partial || summary !== undefined) {
    if (!summary || summary.length < 10 || summary.length > 280) {
      throw new Error("Validation failed: preset summary must be 10-280 characters");
    }
  }
  if (!partial || suggestedRoleTitle !== undefined) {
    if (!suggestedRoleTitle || suggestedRoleTitle.length < 4 || suggestedRoleTitle.length > 200) {
      throw new Error("Validation failed: preset suggestedRoleTitle must be 4-200 characters");
    }
  }
  if (recommendedSkills !== undefined) {
    if (recommendedSkills.length > 25) {
      throw new Error("Validation failed: preset recommendedSkills may not exceed 25 entries");
    }
    if (recommendedSkills.some((skill) => skill.length < 2 || skill.length > 300)) {
      throw new Error("Validation failed: preset recommendedSkills entries must be 2-300 characters");
    }
  }
  if (!partial || identity !== undefined) {
    if (!identity || identity.length < 20) {
      throw new Error("Validation failed: preset identity is required");
    }
  }
  if (!partial || soul !== undefined) {
    if (!soul || soul.length < 20) {
      throw new Error("Validation failed: preset soul is required");
    }
  }
  if (tools !== undefined) {
    if (!tools || tools.length < 20) {
      throw new Error("Validation failed: preset tools is required");
    }
  }

  return {
    id,
    name,
    description,
    color: color ? resolveIdentityColorToken(color) : undefined,
    category,
    sourceRepoUrl,
    sourcePath,
    summary,
    suggestedRoleTitle,
    recommendedSkills,
    identity,
    soul,
    tools,
    active,
    position
  };
}

export function parseAgentPresetReorderInput(payload: unknown): { presetIds: string[] } {
  const body = payload as { presetIds?: unknown };
  const presetIds = Array.isArray(body?.presetIds)
    ? body.presetIds
        .map((value) => getOptionalTrimmedString(value))
        .filter((value): value is string => Boolean(value))
    : [];
  if (presetIds.length === 0) {
    throw new Error("Validation failed: presetIds array is required");
  }
  return { presetIds };
}

export function parseAgentPresetArchiveInput(payload: unknown): { archived: boolean } {
  const body = payload as { archived?: unknown };
  return {
    archived: parseBooleanUnknown(body?.archived, true)
  };
}

export function parseAgentPresetImportInput(payload: unknown): {
  items: Array<{
    id: string;
    name: string;
    description: string;
    color: string;
    category: string;
    sourceRepoUrl?: string;
    sourcePath?: string;
    summary: string;
    suggestedRoleTitle: string;
    recommendedSkills: string[];
    identity: string;
    soul: string;
    tools: string;
    active: boolean;
    position: number;
  }>;
  replaceExisting: boolean;
} {
  const body = payload as {
    items?: unknown;
    replaceExisting?: unknown;
  };
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    throw new Error("Validation failed: items array is required");
  }

  return {
    items: items.map((item, index) => {
      const parsed = parseAgentPresetInput(item);
      return {
        id: parsed.id ?? "",
        name: parsed.name ?? "",
        description: parsed.description ?? "",
        color: parsed.color ?? "neutral",
        category: parsed.category ?? "general",
        sourceRepoUrl: parsed.sourceRepoUrl,
        sourcePath: parsed.sourcePath,
        summary: parsed.summary ?? "",
        suggestedRoleTitle: parsed.suggestedRoleTitle ?? "",
        recommendedSkills: parsed.recommendedSkills ?? [],
        identity: parsed.identity ?? "",
        soul: parsed.soul ?? "",
        tools: parsed.tools ?? "",
        active: parsed.active ?? true,
        position: parsed.position ?? index
      };
    }),
    replaceExisting: parseBooleanUnknown(body?.replaceExisting, true)
  };
}

export function parseRuntimeLlmSettingsInput(
  payload: unknown,
  runtimeInstance: RuntimeInstance,
  runtimeApiKeyFallback: string,
  runtimeTelegramModelOverride?: string
): {
  provider: string;
  model: string;
  apiKey: string;
} {
  const body = payload as {
    provider?: unknown;
    model?: unknown;
    apiKey?: unknown;
    llmProvider?: unknown;
    llmModel?: unknown;
    llmApiKey?: unknown;
  };

  const providerInput =
    getOptionalTrimmedString(body?.llmProvider) ??
    getOptionalTrimmedString(body?.provider) ??
    SUPPORTED_LLM_PROVIDER;
  const provider = normalizeSupportedLlmProvider(providerInput);
  const modelInput =
    getOptionalTrimmedString(body?.llmModel) ??
    getOptionalTrimmedString(body?.model) ??
    runtimeInstance.llmModel;
  const model = resolveTelegramCompatibleModel({
    provider,
    model: modelInput,
    telegramEnabled: runtimeInstance.telegramEnabled,
    telegramModelOverride: runtimeTelegramModelOverride
  });
  const apiKey =
    getOptionalTrimmedString(body?.llmApiKey) ??
    getOptionalTrimmedString(body?.apiKey) ??
    runtimeInstance.llmApiKey ??
    runtimeApiKeyFallback;

  if (!model) {
    throw new Error("Validation failed: llm model is required");
  }

  if (!apiKey) {
    throw new Error("Validation failed: llm api key is required");
  }

  return {
    provider,
    model,
    apiKey
  };
}

export function parseRuntimeTelegramSettingsInput(
  payload: unknown,
  runtimeInstance: RuntimeInstance
): {
  enabled: boolean;
  botToken?: string;
  allowFrom: string[];
  replyInPrivate: boolean;
} {
  const body = payload as {
    enabled?: unknown;
    botToken?: unknown;
    telegramBotToken?: unknown;
    allowFrom?: unknown;
    telegramAllowFrom?: unknown;
    replyInPrivate?: unknown;
    telegramReplyInPrivate?: unknown;
  };

  const enabled = parseBooleanUnknown(body?.enabled, runtimeInstance.telegramEnabled);
  const botToken =
    getOptionalTrimmedString(body?.telegramBotToken) ??
    getOptionalTrimmedString(body?.botToken) ??
    runtimeInstance.telegramBotToken;
  const allowFrom =
    parseAllowFromList(body?.telegramAllowFrom) ??
    parseAllowFromList(body?.allowFrom) ??
    runtimeInstance.telegramAllowFrom;
  const connector = getRuntimeConnector(runtimeInstance.runtimeType);
  const providedReplyInPrivate =
    body?.telegramReplyInPrivate !== undefined || body?.replyInPrivate !== undefined;
  const replyInPrivate = connector.capabilities.telegramReplyInPrivate
    ? parseBooleanUnknown(
        body?.telegramReplyInPrivate ?? body?.replyInPrivate,
        runtimeInstance.telegramReplyInPrivate
      )
    : false;

  if (enabled && !botToken) {
    throw new Error("Validation failed: telegram botToken is required when enabled");
  }

  if (!connector.capabilities.telegramReplyInPrivate && providedReplyInPrivate) {
    throw new Error(
      `Validation failed: ${runtimeInstance.runtimeType} does not support telegramReplyInPrivate`
    );
  }

  const normalizedAllowFrom = enabled && allowFrom.length === 0 ? ["*"] : allowFrom;

  return {
    enabled,
    botToken,
    allowFrom: normalizedAllowFrom,
    replyInPrivate
  };
}

export function parseRuntimeSlackSettingsInput(
  payload: unknown,
  runtimeInstance: RuntimeInstance
): {
  enabled: boolean;
  botToken?: string;
  appToken?: string;
  allowedChannelIds: string[];
  allowedUserIds: string[];
  replyInThread: boolean;
} {
  const body = payload as {
    enabled?: unknown;
    slackEnabled?: unknown;
    slackBotToken?: unknown;
    slackAppToken?: unknown;
    slackSigningSecret?: unknown;
    slackAllowedChannelIds?: unknown;
    slackAllowedUserIds?: unknown;
    slackReplyInThread?: unknown;
  };
  const connector = getRuntimeConnector(runtimeInstance.runtimeType);

  const enabled = parseBooleanUnknown(
    body?.slackEnabled ?? body?.enabled,
    runtimeInstance.slackEnabled
  );
  const botToken =
    getOptionalTrimmedString(body?.slackBotToken) ?? runtimeInstance.slackBotToken;
  const appToken =
    getOptionalTrimmedString(body?.slackAppToken) ??
    getOptionalTrimmedString(body?.slackSigningSecret) ??
    runtimeInstance.slackAppToken;
  const allowedChannelIds =
    parseIdListUnknown(body?.slackAllowedChannelIds) ?? runtimeInstance.slackAllowedChannelIds;
  const allowedUserIds =
    parseIdListUnknown(body?.slackAllowedUserIds) ?? runtimeInstance.slackAllowedUserIds;
  const replyInThread = parseBooleanUnknown(
    body?.slackReplyInThread,
    runtimeInstance.slackReplyInThread
  );
  const supportsSlack =
    connector.capabilities.slackBotToken ||
    connector.capabilities.slackAppToken ||
    connector.capabilities.slackAllowedChannelIds ||
    connector.capabilities.slackAllowedUserIds ||
    connector.capabilities.slackReplyInThread;

  if (!supportsSlack && enabled) {
    throw new Error(`Validation failed: ${runtimeInstance.runtimeType} does not support slack`);
  }

  if (enabled && connector.capabilities.slackBotToken && !botToken) {
    throw new Error("Validation failed: slackBotToken is required when enabled");
  }

  if (enabled && connector.capabilities.slackAppToken && !appToken) {
    throw new Error("Validation failed: slackAppToken is required when enabled");
  }

  return {
    enabled,
    botToken,
    appToken,
    allowedChannelIds,
    allowedUserIds,
    replyInThread
  };
}

export function parseAgentParams(payload: unknown): { agentId: string } {
  const params = payload as { agentId?: unknown };
  const agentId = getOptionalTrimmedString(params?.agentId) ?? "";
  if (!agentId) {
    throw new Error("Validation failed: agentId is required");
  }
  return { agentId };
}

export function parseRuntimeDiscordSettingsInput(
  payload: unknown,
  runtimeInstance: RuntimeInstance
): {
  enabled: boolean;
  botToken?: string;
  allowedUserIds: string[];
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  replyInThread: boolean;
  requireMention: boolean;
} {
  const body = payload as {
    enabled?: unknown;
    discordEnabled?: unknown;
    discordBotToken?: unknown;
    discordAllowedUserIds?: unknown;
    discordAllowedGuildIds?: unknown;
    discordAllowedChannelIds?: unknown;
    discordReplyInThread?: unknown;
    discordRequireMention?: unknown;
  };
  const connector = getRuntimeConnector(runtimeInstance.runtimeType);

  const enabled = parseBooleanUnknown(
    body?.discordEnabled ?? body?.enabled,
    runtimeInstance.discordEnabled
  );
  const botToken =
    getOptionalTrimmedString(body?.discordBotToken) ?? runtimeInstance.discordBotToken;
  const allowedUserIds =
    parseIdListUnknown(body?.discordAllowedUserIds) ?? runtimeInstance.discordAllowedUserIds;
  const allowedGuildIds =
    parseIdListUnknown(body?.discordAllowedGuildIds) ?? runtimeInstance.discordAllowedGuildIds;
  const allowedChannelIds =
    parseIdListUnknown(body?.discordAllowedChannelIds) ?? runtimeInstance.discordAllowedChannelIds;
  const replyInThread = parseBooleanUnknown(
    body?.discordReplyInThread,
    runtimeInstance.discordReplyInThread
  );
  const requireMention = parseBooleanUnknown(
    body?.discordRequireMention,
    runtimeInstance.discordRequireMention
  );
  const supportsDiscord =
    connector.capabilities.discordBotToken ||
    connector.capabilities.discordAllowedUserIds ||
    connector.capabilities.discordAllowedGuildIds ||
    connector.capabilities.discordAllowedChannelIds ||
    connector.capabilities.discordReplyInThread;

  if (!supportsDiscord && enabled) {
    throw new Error(`Validation failed: ${runtimeInstance.runtimeType} does not support discord`);
  }

  if (enabled && connector.capabilities.discordBotToken && !botToken) {
    throw new Error("Validation failed: discordBotToken is required when enabled");
  }

  return {
    enabled,
    botToken,
    allowedUserIds,
    allowedGuildIds,
    allowedChannelIds,
    replyInThread,
    requireMention
  };
}

export function parseRuntimeLimitsSettingsInput(payload: unknown): {
  dailyMessageLimit?: number;
  dailyTokenLimit?: number;
  monthlySpendLimitUsd?: number;
} {
  const body = payload as {
    dailyMessageLimit?: unknown;
    dailyTokenLimit?: unknown;
    monthlySpendLimitUsd?: unknown;
  };

  return {
    dailyMessageLimit: parseOptionalLimitUnknown(body?.dailyMessageLimit),
    dailyTokenLimit: parseOptionalLimitUnknown(body?.dailyTokenLimit),
    monthlySpendLimitUsd: parseOptionalLimitUnknown(body?.monthlySpendLimitUsd)
  };
}

export function parseRuntimeConfigSettingsInput(payload: unknown): {
  runtimeOptions: Record<string, unknown>;
  runtimeSecrets?: Record<string, string>;
} {
  const body = payload as {
    runtimeOptions?: unknown;
    runtimeSecrets?: unknown;
  };

  return {
    runtimeOptions: parseRuntimeOptionsRecord(body?.runtimeOptions),
    runtimeSecrets: parseRuntimeSecretsRecord(body?.runtimeSecrets)
  };
}

export function resolveTelegramCompatibleModel(input: {
  provider: string;
  model: string;
  telegramEnabled: boolean;
  telegramModelOverride?: string;
}): string {
  const model = input.model.trim();
  if (!input.telegramEnabled || !model) {
    return model;
  }

  const override = input.telegramModelOverride?.trim();
  if (override) {
    return override;
  }

  return model;
}

export function parseRuntimeInstanceParams(payload: unknown): { instanceId: string } {
  const params = payload as { instanceId?: unknown };
  const instanceId = typeof params?.instanceId === "string" ? params.instanceId.trim() : "";
  if (!instanceId) {
    throw new Error("Validation failed: instanceId is required");
  }
  return { instanceId };
}

export function parseProvisionJobParams(payload: unknown): { jobId: string } {
  const params = payload as { jobId?: unknown };
  const jobId = typeof params?.jobId === "string" ? params.jobId.trim() : "";
  if (!jobId) {
    throw new Error("Validation failed: jobId is required");
  }
  return { jobId };
}

export function normalizeChannel(value: unknown): Channel {
  if (value === "whatsapp" || value === "telegram" || value === "custom") {
    return value;
  }
  return "custom";
}

export function parsePairRuntimeInput(payload: unknown): { pairingCode: string } {
  const body = payload as { pairingCode?: unknown };
  const pairingCode = typeof body?.pairingCode === "string" ? body.pairingCode.trim() : "";
  if (!pairingCode) {
    throw new Error("Validation failed: pairingCode is required");
  }
  return { pairingCode };
}

export function parseSetRuntimeTokenInput(payload: unknown): { token: string } {
  const body = payload as { token?: unknown };
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    throw new Error("Validation failed: token is required");
  }
  return { token };
}

export function parseRuntimeWebhookInput(payload: unknown): { message: string; token?: string } {
  const body = payload as { message?: unknown; token?: unknown };
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!message) {
    throw new Error("Validation failed: message is required");
  }

  return token ? { message, token } : { message };
}

export function parseRuntimeChatInput(payload: unknown): { message: string; token?: string } {
  return parseRuntimeWebhookInput(payload);
}

export function parseRuntimeReconcileInput(payload: unknown): {
  dryRun: boolean;
  instanceId?: string;
} {
  const body = payload as {
    dryRun?: unknown;
    instanceId?: unknown;
  };

  return {
    dryRun: parseBooleanUnknown(body?.dryRun, true),
    instanceId: getOptionalTrimmedString(body?.instanceId)
  };
}

export function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return fallback;
}

export function parseBooleanUnknown(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return parseBooleanEnv(value, fallback);
  return fallback;
}

export function parseBooleanQueryValue(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  return parseBooleanEnv(value, fallback);
}

export function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function parsePositiveIntegerUnknown(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.floor(value);
  }
  if (typeof value === "string") {
    return parsePositiveInteger(value, fallback);
  }
  return fallback;
}

export function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

export function getOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function parseAllowFromList(value: unknown): string[] | undefined {
  let rawList: string[] | undefined;
  if (Array.isArray(value)) {
    rawList = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => Boolean(item));
  } else if (typeof value === "string") {
    rawList = value
      .split(/[\n,]/g)
      .map((item) => item.trim())
      .filter((item) => Boolean(item));
  } else {
    return undefined;
  }

  const normalized = [] as string[];
  const seen = new Set<string>();
  for (const entry of rawList) {
    const canonical = normalizeAllowFromEntry(entry);
    if (!canonical) continue;
    if (canonical === "*") {
      return ["*"];
    }
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(canonical);
  }

  return normalized;
}

function parseIdListUnknown(value: unknown): string[] | undefined {
  let rawItems: string[] | undefined;
  if (Array.isArray(value)) {
    rawItems = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => Boolean(item));
  } else if (typeof value === "string") {
    rawItems = value
      .split(/[\n,]/g)
      .map((item) => item.trim())
      .filter((item) => Boolean(item));
  } else {
    return undefined;
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of rawItems) {
    if (item.length > 120) {
      throw new Error("Validation failed: integration IDs must be 120 characters or less");
    }
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    normalized.push(item);
  }

  return normalized;
}

function parseOptionalWebhookUrlUnknown(value: unknown): string | undefined {
  const normalized = getOptionalTrimmedString(value);
  if (!normalized) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Validation failed: webhook URL must be a valid absolute URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Validation failed: webhook URL must use https");
  }

  return parsed.toString();
}

function parseOptionalChannelNameUnknown(value: unknown): string | undefined {
  const normalized = getOptionalTrimmedString(value);
  if (!normalized) {
    return undefined;
  }

  if (normalized.length > 120) {
    throw new Error("Validation failed: default channel must be 120 characters or less");
  }

  return normalized;
}

function parseOptionalLimitUnknown(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error("Validation failed: limit values must be positive numbers");
  }

  return numericValue;
}

function parseRuntimeOptionsRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key.trim().length > 0)
  );
}

function parseRuntimeSecretsRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
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

export function parseRuntimeSharedFileParams(payload: unknown): { fileId: string } {
  const params = payload as { fileId?: unknown };
  const fileId = typeof params?.fileId === "string" ? params.fileId.trim() : "";
  if (!fileId) {
    throw new Error("Validation failed: fileId is required");
  }
  return { fileId };
}

export function parseRuntimeSharedFilesUploadInput(payload: unknown): {
  files: Array<{
    relativePath: string;
    content: Buffer;
  }>;
} {
  const body = payload as { files?: unknown };
  const rawFiles = Array.isArray(body?.files) ? body.files : [];
  if (rawFiles.length === 0) {
    throw new Error("Validation failed: files array is required");
  }
  if (rawFiles.length > 10) {
    throw new Error("Validation failed: no more than 10 files may be uploaded at once");
  }

  const files = rawFiles.map((rawFile) => {
    const file = rawFile as { name?: unknown; relativePath?: unknown; contentBase64?: unknown };
    const name = getOptionalTrimmedString(file?.name) ?? "";
    const relativePathInput = getOptionalTrimmedString(file?.relativePath) ?? name;
    const contentBase64 = getOptionalTrimmedString(file?.contentBase64) ?? "";

    if (!name) {
      throw new Error("Validation failed: each file must include a name");
    }
    if (!contentBase64) {
      throw new Error(`Validation failed: file ${name} is missing contentBase64`);
    }

    let content: Buffer;
    try {
      content = Buffer.from(contentBase64, "base64");
    } catch {
      throw new Error(`Validation failed: file ${name} has invalid base64 content`);
    }

    if (content.byteLength === 0) {
      throw new Error(`Validation failed: file ${name} is empty`);
    }
    if (content.byteLength > 5 * 1024 * 1024) {
      throw new Error(`Validation failed: file ${name} exceeds the 5 MB upload limit`);
    }

    let relativePath: string;
    try {
      relativePath = normalizeRuntimeSharedUploadRelativePath(relativePathInput);
    } catch {
      throw new Error(`Validation failed: file ${name} has an invalid relativePath`);
    }

    return { relativePath, content };
  });

  return { files };
}

const WINDOWS_RESERVED_FILENAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/iu;

function normalizeRuntimeSharedUploadRelativePath(value: string): string {
  const normalized = value.trim().replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/u.test(normalized)) {
    throw new Error("Invalid runtime shared upload path");
  }
  const segments = normalized.split("/");
  if (segments.length === 0) {
    throw new Error("Invalid runtime shared upload path");
  }

  const safeSegments = segments.map((segment) => normalizeRuntimeSharedUploadPathSegment(segment));
  return safeSegments.join("/");
}

function normalizeRuntimeSharedUploadPathSegment(value: string): string {
  const segment = value.trim();
  if (
    !segment ||
    segment === "." ||
    segment === ".." ||
    /[\\/]/u.test(segment) ||
    WINDOWS_RESERVED_FILENAME_RE.test(segment)
  ) {
    throw new Error("Invalid runtime shared upload path segment");
  }
  return segment;
}

function normalizeAllowFromEntry(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === "*") return "*";
  return trimmed.replace(/^@+/u, "");
}

function normalizeSupportedLlmProvider(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Validation failed: llm provider is required");
  }
  if (normalized !== SUPPORTED_LLM_PROVIDER) {
    throw new Error(
      `Validation failed: llm provider '${normalized}' is not supported by this build; use '${SUPPORTED_LLM_PROVIDER}'`
    );
  }
  return SUPPORTED_LLM_PROVIDER;
}
