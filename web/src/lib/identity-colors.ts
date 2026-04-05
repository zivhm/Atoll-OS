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
