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
    const parts = pathname.split("/").filter(Boolean);
    const lastPart = parts.length > 0 ? parts[parts.length - 1] : "";
    return lastPart?.trim().toLowerCase() ?? "";
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
