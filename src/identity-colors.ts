export const IDENTITY_COLOR_TOKENS = [
  "neutral",
  "cyan",
  "blue",
  "green",
  "purple",
  "coral",
  "gold",
  "rose",
] as const;

export type IdentityColorToken = (typeof IDENTITY_COLOR_TOKENS)[number];

const IDENTITY_COLOR_ALIASES: Record<string, IdentityColorToken> = {
  amber: "gold",
  aqua: "cyan",
  gray: "neutral",
  grey: "neutral",
  indigo: "purple",
  mint: "green",
  orange: "coral",
  pink: "rose",
  red: "coral",
  sky: "blue",
  slate: "neutral",
  teal: "cyan",
  violet: "purple",
  yellow: "gold",
};

export function isIdentityColorToken(value: string | undefined): value is IdentityColorToken {
  return IDENTITY_COLOR_TOKENS.includes(value as IdentityColorToken);
}

export function resolveIdentityColorToken(
  value: string | undefined
): IdentityColorToken | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (isIdentityColorToken(normalized)) {
    return normalized;
  }

  return IDENTITY_COLOR_ALIASES[normalized];
}

export function normalizeIdentityColorToken(
  value: string | undefined,
  fallback: IdentityColorToken = "neutral"
): IdentityColorToken {
  return resolveIdentityColorToken(value) ?? fallback;
}
