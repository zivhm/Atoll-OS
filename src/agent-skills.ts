import { normalizeAgentSkills } from "./agent-types.js";
import type { AgentPresetCatalogItem } from "./agent-presets.js";

const SKILLS_SH_HOSTNAME = "skills.sh";
const GITHUB_HOSTNAME = "github.com";
const RAW_GITHUB_HOSTNAME = "raw.githubusercontent.com";

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
  return isSkillsShRef(ref);
}

export function isSkillsShRef(ref: string): boolean {
  const normalized = ref.trim();
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" && parsed.hostname === SKILLS_SH_HOSTNAME;
  } catch {
    return false;
  }
}

export type SkillInstallSource =
  | {
      kind: "github";
      key: string;
      source: string;
      packageRef: string;
    }
  | {
      kind: "local-path";
      key: string;
      path: string;
    }
  | {
      kind: "remote-markdown";
      key: string;
      url: string;
    };

export function isSupportedSkillRef(ref: string, key?: string): boolean {
  return resolveSkillInstallSource({ ref, key }) !== undefined;
}

export function deriveSkillKey(value: string, explicitKey?: string): string {
  const normalizedExplicitKey = normalizeSkillKey(explicitKey);
  if (normalizedExplicitKey) {
    return normalizedExplicitKey;
  }

  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (isLikelyLocalSkillPath(normalized) && !/^https?:/iu.test(normalized)) {
    return deriveSkillKeyFromLocalPath(normalized);
  }

  const parsedUrl = tryParseUrl(normalized);
  if (parsedUrl) {
    if (isSkillsShRef(normalized)) {
      return deriveSkillKeyFromUrlPath(parsedUrl);
    }

    if (parsedUrl.hostname === GITHUB_HOSTNAME) {
      const pathSegments = getUrlPathSegments(parsedUrl);
      if (pathSegments.length === 2) {
        return "";
      }
      return deriveSkillKeyFromUrlPath(parsedUrl);
    }

    if (parsedUrl.hostname === RAW_GITHUB_HOSTNAME || parsedUrl.pathname.endsWith(".md")) {
      return deriveSkillKeyFromUrlPath(parsedUrl);
    }
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
    const key =
      typeof item.key === "string" && item.key.trim()
        ? normalizeSkillKey(item.key)
        : deriveSkillKey(ref);
    if (sourceKind !== "legacy" && !isSupportedSkillRef(ref, key)) {
      throw new Error("Validation failed: installedSkills refs must use a supported skill source");
    }
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

export function resolveSkillInstallSource(input: {
  ref: string;
  key?: string;
}): SkillInstallSource | undefined {
  const ref = input.ref.trim();
  const key = deriveSkillKey(ref, input.key);
  if (!ref || !key) {
    return undefined;
  }

  if (isLikelyLocalSkillPath(ref) && !/^https?:/iu.test(ref)) {
    return {
      kind: "local-path",
      key,
      path: ref
    };
  }

  const parsedUrl = tryParseUrl(ref);
  if (parsedUrl) {
    if (isSkillsShRef(ref)) {
      const segments = getUrlPathSegments(parsedUrl);
      if (segments.length < 3) {
        return undefined;
      }
      const source = `${segments[0]}/${segments[1]}`;
      return {
        kind: "github",
        key,
        source,
        packageRef: `https://github.com/${source}`
      };
    }

    if (parsedUrl.hostname === GITHUB_HOSTNAME) {
      const source = resolveGithubSourceFromUrl(parsedUrl);
      if (!source) {
        return undefined;
      }
      return {
        kind: "github",
        key,
        source,
        packageRef: `https://github.com/${source}`
      };
    }

    if (parsedUrl.hostname === RAW_GITHUB_HOSTNAME || parsedUrl.pathname.endsWith(".md")) {
      return {
        kind: "remote-markdown",
        key,
        url: ref
      };
    }

    return undefined;
  }

  return undefined;
}

function normalizeSkillKey(value: string | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function tryParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function getUrlPathSegments(url: URL): string[] {
  return url.pathname.replace(/\/+$/u, "").split("/").filter(Boolean);
}

function deriveSkillKeyFromUrlPath(url: URL): string {
  const segments = getUrlPathSegments(url);
  if (segments.length === 0) {
    return "";
  }

  const lastSegment = segments.at(-1) ?? "";
  if (/^skill\.md$/iu.test(lastSegment) && segments.length >= 2) {
    return (segments.at(-2) ?? "").trim().toLowerCase();
  }

  return lastSegment.replace(/\.md$/iu, "").trim().toLowerCase();
}

function deriveSkillKeyFromLocalPath(value: string): string {
  const normalized = value.replace(/[\\/]+$/u, "");
  const parts = normalized.split(/[\\/]/u).filter(Boolean);
  const lastPart = parts.at(-1) ?? "";
  if (/^skill\.md$/iu.test(lastPart) && parts.length >= 2) {
    return (parts.at(-2) ?? "").trim().toLowerCase();
  }
  return lastPart.replace(/\.md$/iu, "").trim().toLowerCase();
}

function resolveGithubSourceFromUrl(url: URL): string | undefined {
  const segments = getUrlPathSegments(url);
  if (segments.length < 2) {
    return undefined;
  }

  return `${segments[0]}/${segments[1]}`;
}

function isLikelyLocalSkillPath(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (/^[A-Za-z]:[\\/]/u.test(normalized) || normalized.startsWith("\\\\")) {
    return true;
  }

  if (normalized.startsWith("./") || normalized.startsWith("../") || normalized.startsWith("~/")) {
    return true;
  }

  if (normalized.includes("\\")) {
    return true;
  }

  if (normalized.includes("/")) {
    return true;
  }

  return false;
}
