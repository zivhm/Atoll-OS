import { normalizeAgentSkills } from "./agent-types.js";
import type { AgentPresetCatalogItem } from "./agent-presets.js";

export const AGENT_INSTALLED_SKILL_SOURCE_KINDS = [
  "manual",
  "preset",
  "curated",
  "legacy"
] as const;

export type AgentInstalledSkillSourceKind =
  (typeof AGENT_INSTALLED_SKILL_SOURCE_KINDS)[number];

export type AgentInstalledSkill = {
  key: string;
  ref: string;
  label: string;
  sourceKind: AgentInstalledSkillSourceKind;
  installedAt: string;
  updatedAt: string;
};

export type AgentSkillCatalogItem = {
  key: string;
  ref: string;
  label: string;
  installed: boolean;
  enabled: boolean;
  sourcePresets: Array<{
    presetId: string;
    presetName: string;
  }>;
};

type AgentInstalledSkillInput = Partial<AgentInstalledSkill> & {
  ref?: string;
  key?: string;
  label?: string;
  sourceKind?: string;
};

type ResolveAgentSkillStateInput = {
  skills?: Iterable<string>;
  installedSkills?: Iterable<AgentInstalledSkillInput>;
  presetSkillRefs?: Iterable<string>;
  now?: string;
};

export function isTrustedSkillRef(ref: string): boolean {
  const normalized = ref.trim();
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" && parsed.hostname === "skills.sh";
  } catch {
    return false;
  }
}

export function deriveSkillKey(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (isTrustedSkillRef(normalized)) {
    const pathname = new URL(normalized).pathname.replace(/\/+$/u, "");
    const slug = pathname.split("/").filter(Boolean).at(-1) ?? "";
    return slug.trim().toLowerCase();
  }

  return normalized.toLowerCase();
}

export function formatSkillLabel(value: string): string {
  const key = deriveSkillKey(value);
  if (!key) {
    return "";
  }

  return key
    .split(/[-_]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeInstalledSkillSourceKind(
  value: string | undefined,
  fallback: AgentInstalledSkillSourceKind
): AgentInstalledSkillSourceKind {
  if (
    value === "manual" ||
    value === "preset" ||
    value === "curated" ||
    value === "legacy"
  ) {
    return value;
  }

  return fallback;
}

export function normalizeInstalledSkills(
  input: Iterable<AgentInstalledSkillInput> | undefined,
  now = new Date().toISOString()
): AgentInstalledSkill[] {
  if (!input) {
    return [];
  }

  const normalized: AgentInstalledSkill[] = [];
  const keyIndex = new Set<string>();
  const refIndex = new Set<string>();

  for (const item of input) {
    if (!item || typeof item !== "object") {
      throw new Error("Validation failed: installedSkills must contain objects");
    }

    const ref = typeof item.ref === "string" ? item.ref.trim() : "";
    if (!ref) {
      throw new Error("Validation failed: installedSkills must contain a ref");
    }

    const sourceKind = normalizeInstalledSkillSourceKind(
      typeof item.sourceKind === "string" ? item.sourceKind.trim().toLowerCase() : undefined,
      "manual"
    );
    if (sourceKind !== "legacy" && !isTrustedSkillRef(ref)) {
      throw new Error("Validation failed: installedSkills refs must use trusted https://skills.sh URLs");
    }

    const key =
      typeof item.key === "string" && item.key.trim()
        ? item.key.trim().toLowerCase()
        : deriveSkillKey(ref);
    if (!key) {
      throw new Error("Validation failed: installedSkills must resolve to a key");
    }

    const refKey = ref.toLowerCase();
    if (keyIndex.has(key)) {
      throw new Error(`Validation failed: duplicate installedSkills key '${key}'`);
    }
    if (refIndex.has(refKey)) {
      throw new Error(`Validation failed: duplicate installedSkills ref '${ref}'`);
    }

    keyIndex.add(key);
    refIndex.add(refKey);

    normalized.push({
      key,
      ref,
      label:
        typeof item.label === "string" && item.label.trim()
          ? item.label.trim()
          : formatSkillLabel(key),
      sourceKind,
      installedAt:
        typeof item.installedAt === "string" && item.installedAt.trim()
          ? item.installedAt.trim()
          : now,
      updatedAt:
        typeof item.updatedAt === "string" && item.updatedAt.trim()
          ? item.updatedAt.trim()
          : now
    });
  }

  return normalized;
}

export function buildInstalledSkillsFromRefs(
  refs: Iterable<string> | undefined,
  sourceKind: AgentInstalledSkillSourceKind,
  now = new Date().toISOString()
): AgentInstalledSkill[] {
  const items = normalizeAgentSkills(refs).map((ref) => ({
    key: deriveSkillKey(ref),
    ref: ref.trim(),
    label: formatSkillLabel(ref),
    sourceKind,
    installedAt: now,
    updatedAt: now
  }));

  return normalizeInstalledSkills(items, now);
}

export function resolveEnabledSkillKeys(
  skills: Iterable<string> | undefined,
  installedSkills: AgentInstalledSkill[]
): string[] {
  if (installedSkills.length === 0) {
    return [];
  }

  const installedByKey = new Map(
    installedSkills.map((skill) => [skill.key.toLowerCase(), skill.key] as const)
  );
  const normalizedInput = normalizeAgentSkills(skills);
  const requestedKeys =
    normalizedInput.length > 0
      ? normalizedInput.map((value) => deriveSkillKey(value))
      : installedSkills.map((skill) => skill.key);

  const enabled: string[] = [];
  const seen = new Set<string>();

  for (const requestedKey of requestedKeys) {
    const installedKey = installedByKey.get(requestedKey.toLowerCase());
    if (!installedKey) {
      throw new Error("Validation failed: skills must be a subset of installedSkills");
    }
    const key = installedKey.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    enabled.push(installedKey);
  }

  return enabled;
}

export function resolveAgentSkillState(
  input: ResolveAgentSkillStateInput
): {
  skills: string[];
  installedSkills: AgentInstalledSkill[];
} {
  const now = input.now ?? new Date().toISOString();
  const explicitInstalled = normalizeInstalledSkills(input.installedSkills, now);
  const presetInstalled =
    explicitInstalled.length > 0
      ? explicitInstalled
      : buildInstalledSkillsFromRefs(input.presetSkillRefs, "preset", now);
  const legacyInstalled =
    presetInstalled.length > 0
      ? presetInstalled
      : buildInstalledSkillsFromRefs(input.skills, "legacy", now);

  const installedSkills = legacyInstalled;
  const skills = resolveEnabledSkillKeys(input.skills, installedSkills);

  return {
    skills,
    installedSkills
  };
}

export function buildAgentSkillCatalog(input: {
  presets: AgentPresetCatalogItem[];
  installedSkills?: AgentInstalledSkill[];
  enabledSkills?: string[];
}): AgentSkillCatalogItem[] {
  const installedKeys = new Set(
    (input.installedSkills ?? []).map((skill) => skill.key.toLowerCase())
  );
  const enabledKeys = new Set(
    normalizeAgentSkills(input.enabledSkills).map((skill) => deriveSkillKey(skill))
  );

  const items = new Map<string, AgentSkillCatalogItem>();

  for (const preset of input.presets) {
    for (const ref of preset.recommendedSkills) {
      const key = deriveSkillKey(ref);
      if (!key) {
        continue;
      }

      const existing = items.get(key);
      if (existing) {
        existing.sourcePresets.push({
          presetId: preset.id,
          presetName: preset.name
        });
        continue;
      }

      items.set(key, {
        key,
        ref,
        label: formatSkillLabel(ref),
        installed: installedKeys.has(key),
        enabled: enabledKeys.has(key),
        sourcePresets: [
          {
            presetId: preset.id,
            presetName: preset.name
          }
        ]
      });
    }
  }

  return [...items.values()].sort((left, right) => left.label.localeCompare(right.label));
}
