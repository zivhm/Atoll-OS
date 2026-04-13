import type { RuntimeType } from "./store.js";

export const DEFAULT_RUNTIME_TYPE: RuntimeType = "openclaw";
export const ALL_RUNTIME_TYPES: RuntimeType[] = ["openclaw", "zeroclaw", "hermes"];

export type RuntimeConnectorMaturity = "supported" | "beta";
export type RuntimeHealthMode = "http" | "container";
export type RuntimePresetMode = "exact" | "translated";
export type RuntimeProcessMode = "daemon" | "gateway";
export type RuntimeChatTransport = "openclaw-gateway" | "http-message" | "openai-chat-completions";
export type RuntimeAuthTransport = "bearer" | "webhook-secret";

export type RuntimeConnectorCapabilities = {
  llmConfig: boolean;
  telegramToken: boolean;
  telegramAllowFrom: boolean;
  telegramReplyInPrivate: boolean;
  slackBotToken: boolean;
  slackAppToken: boolean;
  slackAllowedChannelIds: boolean;
  slackAllowedUserIds: boolean;
  slackReplyInThread: boolean;
  discordBotToken: boolean;
  discordAllowedUserIds: boolean;
  discordAllowedGuildIds: boolean;
  discordAllowedChannelIds: boolean;
  discordReplyInThread: boolean;
  discordRequireMention: boolean;
  pairingInfo: boolean;
  pairingAction: boolean;
  chatAction: boolean;
  webhookAction: boolean;
  httpHealth: boolean;
  sharedFiles: boolean;
};

export type RuntimeConfigFieldDescriptor = {
  key: string;
  label: string;
  kind: "string" | "number" | "boolean" | "json";
  secret?: boolean;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: unknown;
};

export type RuntimeConnector = {
  id: RuntimeType;
  label: string;
  maturity: RuntimeConnectorMaturity;
  imageEnvVar: string;
  defaultImage?: string;
  defaultGatewayPort?: number;
  defaultRequirePairing: boolean;
  defaultAllowPublicBind: boolean;
  healthMode: RuntimeHealthMode;
  healthPath?: string;
  chatTransport: RuntimeChatTransport;
  chatEndpoint?: string;
  authTransport?: RuntimeAuthTransport;
  presetMode: RuntimePresetMode;
  capabilities: RuntimeConnectorCapabilities;
  runtimeConfigFields?: RuntimeConfigFieldDescriptor[];
};

export type RuntimeLaunchContext = {
  image: string;
  gatewayPort: number;
  processMode: RuntimeProcessMode;
};

export type RuntimeSeedPermissions = {
  dataRootMode?: string;
  configDirMode?: string;
  configFileMode?: string;
  workspaceFileMode?: string;
};

export type RuntimeDescriptor = {
  dataRoot: string;
  mountPath: string;
  workspaceDir: string;
  configPath: string;
  extraSeedDirectories?: string[];
  seedOwner?: string;
  seedPermissions?: RuntimeSeedPermissions;
  resolveLaunchArgs: (input: RuntimeLaunchContext) => string[];
};

export type RuntimeCatalogItem = RuntimeConnector & {
  resolvedImage: string;
};

const DEFAULT_RUNTIME_HEALTHCHECK_INTERVAL = "3m";
const DEFAULT_RUNTIME_HEALTHCHECK_TIMEOUT = "10s";
const DEFAULT_RUNTIME_HEALTHCHECK_START_PERIOD = "15s";
const DEFAULT_RUNTIME_HEALTHCHECK_RETRIES = "3";

const DEFAULT_CAPABILITIES: RuntimeConnectorCapabilities = {
  llmConfig: true,
  telegramToken: false,
  telegramAllowFrom: false,
  telegramReplyInPrivate: false,
  slackBotToken: false,
  slackAppToken: false,
  slackAllowedChannelIds: false,
  slackAllowedUserIds: false,
  slackReplyInThread: false,
  discordBotToken: false,
  discordAllowedUserIds: false,
  discordAllowedGuildIds: false,
  discordAllowedChannelIds: false,
  discordReplyInThread: false,
  discordRequireMention: false,
  pairingInfo: false,
  pairingAction: false,
  chatAction: true,
  webhookAction: false,
  httpHealth: true,
  sharedFiles: true
};

const GUI_SIDECAR_RUNTIME_CONFIG_FIELDS: RuntimeConfigFieldDescriptor[] = [
  {
    key: "gui.enabled",
    label: "Enable GUI sidecar",
    kind: "boolean",
    helperText: "Provision a companion GUI/browser container for this runtime.",
    defaultValue: false
  },
  {
    key: "gui.enableVnc",
    label: "Enable noVNC",
    kind: "boolean",
    helperText: "Start x11vnc + noVNC in the sidecar. Keep off unless operator viewing is needed.",
    defaultValue: false
  },
  {
    key: "gui.noVncPort",
    label: "Host noVNC port",
    kind: "number",
    helperText: "Optional host loopback port to publish noVNC (container port 6080).",
    placeholder: "6080"
  }
];

const RUNTIME_ENVIRONMENT: Record<RuntimeType, Record<string, string>> = {
  openclaw: {
    NODE_OPTIONS: "--no-deprecation"
  },
  zeroclaw: {},
  hermes: {}
};

const RUNTIME_CONNECTORS: Record<RuntimeType, RuntimeConnector> = {
  openclaw: {
    id: "openclaw",
    label: "OpenClaw",
    maturity: "supported",
    imageEnvVar: "RUNTIME_OPENCLAW_IMAGE",
    defaultRequirePairing: false,
    defaultAllowPublicBind: true,
    healthMode: "http",
    healthPath: "/healthz",
    chatTransport: "openclaw-gateway",
    authTransport: "bearer",
    presetMode: "exact",
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      telegramToken: true,
      telegramAllowFrom: true,
      telegramReplyInPrivate: true,
      slackBotToken: true,
      slackAppToken: true,
      slackAllowedChannelIds: true,
      slackAllowedUserIds: true,
      slackReplyInThread: true,
      discordBotToken: true,
      discordAllowedUserIds: false,
      discordAllowedGuildIds: true,
      discordAllowedChannelIds: true,
      discordReplyInThread: true,
      discordRequireMention: true
    }
  },
  zeroclaw: {
    id: "zeroclaw",
    label: "ZeroClaw",
    maturity: "supported",
    imageEnvVar: "RUNTIME_ZEROCLAW_IMAGE",
    defaultRequirePairing: false,
    defaultAllowPublicBind: true,
    healthMode: "http",
    healthPath: "/health",
    chatTransport: "http-message",
    chatEndpoint: "/webhook",
    authTransport: "webhook-secret",
    presetMode: "exact",
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      telegramToken: true,
      telegramAllowFrom: true,
      telegramReplyInPrivate: true,
      pairingInfo: true,
      pairingAction: true,
      webhookAction: true
    }
  },
  hermes: {
    id: "hermes",
    label: "Hermes",
    maturity: "beta",
    imageEnvVar: "RUNTIME_HERMES_IMAGE",
    defaultRequirePairing: false,
    defaultAllowPublicBind: true,
    healthMode: "http",
    healthPath: "/health",
    chatTransport: "openai-chat-completions",
    chatEndpoint: "/v1/chat/completions",
    authTransport: "bearer",
    presetMode: "translated",
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      telegramToken: true,
      telegramAllowFrom: true,
      slackBotToken: true,
      slackAppToken: true,
      slackAllowedUserIds: true,
      slackReplyInThread: true,
      discordBotToken: true,
      discordAllowedUserIds: true,
      discordAllowedGuildIds: false,
      discordAllowedChannelIds: true,
      discordReplyInThread: true,
      discordRequireMention: true
    },
    runtimeConfigFields: []
  }
};

const RUNTIME_DESCRIPTORS: Record<RuntimeType, RuntimeDescriptor> = {
  openclaw: {
    dataRoot: "/openclaw-data",
    mountPath: "/home/node/.openclaw",
    workspaceDir: "/openclaw-data/workspace",
    configPath: "/openclaw-data/openclaw.json",
    seedOwner: "1000:1000",
    seedPermissions: {
      dataRootMode: "700",
      configFileMode: "600",
      workspaceFileMode: "644"
    },
    resolveLaunchArgs: ({ image, gatewayPort }) => [
      image,
      "node",
      "dist/index.js",
      "gateway",
      "--bind",
      "lan",
      "--port",
      String(gatewayPort)
    ]
  },
  zeroclaw: {
    dataRoot: "/zeroclaw-data",
    mountPath: "/zeroclaw-data",
    workspaceDir: "/zeroclaw-data/workspace",
    configPath: "/zeroclaw-data/.zeroclaw/config.toml",
    extraSeedDirectories: ["/zeroclaw-data/.zeroclaw"],
    seedOwner: "65534:65534",
    seedPermissions: {
      configDirMode: "700",
      configFileMode: "600",
      workspaceFileMode: "644"
    },
    resolveLaunchArgs: ({ image, gatewayPort, processMode }) => [
      image,
      processMode,
      "--host",
      "0.0.0.0",
      "--port",
      String(gatewayPort)
    ]
  },
  hermes: {
    dataRoot: "/opt/data",
    mountPath: "/opt/data",
    workspaceDir: "/opt/data/atoll/workspace",
    configPath: "/opt/data/config.yaml",
    extraSeedDirectories: ["/opt/data/atoll", "/opt/data/logs", "/opt/data/sessions"],
    seedPermissions: {
      dataRootMode: "700",
      configFileMode: "600",
      workspaceFileMode: "644"
    },
    resolveLaunchArgs: ({ image }) => [
      image,
      "gateway",
      "run",
      "--replace"
    ]
  }
};

function listRuntimeConnectors(runtimeTypes: RuntimeType[] = ALL_RUNTIME_TYPES): RuntimeConnector[] {
  return runtimeTypes.map((runtimeType) => getRuntimeConnector(runtimeType));
}

export function getRuntimeTypes(): RuntimeType[] {
  return [...ALL_RUNTIME_TYPES];
}

export function getRuntimeConnectors(runtimeTypes: RuntimeType[] = ALL_RUNTIME_TYPES): RuntimeConnector[] {
  return listRuntimeConnectors(runtimeTypes);
}

export function getRuntimeConnector(runtimeType: RuntimeType | undefined): RuntimeConnector {
  return RUNTIME_CONNECTORS[normalizeRuntimeType(runtimeType)];
}

export function getRuntimeDescriptor(runtimeType: RuntimeType | undefined): RuntimeDescriptor {
  return RUNTIME_DESCRIPTORS[normalizeRuntimeType(runtimeType)];
}

export function normalizeRuntimeType(
  value: unknown,
  fallback: RuntimeType = DEFAULT_RUNTIME_TYPE
): RuntimeType {
  if (value === "openclaw" || value === "zeroclaw" || value === "hermes") {
    return value;
  }
  return fallback;
}

export function resolveSupportedRuntimeTypes(
  rawValue: string | undefined,
  fallback: RuntimeType[] = ALL_RUNTIME_TYPES
): RuntimeType[] {
  const items = String(rawValue || "")
    .split(/[,\s]+/u)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item): item is RuntimeType => isRuntimeType(item))
    .filter((item, index, array) => array.indexOf(item) === index);

  if (items.length === 0) {
    return [...fallback];
  }

  return items;
}

export function resolveDefaultRuntimeType(
  requested: string | undefined,
  supportedRuntimeTypes: RuntimeType[]
): RuntimeType {
  const normalized = normalizeRuntimeType(requested?.trim().toLowerCase(), DEFAULT_RUNTIME_TYPE);
  if (supportedRuntimeTypes.includes(normalized)) {
    return normalized;
  }
  if (supportedRuntimeTypes.includes(DEFAULT_RUNTIME_TYPE)) {
    return DEFAULT_RUNTIME_TYPE;
  }
  return supportedRuntimeTypes[0] ?? DEFAULT_RUNTIME_TYPE;
}

export function resolveRuntimeHealthPath(runtimeType: RuntimeType): string | undefined {
  return getRuntimeConnector(runtimeType).healthPath;
}

export function resolveRuntimeHealthcheckArgs(
  runtimeType: RuntimeType,
  gatewayPort: number
): string[] {
  const connector = getRuntimeConnector(runtimeType);
  if (connector.healthMode !== "http" || !connector.healthPath) {
    return [];
  }

  return [
    "--health-cmd",
    `node -e "fetch('http://127.0.0.1:${gatewayPort}${connector.healthPath}').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`,
    "--health-interval",
    DEFAULT_RUNTIME_HEALTHCHECK_INTERVAL,
    "--health-timeout",
    DEFAULT_RUNTIME_HEALTHCHECK_TIMEOUT,
    "--health-start-period",
    DEFAULT_RUNTIME_HEALTHCHECK_START_PERIOD,
    "--health-retries",
    DEFAULT_RUNTIME_HEALTHCHECK_RETRIES
  ];
}

export function resolveRuntimeLaunchArgs(
  runtimeType: RuntimeType,
  input: RuntimeLaunchContext
): string[] {
  return getRuntimeDescriptor(runtimeType).resolveLaunchArgs(input);
}

export function resolveRuntimeEnvironment(runtimeType: RuntimeType): Record<string, string> {
  return { ...RUNTIME_ENVIRONMENT[normalizeRuntimeType(runtimeType)] };
}

export function resolveRuntimeImageForType(input: {
  runtimeType: RuntimeType;
  runtimeImages?: Record<RuntimeType, string>;
  zeroclawImage?: string;
  openclawImage?: string;
  hermesImage?: string;
}): string {
  const connector = getRuntimeConnector(input.runtimeType);
  const runtimeImages =
    input.runtimeImages ??
    {
      openclaw: input.openclawImage ?? "",
      zeroclaw: input.zeroclawImage ?? "",
      hermes: input.hermesImage ?? ""
    };
  const configured = runtimeImages[input.runtimeType]?.trim();
  return configured || connector.defaultImage || "";
}

export function buildRuntimeCatalog(input: {
  runtimeTypes: RuntimeType[];
  runtimeImages: Record<RuntimeType, string>;
  runtimeGatewayPort: number;
  runtimeRequirePairing: boolean;
  runtimeAllowPublicBind: boolean;
}): RuntimeCatalogItem[] {
  return input.runtimeTypes.map((runtimeType) => {
    const connector = getRuntimeConnector(runtimeType);
    const connectorFields = connector.runtimeConfigFields ?? [];
    const runtimeConfigFields = [...GUI_SIDECAR_RUNTIME_CONFIG_FIELDS, ...connectorFields].filter(
      (field, index, array) => array.findIndex((candidate) => candidate.key === field.key) === index
    );
    return {
      ...connector,
      defaultGatewayPort: connector.defaultGatewayPort ?? input.runtimeGatewayPort,
      defaultRequirePairing: connector.capabilities.pairingAction
        ? input.runtimeRequirePairing
        : connector.defaultRequirePairing,
      defaultAllowPublicBind: input.runtimeAllowPublicBind,
      runtimeConfigFields,
      resolvedImage: resolveRuntimeImageForType({
        runtimeType,
        runtimeImages: input.runtimeImages
      })
    };
  });
}

export function isRuntimeType(value: string): value is RuntimeType {
  return value === "openclaw" || value === "zeroclaw" || value === "hermes";
}
