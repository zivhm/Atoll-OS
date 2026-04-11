import { formatDistanceToNow } from "date-fns";

import type {
  Agent,
  RuntimeEvent,
  RuntimeCatalogItem,
  RuntimeInstance,
  RuntimeStatus,
  Tenant,
} from "@/lib/api";
import { createRandomAgentAvatar } from "@/lib/agent-avatar";

export type DashboardStatusBucket = "running" | "stopped" | "provisioning" | "attention";
export type DashboardFilter = "all" | "running" | "attention" | "stopped" | "telegram" | "pairing";

export interface DashboardHelperCard {
  instance: RuntimeInstance;
  agent?: Agent;
  tenant?: Tenant;
  statusBucket: DashboardStatusBucket;
  statusLabel: string;
  updatedLabel: string;
  searchText: string;
}

export interface ProvisionWizardState {
  workspaceChoice: "default" | "join" | "create";
  selectedTenantId: string;
  tenantName: string;
  agentName: string;
  avatar?: Agent["avatar"];
  agentType: Agent["agentType"];
  additionalSkills: string;
  roleTitle: string;
  presetId: string;
  runtimeType: RuntimeInstance["runtimeType"];
  configureIntegrations: boolean;
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramAllowFrom: string;
  telegramReplyInPrivate: boolean;
  slackEnabled: boolean;
  slackBotToken: string;
  slackAppToken: string;
  slackAllowedChannelIds: string;
  slackAllowedUserIds: string;
  slackReplyInThread: boolean;
  discordEnabled: boolean;
  discordBotToken: string;
  discordAllowedGuildIds: string;
  discordAllowedChannelIds: string;
  discordReplyInThread: boolean;
  dailyMessageLimit: string;
  dailyTokenLimit: string;
  monthlySpendLimitUsd: string;
  runtimeConfig: Record<string, string | boolean>;
}

export interface HelperDetailModel {
  agent?: Agent;
  tenant?: Tenant;
  instance?: RuntimeInstance;
  latestEvent?: RuntimeEvent;
  eventCount: number;
}

const TELEGRAM_NUMERIC_ID_RE = /^\d+$/u;
const TELEGRAM_USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/u;

export function buildDashboardHelperCards(
  instances: RuntimeInstance[],
  agents: Agent[],
  tenants: Tenant[]
): DashboardHelperCard[] {
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  return [...instances]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .map((instance) => {
      const agent = agentById.get(instance.agentId);
      const tenant = tenantById.get(instance.tenantId);
      const statusBucket = normalizeStatusBucket(instance.status);
      return {
        instance,
        agent,
        tenant,
        statusBucket,
        statusLabel: formatStatusLabel(instance.status),
        updatedLabel: formatRelativeDate(instance.updatedAt),
        searchText: [
          instance.id,
          instance.containerName,
          instance.runtimeType,
          agent?.name,
          agent?.roleTitle,
          tenant?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });
}

export function buildHelperDetailModel(input: {
  agentId: string;
  agents: Agent[];
  tenants: Tenant[];
  instances: RuntimeInstance[];
  events: RuntimeEvent[];
}): HelperDetailModel {
  const agent = input.agents.find((item) => item.id === input.agentId);
  const instance = input.instances.find((item) => item.agentId === input.agentId);
  const tenant = agent ? input.tenants.find((item) => item.id === agent.tenantId) : undefined;
  const relatedEvents = instance
    ? input.events.filter((event) => event.instanceId === instance.id)
    : input.events.filter((event) => event.agentId === input.agentId);

  return {
    agent,
    tenant,
    instance,
    latestEvent: relatedEvents[0],
    eventCount: relatedEvents.length,
  };
}

export function normalizeStatusBucket(status: RuntimeStatus | string): DashboardStatusBucket {
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "running") return "running";
  if (normalized === "stopped") return "stopped";
  if (normalized === "provisioning") return "provisioning";
  return "attention";
}

export function formatStatusLabel(status: RuntimeStatus | string): string {
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "running") return "Running";
  if (normalized === "stopped") return "Stopped";
  if (normalized === "provisioning") return "Starting up";
  if (normalized === "error") return "Needs attention";
  return normalized || "Unknown";
}

export function formatEventActionLabel(action?: string): string {
  const normalized = String(action || "").trim();
  if (!normalized) return "Unknown";
  return normalized.split("_").join(" ");
}

export function matchesDashboardFilter(card: DashboardHelperCard, filter: DashboardFilter): boolean {
  if (filter === "all") return true;
  if (filter === "running") return card.statusBucket === "running";
  if (filter === "attention") return card.statusBucket === "attention" || card.statusBucket === "provisioning";
  if (filter === "stopped") return card.statusBucket === "stopped";
  if (filter === "telegram") return card.instance.telegramEnabled;
  if (filter === "pairing") return card.instance.requirePairing;
  return true;
}

export function formatRelativeDate(value?: string): string {
  if (!value) return "unknown";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "unknown";
  return formatDistanceToNow(new Date(parsed), { addSuffix: true });
}

export function parseTelegramAllowListInput(
  raw: string,
  options: { strict?: boolean } = {}
): {
  entries: string[];
  warnings: string[];
  invalid: string[];
} {
  const strict = options.strict === true;
  const rawEntries = String(raw || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const entries: string[] = [];
  const warnings: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const rawEntry of rawEntries) {
    if (rawEntry === "*") {
      if (!seen.has("*")) {
        seen.add("*");
        entries.push("*");
      }
      continue;
    }

    const normalized = rawEntry.startsWith("@") ? rawEntry.slice(1).trim() : rawEntry;
    if (TELEGRAM_NUMERIC_ID_RE.test(normalized)) {
      const key = `id:${normalized}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push(normalized);
      }
      continue;
    }

    if (TELEGRAM_USERNAME_RE.test(normalized)) {
      const key = `user:${normalized.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push(normalized.toLowerCase());
      }
      if (!rawEntry.startsWith("@")) {
        warnings.push(`Saved username '${normalized.toLowerCase()}' without @`);
      }
      continue;
    }

    invalid.push(rawEntry);
  }

  if (strict && invalid.length > 0) {
    throw new Error(`Invalid Telegram allow list entries: ${invalid.join(", ")}`);
  }

  return {
    entries,
    warnings,
    invalid,
  };
}

export function buildInitialProvisionWizardState(defaults?: {
  provider?: string;
  model?: string;
  runtimeType?: RuntimeInstance["runtimeType"];
}): ProvisionWizardState {
  return {
    workspaceChoice: "default",
    selectedTenantId: "",
    tenantName: "Default Workspace",
    agentName: "",
    avatar: createRandomAgentAvatar(),
    agentType: "general",
    additionalSkills: "",
    roleTitle: "",
    presetId: "",
    runtimeType: defaults?.runtimeType ?? "openclaw",
    configureIntegrations: false,
    llmProvider: defaults?.provider ?? "openrouter",
    llmApiKey: "",
    llmModel: defaults?.model ?? "",
    telegramEnabled: false,
    telegramBotToken: "",
    telegramAllowFrom: "",
    telegramReplyInPrivate: true,
    slackEnabled: false,
    slackBotToken: "",
    slackAppToken: "",
    slackAllowedChannelIds: "",
    slackAllowedUserIds: "",
    slackReplyInThread: true,
    discordEnabled: false,
    discordBotToken: "",
    discordAllowedGuildIds: "",
    discordAllowedChannelIds: "",
    discordReplyInThread: true,
    dailyMessageLimit: "",
    dailyTokenLimit: "",
    monthlySpendLimitUsd: "",
    runtimeConfig: {},
  };
}

export function parseSkillListInput(raw: string): string[] {
  const entries = String(raw || "")
    .split(/[,\n]/gu)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of entries) {
    const key = entry.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(entry);
  }

  return normalized;
}

export function mergeAgentSkills(...skillSets: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const skillSet of skillSets) {
    for (const skill of skillSet) {
      const trimmed = skill.trim();
      if (!trimmed) {
        continue;
      }
      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(trimmed);
    }
  }

  return merged;
}

export function parseIntegrationIdListInput(raw: string): string[] {
  const items = String(raw || "")
    .split(/[,\n]/gu)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(items)];
}

const PRODUCT_RUNTIME_ORDER: RuntimeCatalogItem["id"][] = ["openclaw", "zeroclaw", "hermes"];

export function getVisibleRuntimeCatalog(items: RuntimeCatalogItem[]): RuntimeCatalogItem[] {
  return [...items]
    .filter((item) => PRODUCT_RUNTIME_ORDER.includes(item.id))
    .sort(
      (left, right) => PRODUCT_RUNTIME_ORDER.indexOf(left.id) - PRODUCT_RUNTIME_ORDER.indexOf(right.id)
    );
}

export function resolvePreferredRuntime(
  items: RuntimeCatalogItem[],
  requested?: RuntimeCatalogItem["id"]
): RuntimeCatalogItem | undefined {
  if (requested) {
    const requestedMatch = items.find((item) => item.id === requested);
    if (requestedMatch) {
      return requestedMatch;
    }
  }

  return items.find((item) => item.id === "openclaw") ?? items[0];
}
