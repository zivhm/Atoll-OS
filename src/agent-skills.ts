import { normalizeAgentSkills } from "./agent-types.js";
import type { AgentPresetCatalogItem } from "./agent-presets.js";

const SKILLS_SH_HOSTNAME = "skills.sh";
const AGENTSKILLS_HOSTNAME = "agentskills.co.il";
const GITHUB_HOSTNAME = "github.com";
const RAW_GITHUB_HOSTNAME = "raw.githubusercontent.com";
const LOCAL_SKILL_SOURCE_HOST = "local";
const REMOTE_SKILL_SOURCE_HOST = "remote";
const REMOTE_SKILL_METADATA_TTL_MS = 6 * 60 * 60 * 1000;
const REMOTE_SKILL_METADATA_TIMEOUT_MS = 2500;
const REMOTE_SKILL_METADATA_CONCURRENCY = 4;
const AGENTSKILLS_DISCOVERY_URL = "https://agentskills.co.il/en/skills";
const AGENTSKILLS_DISCOVERY_TTL_MS = 30 * 60 * 1000;
const AGENTSKILLS_DISCOVERY_TIMEOUT_MS = 3000;
const AGENTSKILLS_DISCOVERY_MAX_PER_CATEGORY = 16;

export const AGENT_INSTALLED_SKILL_SOURCE_KINDS = [
  "manual",
  "preset",
  "curated",
  "legacy"
] as const;

export const AGENT_SKILL_METADATA_STATUSES = ["local", "remote", "stale"] as const;

export type AgentInstalledSkillSourceKind =
  (typeof AGENT_INSTALLED_SKILL_SOURCE_KINDS)[number];
export type AgentSkillMetadataStatus =
  (typeof AGENT_SKILL_METADATA_STATUSES)[number];

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
  summary: string;
  provider: string;
  sourceHost: string;
  recommendedForCurrentPreset: boolean;
  originCategories: string[];
  metadataStatus: AgentSkillMetadataStatus;
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

type ParsedPresetToolsSkillMetadata = {
  byKey: Map<string, string>;
  byRef: Map<string, string>;
};

type RemoteSkillMetadata = {
  label?: string;
  summary?: string;
  provider?: string;
  sourceHost?: string;
};

type CachedRemoteSkillMetadata = {
  value: RemoteSkillMetadata;
  fetchedAtMs: number;
  expiresAtMs: number;
};

type RemoteSkillMetadataResolution = {
  value: RemoteSkillMetadata;
  status: Exclude<AgentSkillMetadataStatus, "local">;
};

type EnrichAgentSkillCatalogItemsInput = {
  items: AgentSkillCatalogItem[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  concurrency?: number;
  ttlMs?: number;
  nowMs?: number;
};

export type DiscoverExternalSkillPresetsInput = {
  currentPresetId?: string;
  currentPresetCategory?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  ttlMs?: number;
  nowMs?: number;
};

type CachedExternalSkillPresets = {
  value: AgentPresetCatalogItem[];
  fetchedAtMs: number;
  expiresAtMs: number;
};

const REMOTE_SKILL_METADATA_CACHE = new Map<string, CachedRemoteSkillMetadata>();
const REMOTE_SKILL_METADATA_INFLIGHT = new Map<
  string,
  Promise<RemoteSkillMetadata | undefined>
>();
const EXTERNAL_SKILL_PRESETS_CACHE = new Map<string, CachedExternalSkillPresets>();

const PRESET_CATEGORY_TO_AGENTSKILLS_CATEGORIES: Record<string, string[]> = {
  finance: ["tax-and-finance", "developer-tools"],
  sales: ["marketing-growth", "localization"],
  support: ["localization", "government-services"],
  marketing: ["marketing-growth", "localization"],
  operations: ["government-services", "developer-tools", "localization"],
  "project-management": ["developer-tools", "marketing-growth"],
  strategy: ["marketing-growth", "developer-tools", "localization"],
  engineering: ["developer-tools", "localization"]
};

const DEFAULT_AGENTSKILLS_CATEGORIES = [
  "developer-tools",
  "marketing-growth",
  "localization",
  "tax-and-finance"
];

export function isTrustedSkillRef(ref: string): boolean {
  return isSkillsShRef(ref) || isAgentSkillsRef(ref);
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

export function isAgentSkillsRef(ref: string): boolean {
  const normalized = ref.trim();
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" && parsed.hostname === AGENTSKILLS_HOSTNAME;
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
    if (isSkillsShRef(normalized) || isAgentSkillsRef(normalized)) {
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
  currentPresetId?: string;
}): AgentSkillCatalogItem[] {
  const installedKeys = new Set(
    (input.installedSkills ?? []).map((skill) => skill.key.toLowerCase())
  );
  const enabledKeys = new Set(
    normalizeAgentSkills(input.enabledSkills).map((skill) => deriveSkillKey(skill))
  );
  const currentPresetId = input.currentPresetId?.trim() ?? "";

  const items = new Map<string, AgentSkillCatalogItem>();

  for (const preset of input.presets) {
    const presetToolsMetadata = parsePresetToolsSkillMetadata(preset.tools);
    for (const ref of preset.recommendedSkills) {
      const key = deriveSkillKey(ref);
      if (!key) {
        continue;
      }
      const localSummary =
        presetToolsMetadata.byKey.get(key) ??
        presetToolsMetadata.byRef.get(ref.toLowerCase()) ??
        "";
      const recommendedForCurrentPreset = isPresetRelatedToCurrentPreset(
        preset.id,
        currentPresetId
      );

      const existing = items.get(key);
      if (existing) {
        existing.sourcePresets.push({
          presetId: preset.id,
          presetName: preset.name
        });
        if (!existing.summary && localSummary) {
          existing.summary = localSummary;
        }
        if (recommendedForCurrentPreset) {
          existing.recommendedForCurrentPreset = true;
        }
        if (!existing.originCategories.includes(preset.category)) {
          existing.originCategories.push(preset.category);
        }
        continue;
      }

      items.set(key, {
        key,
        ref,
        label: formatSkillLabel(ref),
        installed: installedKeys.has(key),
        enabled: enabledKeys.has(key),
        summary: localSummary,
        provider: deriveSkillProvider(ref, key),
        sourceHost: deriveSkillSourceHost(ref),
        recommendedForCurrentPreset,
        originCategories: [preset.category],
        metadataStatus: "local",
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

export async function enrichAgentSkillCatalogItems(
  input: EnrichAgentSkillCatalogItemsInput
): Promise<AgentSkillCatalogItem[]> {
  const items = [...input.items];
  if (items.length === 0) {
    return items;
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = Math.max(250, input.timeoutMs ?? REMOTE_SKILL_METADATA_TIMEOUT_MS);
  const concurrency = Math.max(1, input.concurrency ?? REMOTE_SKILL_METADATA_CONCURRENCY);
  const ttlMs = Math.max(1000, input.ttlMs ?? REMOTE_SKILL_METADATA_TTL_MS);
  const nowMs = input.nowMs ?? Date.now();

  await runWithConcurrency(items, concurrency, async (item, index) => {
    if (!isRemoteHttpSkillRef(item.ref)) {
      return;
    }

    const resolution = await resolveRemoteSkillMetadata({
      ref: item.ref,
      fetchImpl,
      timeoutMs,
      ttlMs,
      nowMs
    });
    if (!resolution) {
      return;
    }

    items[index] = mergeCatalogItemWithRemoteMetadata(
      item,
      resolution.value,
      resolution.status
    );
  });

  return items;
}

export function clearAgentSkillMetadataCache(): void {
  REMOTE_SKILL_METADATA_CACHE.clear();
  REMOTE_SKILL_METADATA_INFLIGHT.clear();
}

export async function discoverExternalSkillPresets(
  input: DiscoverExternalSkillPresetsInput
): Promise<AgentPresetCatalogItem[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = Math.max(250, input.timeoutMs ?? AGENTSKILLS_DISCOVERY_TIMEOUT_MS);
  const ttlMs = Math.max(1000, input.ttlMs ?? AGENTSKILLS_DISCOVERY_TTL_MS);
  const nowMs = input.nowMs ?? Date.now();
  const currentPresetId = normalizeProfileMarkerValue(input.currentPresetId);
  const targetCategories = resolveAgentSkillsDiscoveryCategories(input.currentPresetCategory);
  const cacheKey = `${currentPresetId}|${targetCategories.join(",")}`;

  const cached = EXTERNAL_SKILL_PRESETS_CACHE.get(cacheKey);
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.value.map(clonePresetCatalogItem);
  }

  const stale = cached?.value;
  try {
    const response = await fetchImpl(AGENTSKILLS_DISCOVERY_URL, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1"
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      return stale ? stale.map(clonePresetCatalogItem) : [];
    }

    const html = await response.text();
    const discovered = buildExternalSkillPresetsFromAgentSkillsHtml({
      html,
      targetCategories,
      currentPresetId,
      nowMs
    });
    if (discovered.length > 0) {
      EXTERNAL_SKILL_PRESETS_CACHE.set(cacheKey, {
        value: discovered.map(clonePresetCatalogItem),
        fetchedAtMs: nowMs,
        expiresAtMs: nowMs + ttlMs
      });
      return discovered;
    }

    return stale ? stale.map(clonePresetCatalogItem) : [];
  } catch {
    return stale ? stale.map(clonePresetCatalogItem) : [];
  }
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

    if (isAgentSkillsRef(ref)) {
      const source = resolveAgentSkillsGithubSourceFromUrl(parsedUrl);
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

function resolveAgentSkillsGithubSourceFromUrl(url: URL): string | undefined {
  const segments = getUrlPathSegments(url);
  const offset = segments[0] === "en" || segments[0] === "he" ? 1 : 0;
  if (segments[offset] !== "skills") {
    return undefined;
  }

  const category = segments[offset + 1];
  const slug = segments[offset + 2];
  if (!category || !slug) {
    return undefined;
  }

  return `skills-il/${category}`;
}

function resolveAgentSkillsDiscoveryCategories(category: string | undefined): string[] {
  const normalized = category?.trim().toLowerCase() ?? "";
  const candidates = PRESET_CATEGORY_TO_AGENTSKILLS_CATEGORIES[normalized] ?? DEFAULT_AGENTSKILLS_CATEGORIES;
  return [...new Set(candidates.map((item) => item.trim().toLowerCase()).filter(Boolean))];
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

function parsePresetToolsSkillMetadata(markdown: string | undefined): ParsedPresetToolsSkillMetadata {
  const byKey = new Map<string, string>();
  const byRef = new Map<string, string>();

  if (!markdown) {
    return { byKey, byRef };
  }

  for (const line of markdown.split(/\r?\n/u)) {
    const match = line.match(/^\s*-\s*\[[^\]]+\]\(([^)]+)\)\s*:\s*(.+?)\s*$/u);
    if (!match) {
      continue;
    }

    const ref = match[1]?.trim() ?? "";
    const summary = normalizeSkillSummary(match[2]);
    if (!ref || !summary) {
      continue;
    }

    const key = deriveSkillKey(ref);
    if (key && !byKey.has(key)) {
      byKey.set(key, summary);
    }

    const refKey = ref.toLowerCase();
    if (!byRef.has(refKey)) {
      byRef.set(refKey, summary);
    }
  }

  return {
    byKey,
    byRef
  };
}

function buildExternalSkillPresetsFromAgentSkillsHtml(input: {
  html: string;
  targetCategories: string[];
  currentPresetId: string;
  nowMs: number;
}): AgentPresetCatalogItem[] {
  const categoryAllowList = new Set(input.targetCategories.map((item) => item.toLowerCase()));
  const grouped = new Map<string, string[]>();
  const seenByCategory = new Map<string, Set<string>>();
  const pattern = /\/en\/skills\/([a-z0-9-]+)\/([a-z0-9-]+)/giu;

  for (const match of input.html.matchAll(pattern)) {
    const rawCategory = match[1]?.trim().toLowerCase() ?? "";
    const rawSlug = match[2]?.trim().toLowerCase() ?? "";
    if (!rawCategory || !rawSlug) {
      continue;
    }
    if (!categoryAllowList.has(rawCategory)) {
      continue;
    }

    const categorySeen = seenByCategory.get(rawCategory) ?? new Set<string>();
    if (categorySeen.has(rawSlug)) {
      continue;
    }
    if (categorySeen.size >= AGENTSKILLS_DISCOVERY_MAX_PER_CATEGORY) {
      continue;
    }
    categorySeen.add(rawSlug);
    seenByCategory.set(rawCategory, categorySeen);

    const links = grouped.get(rawCategory) ?? [];
    links.push(`https://${AGENTSKILLS_HOSTNAME}/en/skills/${rawCategory}/${rawSlug}`);
    grouped.set(rawCategory, links);
  }

  const timestamp = new Date(input.nowMs).toISOString();
  const currentPresetPrefix = input.currentPresetId ? `${input.currentPresetId}:related:` : "related:";
  const externalPresets: AgentPresetCatalogItem[] = [];
  let position = 10_000;

  for (const [category, recommendedSkills] of grouped.entries()) {
    if (recommendedSkills.length === 0) {
      continue;
    }

    const toolsLines = [
      "# TOOLS.md - Recommended Skills",
      "",
      "Use these optional role-related skills discovered from Skills IL.",
      "",
      ...recommendedSkills.map((ref) => {
        const key = deriveSkillKey(ref);
        return `- [${key}](${ref}): Discovered from Skills IL category \`${category}\`.`;
      })
    ];

    externalPresets.push({
      id: `${currentPresetPrefix}agentskills:${category}`,
      name: `Skills IL · ${formatSlugAsLabel(category)}`,
      description: "Role-related skills discovered dynamically from Skills IL.",
      color: "neutral",
      category: `external-${category}`,
      sourceRepoUrl: `https://${AGENTSKILLS_HOSTNAME}`,
      sourcePath: `/en/skills/${category}`,
      summary: `Discovered role-related skills for category '${category}'.`,
      suggestedRoleTitle: "",
      recommendedSkills,
      identity: "",
      soul: "",
      tools: toolsLines.join("\n"),
      active: true,
      position,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    position += 1;
  }

  return externalPresets;
}

async function resolveRemoteSkillMetadata(input: {
  ref: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  ttlMs: number;
  nowMs: number;
}): Promise<RemoteSkillMetadataResolution | undefined> {
  const cacheKey = input.ref.trim().toLowerCase();
  if (!cacheKey) {
    return undefined;
  }

  const cached = REMOTE_SKILL_METADATA_CACHE.get(cacheKey);
  if (cached && cached.expiresAtMs > input.nowMs) {
    return {
      value: cached.value,
      status: "remote"
    };
  }

  const staleCache = cached?.value;
  const inflight = REMOTE_SKILL_METADATA_INFLIGHT.get(cacheKey);
  if (inflight) {
    const shared = await inflight.catch(() => undefined);
    if (shared && hasRemoteSkillMetadata(shared)) {
      return {
        value: shared,
        status: "remote"
      };
    }
    if (staleCache && hasRemoteSkillMetadata(staleCache)) {
      return {
        value: staleCache,
        status: "stale"
      };
    }
    return undefined;
  }

  const requestPromise = fetchRemoteSkillMetadata({
    ref: input.ref,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs
  });
  REMOTE_SKILL_METADATA_INFLIGHT.set(cacheKey, requestPromise);

  try {
    const remote = await requestPromise;
    if (remote && hasRemoteSkillMetadata(remote)) {
      REMOTE_SKILL_METADATA_CACHE.set(cacheKey, {
        value: remote,
        fetchedAtMs: input.nowMs,
        expiresAtMs: input.nowMs + input.ttlMs
      });
      return {
        value: remote,
        status: "remote"
      };
    }

    if (staleCache && hasRemoteSkillMetadata(staleCache)) {
      return {
        value: staleCache,
        status: "stale"
      };
    }

    return undefined;
  } catch {
    if (staleCache && hasRemoteSkillMetadata(staleCache)) {
      return {
        value: staleCache,
        status: "stale"
      };
    }

    return undefined;
  } finally {
    REMOTE_SKILL_METADATA_INFLIGHT.delete(cacheKey);
  }
}

async function fetchRemoteSkillMetadata(input: {
  ref: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<RemoteSkillMetadata | undefined> {
  const parsed = tryParseUrl(input.ref.trim());
  if (!parsed || !/^https?:$/iu.test(parsed.protocol)) {
    return undefined;
  }

  const response = await input.fetchImpl(parsed.toString(), {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1"
    },
    signal: AbortSignal.timeout(input.timeoutMs)
  });

  if (!response.ok) {
    return undefined;
  }

  const html = await response.text();
  if (!html.trim()) {
    return undefined;
  }

  const metadata = parseRemoteSkillMetadataFromHtml({
    html,
    ref: parsed.toString()
  });
  return hasRemoteSkillMetadata(metadata) ? metadata : undefined;
}

function parseRemoteSkillMetadataFromHtml(input: {
  html: string;
  ref: string;
}): RemoteSkillMetadata {
  const parsedUrl = tryParseUrl(input.ref);
  const sourceHost = parsedUrl?.hostname.toLowerCase() ?? REMOTE_SKILL_SOURCE_HOST;

  const titleTag = extractHtmlTitle(input.html);
  const ogTitle = extractMetaContent(input.html, "og:title");
  const ogDescription = extractMetaContent(input.html, "og:description");
  const description = extractMetaContent(input.html, "description");
  const twitterDescription = extractMetaContent(input.html, "twitter:description");
  const jsonLd = extractJsonLdMetadata(input.html);

  const rawLabel =
    sourceHost === AGENTSKILLS_HOSTNAME
      ? ogTitle ?? titleTag ?? jsonLd.name ?? ""
      : ogTitle ?? jsonLd.name ?? titleTag ?? "";
  const rawSummary = ogDescription ?? twitterDescription ?? description ?? jsonLd.description ?? "";

  return {
    label: normalizeSkillLabel(rawLabel),
    summary: normalizeSkillSummary(rawSummary),
    provider: deriveSkillProvider(input.ref, deriveSkillKey(input.ref)),
    sourceHost
  };
}

function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu);
  if (!match?.[1]) {
    return undefined;
  }

  return decodeHtmlEntities(match[1]).trim();
}

function extractMetaContent(html: string, key: string): string | undefined {
  const keyLower = key.toLowerCase();
  const tagRegex = /<meta\s+[^>]*>/giu;

  for (const tagMatch of html.matchAll(tagRegex)) {
    const tag = tagMatch[0];
    if (!tag) {
      continue;
    }

    const attrs = parseTagAttributes(tag);
    const identifier = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (identifier !== keyLower) {
      continue;
    }

    const content = attrs.content?.trim();
    if (content) {
      return decodeHtmlEntities(content);
    }
  }

  return undefined;
}

function parseTagAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(['"])(.*?)\2/gu;

  for (const match of tag.matchAll(attrRegex)) {
    const rawName = match[1];
    const rawValue = match[3];
    if (!rawName || rawValue === undefined) {
      continue;
    }

    attributes[rawName.toLowerCase()] = rawValue;
  }

  return attributes;
}

function extractJsonLdMetadata(html: string): {
  name?: string;
  description?: string;
} {
  const regex = /<script[^>]+type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/giu;

  for (const match of html.matchAll(regex)) {
    const jsonRaw = match[1]?.trim();
    if (!jsonRaw) {
      continue;
    }

    const parsed = parseJson(jsonRaw);
    if (!parsed) {
      continue;
    }

    const resolved = resolveJsonLdNameAndDescription(parsed);
    if (resolved.name || resolved.description) {
      return resolved;
    }
  }

  return {};
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function resolveJsonLdNameAndDescription(value: unknown): {
  name?: string;
  description?: string;
} {
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = resolveJsonLdNameAndDescription(item);
      if (nested.name || nested.description) {
        return nested;
      }
    }
    return {};
  }

  if (!value || typeof value !== "object") {
    return {};
  }

  const objectValue = value as Record<string, unknown>;
  const name =
    typeof objectValue.name === "string"
      ? normalizeSkillLabel(objectValue.name)
      : undefined;
  const description =
    typeof objectValue.description === "string"
      ? normalizeSkillSummary(objectValue.description)
      : undefined;
  if (name || description) {
    return {
      ...(name ? { name } : {}),
      ...(description ? { description } : {})
    };
  }

  for (const nested of Object.values(objectValue)) {
    const resolved = resolveJsonLdNameAndDescription(nested);
    if (resolved.name || resolved.description) {
      return resolved;
    }
  }

  return {};
}

function mergeCatalogItemWithRemoteMetadata(
  item: AgentSkillCatalogItem,
  metadata: RemoteSkillMetadata,
  status: Exclude<AgentSkillMetadataStatus, "local">
): AgentSkillCatalogItem {
  const nextSummary = metadata.summary || item.summary;
  const nextLabel = metadata.label || item.label;
  const nextProvider = metadata.provider || item.provider;
  const nextSourceHost = metadata.sourceHost || item.sourceHost;

  return {
    ...item,
    label: nextLabel,
    summary: nextSummary,
    provider: nextProvider,
    sourceHost: nextSourceHost,
    metadataStatus: status
  };
}

function hasRemoteSkillMetadata(value: RemoteSkillMetadata): boolean {
  return Boolean(value.label || value.summary || value.provider || value.sourceHost);
}

function deriveSkillSourceHost(ref: string): string {
  const parsed = tryParseUrl(ref.trim());
  if (!parsed) {
    return LOCAL_SKILL_SOURCE_HOST;
  }

  return parsed.hostname.toLowerCase() || REMOTE_SKILL_SOURCE_HOST;
}

function deriveSkillProvider(ref: string, key: string): string {
  const source = resolveSkillInstallSource({ ref, key });
  if (source?.kind === "github") {
    return source.source;
  }
  if (source?.kind === "local-path") {
    return LOCAL_SKILL_SOURCE_HOST;
  }
  if (source?.kind === "remote-markdown") {
    const parsed = tryParseUrl(source.url);
    return parsed?.hostname.toLowerCase() ?? REMOTE_SKILL_SOURCE_HOST;
  }

  const parsed = tryParseUrl(ref);
  if (parsed) {
    return parsed.hostname.toLowerCase();
  }

  return LOCAL_SKILL_SOURCE_HOST;
}

function normalizeSkillLabel(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const decoded = decodeHtmlEntities(value)
    .replace(/\s*[-|]\s*AI Tool\s*\|\s*Skills IL$/iu, "")
    .replace(/\s+by\s+[A-Za-z0-9._/-]+$/u, "")
    .trim();
  if (!decoded) {
    return undefined;
  }

  if (/^[a-z0-9]+(?:[-_][a-z0-9]+)+$/u.test(decoded)) {
    return formatSkillLabel(decoded);
  }

  if (decoded.length > 120) {
    return undefined;
  }

  return decoded;
}

function normalizeSkillSummary(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return decodeHtmlEntities(value).trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&nbsp;/giu, " ");
}

function isRemoteHttpSkillRef(ref: string): boolean {
  const parsed = tryParseUrl(ref.trim());
  return Boolean(parsed && /^https?:$/iu.test(parsed.protocol));
}

function isPresetRelatedToCurrentPreset(presetId: string, currentPresetId: string): boolean {
  const normalizedPresetId = presetId.trim().toLowerCase();
  const normalizedCurrentPresetId = currentPresetId.trim().toLowerCase();
  if (!normalizedPresetId || !normalizedCurrentPresetId) {
    return false;
  }

  return (
    normalizedPresetId === normalizedCurrentPresetId ||
    normalizedPresetId.startsWith(`${normalizedCurrentPresetId}:related:`)
  );
}

function normalizeProfileMarkerValue(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/gu, "-");
}

function formatSlugAsLabel(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function clonePresetCatalogItem(item: AgentPresetCatalogItem): AgentPresetCatalogItem {
  return {
    ...item,
    recommendedSkills: [...item.recommendedSkills]
  };
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  const total = items.length;
  const width = Math.min(total, Math.max(1, concurrency));
  let cursor = 0;

  const runners = Array.from({ length: width }, async () => {
    while (cursor < total) {
      const currentIndex = cursor;
      cursor += 1;
      const item = items[currentIndex];
      if (!item) {
        continue;
      }
      await worker(item, currentIndex);
    }
  });

  await Promise.all(runners);
}
