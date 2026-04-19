const SKILLS_SH_HOSTNAME = "skills.sh";
const GITHUB_HOSTNAME = "github.com";
const RAW_GITHUB_HOSTNAME = "raw.githubusercontent.com";

export function isSkillsShRef(ref: string): boolean {
  const parsed = tryParseUrl(ref.trim());
  return Boolean(parsed && parsed.protocol === "https:" && parsed.hostname === SKILLS_SH_HOSTNAME);
}

export function isSupportedSkillRef(ref: string, explicitKey?: string): boolean {
  const normalized = ref.trim();
  const key = deriveSkillKey(normalized, explicitKey);
  if (!normalized || !key) {
    return false;
  }

  if (isLikelyLocalSkillPath(normalized) && !/^https?:/iu.test(normalized)) {
    return true;
  }

  const parsed = tryParseUrl(normalized);
  if (parsed) {
    if (isSkillsShRef(normalized)) {
      return true;
    }

    if (parsed.hostname === GITHUB_HOSTNAME) {
      return getUrlPathSegments(parsed).length >= 2;
    }

    if (parsed.hostname === RAW_GITHUB_HOSTNAME || parsed.pathname.endsWith(".md")) {
      return true;
    }

    return false;
  }

  return false;
}

export function deriveSkillKey(value: string, explicitKey?: string): string {
  const normalizedExplicitKey = explicitKey?.trim().toLowerCase();
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

  const parsed = tryParseUrl(normalized);
  if (parsed) {
    if (isSkillsShRef(normalized)) {
      return deriveSkillKeyFromUrl(parsed);
    }

    if (parsed.hostname === GITHUB_HOSTNAME) {
      const pathSegments = getUrlPathSegments(parsed);
      if (pathSegments.length === 2) {
        return "";
      }
      return deriveSkillKeyFromUrl(parsed);
    }

    if (parsed.hostname === RAW_GITHUB_HOSTNAME || parsed.pathname.endsWith(".md")) {
      return deriveSkillKeyFromUrl(parsed);
    }
  }

  return normalized.toLowerCase();
}

export function formatSkillLabel(value: string, explicitKey?: string): string {
  const key = deriveSkillKey(value, explicitKey);
  if (!key) {
    return "";
  }

  return key
    .split(/[-_]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function deriveSkillKeyFromUrl(url: URL): string {
  const segments = getUrlPathSegments(url);
  if (segments.length === 0) {
    return "";
  }

  const lastSegment = segments[segments.length - 1] ?? "";
  if (/^skill\.md$/iu.test(lastSegment) && segments.length >= 2) {
    return (segments[segments.length - 2] ?? "").trim().toLowerCase();
  }

  return lastSegment.replace(/\.md$/iu, "").trim().toLowerCase();
}

function deriveSkillKeyFromLocalPath(value: string): string {
  const normalized = value.replace(/[\\/]+$/u, "");
  const parts = normalized.split(/[\\/]/u).filter(Boolean);
  const lastPart = parts[parts.length - 1] ?? "";
  if (/^skill\.md$/iu.test(lastPart) && parts.length >= 2) {
    return (parts[parts.length - 2] ?? "").trim().toLowerCase();
  }
  return lastPart.replace(/\.md$/iu, "").trim().toLowerCase();
}

function isLikelyLocalSkillPath(value: string): boolean {
  if (!value) {
    return false;
  }

  if (/^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("\\\\")) {
    return true;
  }

  if (value.startsWith("./") || value.startsWith("../") || value.startsWith("~/")) {
    return true;
  }

  return value.includes("\\") || value.includes("/");
}
