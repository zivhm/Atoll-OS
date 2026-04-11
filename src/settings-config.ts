import { mkdirSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";

import { parseBooleanEnv, parseBooleanUnknown, getOptionalTrimmedString } from "./parsers.js";

export type SettingsConfigFieldKind = "text" | "boolean" | "select";

export type SettingsConfigFieldOption = {
  value: string;
  label: string;
};

export type SettingsConfigFieldDefinition = {
  key: string;
  groupId: SettingsConfigGroupId;
  label: string;
  kind: SettingsConfigFieldKind;
  helpText: string;
  defaultValue: string | boolean;
  placeholder?: string;
  options?: SettingsConfigFieldOption[];
};

export type SettingsConfigField = Omit<SettingsConfigFieldDefinition, "defaultValue" | "groupId"> & {
  value: string | boolean;
  source: "env" | "default";
};

export type SettingsConfigGroupId = "runtime-defaults" | "runtime-behavior";

export type SettingsConfigGroup = {
  id: SettingsConfigGroupId;
  title: string;
  description: string;
  fields: SettingsConfigField[];
};

export type SettingsConfigSnapshot = {
  groups: SettingsConfigGroup[];
  restartRequired: boolean;
  restartMessage: string;
  warning: string;
};

const SETTINGS_RESTART_MESSAGE =
  "Saved values update the repo-root .env. Restart the API to fully apply them.";
const SETTINGS_WARNING =
  "Runtime config precedence is unchanged: external process env vars still win over .env at startup.";

const SETTINGS_CONFIG_GROUPS: Array<Omit<SettingsConfigGroup, "fields">> = [
  {
    id: "runtime-defaults",
    title: "Runtime defaults",
    description: "Shared defaults used when provisioning helpers on this host."
  },
  {
    id: "runtime-behavior",
    title: "Runtime behavior and catalog",
    description: "Catalog, process mode, and startup behavior applied by the host."
  }
];

export const SETTINGS_CONFIG_FIELDS: SettingsConfigFieldDefinition[] = [
  {
    key: "CONTAINER_CLI",
    groupId: "runtime-defaults",
    label: "Container CLI",
    kind: "text",
    helpText: "Container runtime command used for lifecycle and diagnostics.",
    defaultValue: "docker",
    placeholder: "docker"
  },
  {
    key: "RUNTIME_DOCKER_NETWORK",
    groupId: "runtime-defaults",
    label: "Runtime network",
    kind: "text",
    helpText: "Docker network used for managed runtime containers.",
    defaultValue: "atoll-network",
    placeholder: "atoll-network"
  },
  {
    key: "RUNTIME_PROVIDER",
    groupId: "runtime-defaults",
    label: "Default provider",
    kind: "select",
    helpText: "Default hosted provider used for new helpers.",
    defaultValue: "openrouter",
    options: [{ value: "openrouter", label: "OpenRouter" }]
  },
  {
    key: "RUNTIME_MODEL",
    groupId: "runtime-defaults",
    label: "Default model",
    kind: "text",
    helpText: "Default hosted model applied to new helpers when no dedicated override is provided.",
    defaultValue: "anthropic/claude-sonnet-4.6",
    placeholder: "anthropic/claude-sonnet-4.6"
  },
  {
    key: "ATOLL_LLM_PROVIDER_API_KEY",
    groupId: "runtime-defaults",
    label: "API key",
    kind: "text",
    helpText: "Optional default API key used when a helper does not have a dedicated key.",
    defaultValue: "",
    placeholder: "sk-or-v1-..."
  },
  {
    key: "RUNTIME_TELEGRAM_MODEL_OVERRIDE",
    groupId: "runtime-defaults",
    label: "Telegram model override",
    kind: "text",
    helpText: "Optional override used when Telegram-enabled helpers need a different model.",
    defaultValue: "",
    placeholder: "Leave blank to reuse the default model"
  },
  {
    key: "RUNTIME_ZEROCLAW_IMAGE",
    groupId: "runtime-behavior",
    label: "ZeroClaw image",
    kind: "text",
    helpText: "Image used for ZeroClaw runtimes when the host catalog includes them.",
    defaultValue: "zivhm/zeroclaw-runtime",
    placeholder: "zivhm/zeroclaw-runtime"
  },
  {
    key: "RUNTIME_OPENCLAW_IMAGE",
    groupId: "runtime-behavior",
    label: "OpenClaw image",
    kind: "text",
    helpText: "Image used for OpenClaw runtimes.",
    defaultValue: "zivhm/openclaw",
    placeholder: "zivhm/openclaw"
  },
  {
    key: "RUNTIME_HERMES_IMAGE",
    groupId: "runtime-behavior",
    label: "Hermes image",
    kind: "text",
    helpText: "Image used for Hermes runtimes.",
    defaultValue: "nousresearch/hermes-agent",
    placeholder: "nousresearch/hermes-agent"
  },
  {
    key: "ATOLL_SUPPORTED_RUNTIME_TYPES",
    groupId: "runtime-behavior",
    label: "Supported runtime types",
    kind: "text",
    helpText: "Optional comma-separated allowlist for runtime types. Leave blank for built-in support.",
    defaultValue: "",
    placeholder: "openclaw,zeroclaw,hermes"
  },
  {
    key: "ATOLL_DEFAULT_RUNTIME_TYPE",
    groupId: "runtime-behavior",
    label: "Default runtime type",
    kind: "select",
    helpText: "Default runtime offered first in helper provisioning.",
    defaultValue: "",
    options: [
      { value: "", label: "Built-in default" },
      { value: "openclaw", label: "OpenClaw" },
      { value: "zeroclaw", label: "ZeroClaw" },
      { value: "hermes", label: "Hermes" }
    ]
  },
  {
    key: "RUNTIME_PROCESS_MODE",
    groupId: "runtime-behavior",
    label: "Runtime process mode",
    kind: "select",
    helpText: "Host process strategy for runtime operations.",
    defaultValue: "daemon",
    options: [
      { value: "daemon", label: "Daemon" },
      { value: "gateway", label: "Gateway" }
    ]
  },
  {
    key: "RUNTIME_REQUIRE_PAIRING",
    groupId: "runtime-behavior",
    label: "Require pairing",
    kind: "boolean",
    helpText: "Require runtime pairing by default when the selected runtime supports it.",
    defaultValue: false
  },
  {
    key: "RUNTIME_ALLOW_PUBLIC_BIND",
    groupId: "runtime-behavior",
    label: "Publish runtime on host loopback",
    kind: "boolean",
    helpText: "Publish runtime gateways to 127.0.0.1 on the host instead of keeping them container-only.",
    defaultValue: true
  },
  {
    key: "RUNTIME_STARTUP_VALIDATION",
    groupId: "runtime-behavior",
    label: "Startup validation",
    kind: "select",
    helpText: "Runtime prerequisite validation behavior when the API boots.",
    defaultValue: "strict",
    options: [
      { value: "strict", label: "Strict" },
      { value: "warn", label: "Warn" },
      { value: "off", label: "Off" }
    ]
  }
];

const SETTINGS_CONFIG_KEYS = new Set(SETTINGS_CONFIG_FIELDS.map((field) => field.key));

export function readSettingsConfigSnapshot(input: {
  envFilePath: string;
  restartRequired?: boolean;
}): SettingsConfigSnapshot {
  const envValues = readEnvFileValues(input.envFilePath);

  return {
    groups: SETTINGS_CONFIG_GROUPS.map((group) => ({
      ...group,
      fields: SETTINGS_CONFIG_FIELDS.filter((field) => field.groupId === group.id).map((field) =>
        materializeField(field, envValues)
      )
    })),
    restartRequired: input.restartRequired ?? false,
    restartMessage: SETTINGS_RESTART_MESSAGE,
    warning: SETTINGS_WARNING
  };
}

export function parseSettingsConfigUpdateInput(payload: unknown): Record<string, string | boolean> {
  const body = payload as { values?: unknown };
  if (!body || typeof body !== "object" || !body.values || typeof body.values !== "object" || Array.isArray(body.values)) {
    throw new Error("Validation failed: values object is required");
  }

  const rawValues = body.values as Record<string, unknown>;
  const unknownKeys = Object.keys(rawValues).filter((key) => !SETTINGS_CONFIG_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Validation failed: unsupported config keys: ${unknownKeys.join(", ")}`);
  }

  const parsedEntries = SETTINGS_CONFIG_FIELDS.flatMap((field) => {
    if (!Object.prototype.hasOwnProperty.call(rawValues, field.key)) {
      return [];
    }
    return [[field.key, parseFieldUpdate(field, rawValues[field.key])]] as const;
  });

  if (parsedEntries.length === 0) {
    throw new Error("Validation failed: at least one config value is required");
  }

  return Object.fromEntries(parsedEntries);
}

export function writeSettingsConfigValues(
  envFilePath: string,
  updates: Record<string, string | boolean>
): void {
  const resolvedPath = resolve(envFilePath);
  const existingText = existsSync(resolvedPath) ? readFileSync(resolvedPath, "utf8") : "";
  const existingLines = existingText.length > 0 ? existingText.split(/\r?\n/u) : [];
  const pendingKeys = new Set(Object.keys(updates));
  const seenKeys = new Set<string>();
  const nextLines: string[] = [];

  for (const line of existingLines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/u);
    if (!match || !match[1]) {
      nextLines.push(line);
      continue;
    }

    const key = match[1];
    if (!pendingKeys.has(key)) {
      nextLines.push(line);
      continue;
    }

    if (seenKeys.has(key)) {
      continue;
    }

    nextLines.push(`${key}=${serializeEnvValue(updates[key])}`);
    seenKeys.add(key);
    pendingKeys.delete(key);
  }

  for (const group of SETTINGS_CONFIG_GROUPS) {
    const missingFields = SETTINGS_CONFIG_FIELDS.filter(
      (field) => field.groupId === group.id && pendingKeys.has(field.key)
    );
    if (missingFields.length === 0) {
      continue;
    }

    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(`# Managed by Atoll Settings: ${group.title}`);
    for (const field of missingFields) {
      nextLines.push(`${field.key}=${serializeEnvValue(updates[field.key])}`);
      pendingKeys.delete(field.key);
    }
  }

  const output = `${trimTrailingBlankLines(nextLines).join("\n")}\n`;
  const tempPath = `${resolvedPath}.settings.tmp`;
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(tempPath, output, "utf8");
  renameSync(tempPath, resolvedPath);
}

function materializeField(
  field: SettingsConfigFieldDefinition,
  envValues: Record<string, string>
): SettingsConfigField {
  const hasExplicitValue = Object.prototype.hasOwnProperty.call(envValues, field.key);
  const rawValue = hasExplicitValue ? envValues[field.key] : undefined;

  return {
    key: field.key,
    label: field.label,
    kind: field.kind,
    helpText: field.helpText,
    placeholder: field.placeholder,
    options: field.options,
    value:
      field.kind === "boolean"
        ? hasExplicitValue
          ? parseBooleanEnv(rawValue, Boolean(field.defaultValue))
          : Boolean(field.defaultValue)
        : hasExplicitValue
          ? rawValue ?? ""
          : String(field.defaultValue),
    source: hasExplicitValue ? "env" : "default"
  };
}

function parseFieldUpdate(
  field: SettingsConfigFieldDefinition,
  value: unknown
): string | boolean {
  if (field.kind === "boolean") {
    return parseBooleanUnknown(value, false);
  }

  const normalized = getOptionalTrimmedString(value) ?? "";
  if (field.kind === "select" && field.options) {
    const allowedValues = new Set(field.options.map((option) => option.value));
    if (!allowedValues.has(normalized)) {
      throw new Error(`Validation failed: ${field.key} must be one of ${[...allowedValues].join(", ")}`);
    }
  }

  return normalized;
}

function readEnvFileValues(envFilePath: string): Record<string, string> {
  const resolvedPath = resolve(envFilePath);
  if (!existsSync(resolvedPath)) {
    return {};
  }

  const raw = readFileSync(resolvedPath, "utf8");
  return Object.fromEntries(
    Object.entries(parseEnv(raw)).map(([key, value]) => [key, value ?? ""])
  );
}

function serializeEnvValue(value: string | boolean | undefined): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  const normalized = value ?? "";
  if (
    normalized === "" ||
    /[\s#"'`]/u.test(normalized) ||
    /\n/u.test(normalized)
  ) {
    return JSON.stringify(normalized);
  }

  return normalized;
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const next = [...lines];
  while (next.length > 0 && next[next.length - 1] === "") {
    next.pop();
  }
  return next;
}
