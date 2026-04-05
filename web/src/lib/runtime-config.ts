import type { RuntimeConfigFieldDescriptor } from "@/lib/api";

export type RuntimeConfigFormState = Record<string, string | boolean>;

export function buildRuntimeConfigFormState(input: {
  fields: RuntimeConfigFieldDescriptor[];
  runtimeOptions?: Record<string, unknown>;
}): RuntimeConfigFormState {
  const state: RuntimeConfigFormState = {};

  for (const field of input.fields) {
    if (field.secret) {
      state[field.key] = "";
      continue;
    }

    const sourceValue = input.runtimeOptions?.[field.key] ?? field.defaultValue;
    if (field.kind === "boolean") {
      state[field.key] = typeof sourceValue === "boolean" ? sourceValue : Boolean(sourceValue);
      continue;
    }

    if (sourceValue === undefined || sourceValue === null) {
      state[field.key] = "";
      continue;
    }

    if (field.kind === "json" && typeof sourceValue !== "string") {
      state[field.key] = JSON.stringify(sourceValue, null, 2);
      continue;
    }

    state[field.key] = String(sourceValue);
  }

  return state;
}

export function parseRuntimeConfigFormState(input: {
  fields: RuntimeConfigFieldDescriptor[];
  values: RuntimeConfigFormState;
  requireSecretValues?: boolean;
}): {
  runtimeOptions: Record<string, unknown>;
  runtimeSecrets?: Record<string, string>;
} {
  const runtimeOptions: Record<string, unknown> = {};
  const runtimeSecrets: Record<string, string> = {};

  for (const field of input.fields) {
    if (field.kind === "boolean") {
      runtimeOptions[field.key] = Boolean(input.values[field.key] ?? field.defaultValue ?? false);
      continue;
    }

    const rawValue = input.values[field.key];
    const stringValue = typeof rawValue === "string" ? rawValue.trim() : "";

    if (field.secret) {
      if (!stringValue) {
        if (field.required && input.requireSecretValues) {
          throw new Error(`${field.label} is required`);
        }
        continue;
      }

      runtimeSecrets[field.key] = stringValue;
      continue;
    }

    if (!stringValue) {
      if (field.required) {
        throw new Error(`${field.label} is required`);
      }
      continue;
    }

    runtimeOptions[field.key] = parseRuntimeConfigValue(field, stringValue);
  }

  return {
    runtimeOptions,
    runtimeSecrets: Object.keys(runtimeSecrets).length > 0 ? runtimeSecrets : undefined,
  };
}

function parseRuntimeConfigValue(field: RuntimeConfigFieldDescriptor, value: string): unknown {
  if (field.kind === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${field.label} must be a valid number`);
    }
    return parsed;
  }

  if (field.kind === "json") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error(`${field.label} must be valid JSON`);
    }
  }

  return value;
}
