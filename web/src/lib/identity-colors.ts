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
  emerald: "green",
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

export const IDENTITY_COLOR_SWATCHES: Record<
  IdentityColorToken,
  { label: string; accent: string; surface: string }
> = {
  neutral: {
    label: "Neutral",
    accent: "#7C8798",
    surface: "rgba(124, 135, 152, 0.16)",
  },
  cyan: {
    label: "Cyan",
    accent: "#00A6B4",
    surface: "rgba(0, 166, 180, 0.16)",
  },
  blue: {
    label: "Blue",
    accent: "#2563EB",
    surface: "rgba(37, 99, 235, 0.16)",
  },
  green: {
    label: "Green",
    accent: "#15803D",
    surface: "rgba(21, 128, 61, 0.16)",
  },
  purple: {
    label: "Purple",
    accent: "#7C3AED",
    surface: "rgba(124, 58, 237, 0.16)",
  },
  coral: {
    label: "Coral",
    accent: "#F97316",
    surface: "rgba(249, 115, 22, 0.18)",
  },
  gold: {
    label: "Gold",
    accent: "#CA8A04",
    surface: "rgba(202, 138, 4, 0.18)",
  },
  rose: {
    label: "Rose",
    accent: "#E11D48",
    surface: "rgba(225, 29, 72, 0.16)",
  },
};
