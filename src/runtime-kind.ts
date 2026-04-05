import type { RuntimeType } from "./store.js";

export const DEFAULT_ZEROCLAW_RUNTIME_IMAGE = "zivhm/zeroclaw-runtime";
export const DEFAULT_OPENCLAW_RUNTIME_IMAGE = "zivhm/openclaw";
export const DEFAULT_RUNTIME_TYPE: RuntimeType = "openclaw";
export const ALL_RUNTIME_TYPES: RuntimeType[] = ["openclaw", "zeroclaw"];

export type RuntimeConnectorMaturity = "supported" | "beta";
export type RuntimeHealthMode = "http" | "container";
export type RuntimePresetMode = "exact" | "translated";
export type RuntimeProcessMode = "daemon" | "gateway";

export type RuntimeConnectorCapabilities = {
  llmConfig: boolean;
  telegramToken: boolean;
  telegramAllowFrom: boolean;
  telegramReplyInPrivate: boolean;
  pairingInfo: boolean;
  pairingAction: boolean;
  chatAction: boolean;
  webhookAction: boolean;
  httpHealth: boolean;
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

const RUNTIME_ENVIRONMENT: Record<RuntimeType, Record<string, string>> = {
  openclaw: {
    NODE_OPTIONS: "--no-deprecation"
  },
  zeroclaw: {}
};

const RUNTIME_CONNECTORS: Record<RuntimeType, RuntimeConnector> = {
  openclaw: {
    id: "openclaw",
    label: "OpenClaw",
    maturity: "supported",
    imageEnvVar: "RUNTIME_OPENCLAW_IMAGE",
    defaultImage: DEFAULT_OPENCLAW_RUNTIME_IMAGE,
    defaultRequirePairing: false,
    defaultAllowPublicBind: true,
    healthMode: "http",
    healthPath: "/healthz",
    presetMode: "exact",
    capabilities: {
      llmConfig: true,
      telegramToken: true,
      telegramAllowFrom: true,
      telegramReplyInPrivate: true,
      pairingInfo: false,
      pairingAction: false,
      chatAction: true,
      webhookAction: false,
      httpHealth: true
    }
  },
  zeroclaw: {
    id: "zeroclaw",
    label: "ZeroClaw",
    maturity: "supported",
    imageEnvVar: "RUNTIME_ZEROCLAW_IMAGE",
    defaultImage: DEFAULT_ZEROCLAW_RUNTIME_IMAGE,
    defaultRequirePairing: false,
    defaultAllowPublicBind: true,
    healthMode: "http",
    healthPath: "/health",
    presetMode: "exact",
    capabilities: {
      llmConfig: true,
      telegramToken: true,
      telegramAllowFrom: true,
      telegramReplyInPrivate: true,
      pairingInfo: true,
      pairingAction: true,
      chatAction: true,
      webhookAction: true,
      httpHealth: true
    }
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
  }
};

function listRuntimeConnectors(runtimeTypes: RuntimeType[] = ALL_RUNTIME_TYPES): RuntimeConnector[] {
  return runtimeTypes.map((runtimeType) => getRuntimeConnector(runtimeType));
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
  if (value === "openclaw" || value === "zeroclaw") {
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
}): string {
  const connector = getRuntimeConnector(input.runtimeType);
  const runtimeImages =
    input.runtimeImages ??
    {
      openclaw: input.openclawImage ?? "",
      zeroclaw: input.zeroclawImage ?? ""
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
    return {
      ...connector,
      defaultGatewayPort: connector.defaultGatewayPort ?? input.runtimeGatewayPort,
      defaultRequirePairing: connector.capabilities.pairingAction
        ? input.runtimeRequirePairing
        : connector.defaultRequirePairing,
      defaultAllowPublicBind: input.runtimeAllowPublicBind,
      runtimeConfigFields: connector.runtimeConfigFields ?? [],
      resolvedImage: resolveRuntimeImageForType({
        runtimeType,
        runtimeImages: input.runtimeImages
      })
    };
  });
}

export function isRuntimeType(value: string): value is RuntimeType {
  return value === "openclaw" || value === "zeroclaw";
}
