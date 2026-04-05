import type { RuntimeEvent } from "./store.js";

export type RuntimeStatsResponse = {
  instanceId: string;
  messages: {
    total: number | null;
  };
  tokens: {
    input: number | null;
    output: number | null;
    total: number | null;
  };
  cost: {
    usd: number | null;
  };
  lastActivityAt: string | null;
  sourceMetadata: {
    primary: "runtime-health" | "atoll-events";
    runtimeStatsFound: boolean;
    fallbackEventCount: number;
    missing: string[];
  };
};

type RuntimeStatsSnapshot = {
  messageCount: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  lastActivityAt: string | null;
  runtimeStatsFound: boolean;
};

const KEY_ALIASES = {
  messageCount: [
    "message_count",
    "messagecount",
    "messages",
    "messages_total",
    "messagescount",
    "total_messages",
    "totalmessages",
  ],
  inputTokens: [
    "input_tokens",
    "inputtokens",
    "prompt_tokens",
    "prompttokens",
    "tokens_in",
    "tokensinput",
  ],
  outputTokens: [
    "completion_tokens",
    "completiontokens",
    "output_tokens",
    "outputtokens",
    "response_tokens",
    "responsetokens",
    "tokens_out",
    "tokensoutput",
  ],
  totalTokens: [
    "tokens",
    "tokens_total",
    "tokencount",
    "total_tokens",
    "totaltokens",
    "usage_tokens",
    "usagetokens",
  ],
  costUsd: [
    "cost",
    "cost_usd",
    "costusd",
    "spend",
    "spend_usd",
    "spendusd",
    "usd",
  ],
  lastActivityAt: [
    "last_activity_at",
    "lastactivityat",
    "last_message_at",
    "lastmessageat",
    "updated_at",
    "updatedat",
  ],
} as const;

export function buildRuntimeStatsResponse(input: {
  instanceId: string;
  healthPayload?: Record<string, unknown> | null;
  events: RuntimeEvent[];
  instanceUpdatedAt?: string;
}): RuntimeStatsResponse {
  const runtimeStats = extractRuntimeStatsSnapshot(input.healthPayload);
  const fallbackEventCount = input.events.length;
  const fallbackLastActivityAt =
    input.events[0]?.createdAt ?? normalizeIsoTimestamp(input.instanceUpdatedAt) ?? null;
  const tokenTotal =
    runtimeStats.totalTokens ??
    sumNullableNumbers(runtimeStats.inputTokens, runtimeStats.outputTokens);

  const missing: string[] = [];
  if (runtimeStats.messageCount === null) {
    missing.push("messages.total");
  }
  if (runtimeStats.inputTokens === null && runtimeStats.outputTokens === null && tokenTotal === null) {
    missing.push("tokens");
  }
  if (runtimeStats.costUsd === null) {
    missing.push("cost.usd");
  }

  return {
    instanceId: input.instanceId,
    messages: {
      total: runtimeStats.messageCount ?? fallbackEventCount,
    },
    tokens: {
      input: runtimeStats.inputTokens,
      output: runtimeStats.outputTokens,
      total: tokenTotal,
    },
    cost: {
      usd: runtimeStats.costUsd,
    },
    lastActivityAt: runtimeStats.lastActivityAt ?? fallbackLastActivityAt,
    sourceMetadata: {
      primary: runtimeStats.runtimeStatsFound ? "runtime-health" : "atoll-events",
      runtimeStatsFound: runtimeStats.runtimeStatsFound,
      fallbackEventCount,
      missing,
    },
  };
}

function extractRuntimeStatsSnapshot(
  payload: Record<string, unknown> | null | undefined
): RuntimeStatsSnapshot {
  if (!payload) {
    return emptyRuntimeStatsSnapshot();
  }

  const numericMatches = new Map<string, number>();
  let lastActivityAt: string | null = null;

  walkStatsPayload(payload, (normalizedKey, value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      captureNumericAlias(normalizedKey, value, numericMatches);
      return;
    }

    if (!lastActivityAt && typeof value === "string" && isTimestampAlias(normalizedKey)) {
      lastActivityAt = normalizeIsoTimestamp(value) ?? null;
    }
  });

  const inputTokens = numericMatches.get("inputTokens") ?? null;
  const outputTokens = numericMatches.get("outputTokens") ?? null;
  const totalTokens = numericMatches.get("totalTokens") ?? null;

  return {
    messageCount: numericMatches.get("messageCount") ?? null,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd: numericMatches.get("costUsd") ?? null,
    lastActivityAt,
    runtimeStatsFound: numericMatches.size > 0 || Boolean(lastActivityAt),
  };
}

function emptyRuntimeStatsSnapshot(): RuntimeStatsSnapshot {
  return {
    messageCount: null,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    costUsd: null,
    lastActivityAt: null,
    runtimeStatsFound: false,
  };
}

function walkStatsPayload(
  value: unknown,
  visit: (normalizedKey: string, value: unknown) => void,
  parentKey = "",
  seen = new Set<unknown>()
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      walkStatsPayload(item, visit, parentKey, seen);
    }
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);
    const combinedKey = parentKey ? `${parentKey}.${normalizedKey}` : normalizedKey;
    visit(normalizedKey, child);
    visit(combinedKey, child);
    if (child && typeof child === "object") {
      walkStatsPayload(child, visit, combinedKey, seen);
    }
  }
}

function captureNumericAlias(
  normalizedKey: string,
  value: number,
  matches: Map<string, number>
): void {
  for (const [target, aliases] of Object.entries(KEY_ALIASES)) {
    if (!aliases.includes(normalizedKey as never)) {
      continue;
    }
    if (!matches.has(target)) {
      matches.set(target, value);
    }
  }
}

function isTimestampAlias(normalizedKey: string): boolean {
  return KEY_ALIASES.lastActivityAt.includes(normalizedKey as never);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeIsoTimestamp(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

function sumNullableNumbers(left: number | null, right: number | null): number | null {
  if (left === null && right === null) {
    return null;
  }
  return (left ?? 0) + (right ?? 0);
}
