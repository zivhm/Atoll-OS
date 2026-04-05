import type { AgentAvatar } from "@/lib/api";

const AVATAR_BACKGROUND_COLORS = [
  "b6e3f4",
  "c0aede",
  "d1d4f9",
  "ffd5dc",
  "ffdfbf",
  "caffbf",
] as const;

export function createRandomAgentAvatar(): AgentAvatar {
  return {
    style: "notionists",
    seed: buildAvatarSeed(),
    backgroundColor:
      AVATAR_BACKGROUND_COLORS[Math.floor(Math.random() * AVATAR_BACKGROUND_COLORS.length)] ?? AVATAR_BACKGROUND_COLORS[0],
  };
}

export function buildAgentAvatarUrl(avatar: AgentAvatar, size = 96): string {
  const params = new URLSearchParams({
    seed: avatar.seed,
    backgroundType: "solid",
    backgroundColor: avatar.backgroundColor,
    size: String(size),
  });
  return `https://api.dicebear.com/9.x/${avatar.style}/svg?${params.toString()}`;
}

export function getHelperInitials(helperName: string, fallback = "AT"): string {
  const initials = helperName
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  return initials || fallback;
}

function buildAvatarSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
