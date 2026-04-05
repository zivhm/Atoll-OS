export const DEFAULT_AGENT_TYPE_ID = "general" as const;

export const AGENT_TYPE_IDS = ["general", "frontend", "backend"] as const;
export type AgentTypeId = (typeof AGENT_TYPE_IDS)[number];

export type AgentTypeCatalogItem = {
  id: AgentTypeId;
  name: string;
  description: string;
  defaultSkills: string[];
};

const AGENT_TYPE_CATALOG: AgentTypeCatalogItem[] = [
  {
    id: "general",
    name: "Generalist",
    description: "Balanced default for helpers that need broad engineering judgment.",
    defaultSkills: [
      "brainstorming",
      "test-driven-development",
      "verification-before-completion"
    ]
  },
  {
    id: "frontend",
    name: "Frontend",
    description: "UI-oriented helper with frontend-specific implementation skills.",
    defaultSkills: [
      "brainstorming",
      "frontend-skill",
      "build-web-apps:react-best-practices",
      "test-driven-development",
      "verification-before-completion"
    ]
  },
  {
    id: "backend",
    name: "Backend",
    description: "Server-oriented helper with debugging and secure-by-default skills.",
    defaultSkills: [
      "brainstorming",
      "systematic-debugging",
      "security-best-practices",
      "test-driven-development",
      "verification-before-completion"
    ]
  }
];

export function listAgentTypes(): AgentTypeCatalogItem[] {
  return AGENT_TYPE_CATALOG.map((item) => ({
    ...item,
    defaultSkills: [...item.defaultSkills]
  }));
}

export function getAgentTypeById(agentTypeId: string | undefined): AgentTypeCatalogItem | undefined {
  const normalized = agentTypeId?.trim();
  if (!normalized) {
    return undefined;
  }

  return AGENT_TYPE_CATALOG.find((item) => item.id === normalized);
}

export function normalizeAgentTypeId(agentTypeId: string | undefined): AgentTypeId {
  return getAgentTypeById(agentTypeId)?.id ?? DEFAULT_AGENT_TYPE_ID;
}

function isAgentTypeId(value: string): value is AgentTypeId {
  return AGENT_TYPE_IDS.includes(value as AgentTypeId);
}

export function normalizeAgentSkills(input: Iterable<string> | undefined): string[] {
  if (!input) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of input) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function mergeAgentTypeSkills(
  agentTypeId: string | undefined,
  additionalSkills: Iterable<string> | undefined
): string[] {
  const agentType = getAgentTypeById(agentTypeId) ?? getAgentTypeById(DEFAULT_AGENT_TYPE_ID);
  return normalizeAgentSkills([...(agentType?.defaultSkills ?? []), ...(additionalSkills ?? [])]);
}

