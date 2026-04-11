import type { FastifyInstance, FastifyRequest } from "fastify";

import type { RuntimeCatalogItem } from "../../runtime-kind.js";
import type { RuntimeType } from "../../store.js";
import { resolveTimeoutSignal } from "./http-timeout.js";

type AuthConfig = {
  corsAllowedOrigins: string[];
  runtimeImage: string;
  runtimeOpenclawImage: string;
  runtimeHermesImage: string;
  supportedRuntimeTypes: RuntimeType[];
  defaultRuntimeType: RuntimeType;
  runtimeCatalog: RuntimeCatalogItem[];
  runtimeNetwork: string;
  runtimeProvider: string;
  runtimeModel: string;
  runtimeTelegramModelOverride?: string;
  runtimeApiKey: string;
  runtimeGatewayPort: number;
  runtimeRequirePairing: boolean;
  runtimeAllowPublicBind: boolean;
  runtimeHttpTimeoutMs: number;
  runtimeProvisioningStaleMs: number;
  runtimeReconcileIntervalMs: number;
  runtimeEventsMaxEntries: number;
  runtimeEventsMaxAgeDays: number;
  runtimeStartupValidation: "strict" | "warn" | "off";
};

type AuthContext = {
  sub: string;
  orgId: string;
};

type OpenRouterModelCatalogItem = {
  id: string;
  name: string;
  description: string;
  promptPricePer1M: number | null;
  completionPricePer1M: number | null;
  createdAt: string | null;
};

export function registerAuthRoutes(
  app: FastifyInstance,
  deps: {
    config: AuthConfig;
    getAuthContextOrThrow: (request: FastifyRequest) => AuthContext;
    resolveRuntimeProcessMode: () => "daemon" | "gateway";
  }
): void {
  const { config, getAuthContextOrThrow, resolveRuntimeProcessMode } = deps;

  app.get("/api/healthz", async () => ({
    status: "ok",
    service: "atoll-api",
    timestamp: new Date().toISOString(),
    runtime: {
      processMode: resolveRuntimeProcessMode(),
      containerCli: process.env.CONTAINER_CLI?.trim() || "docker",
      image: config.runtimeImage,
      openclawImage: config.runtimeOpenclawImage,
      hermesImage: config.runtimeHermesImage,
      supportedRuntimeTypes: config.supportedRuntimeTypes,
      defaultRuntimeType: config.defaultRuntimeType,
      catalog: config.runtimeCatalog,
      network: config.runtimeNetwork,
      hasApiKey: Boolean(config.runtimeApiKey),
      defaultProvider: config.runtimeProvider,
      defaultModel: config.runtimeModel,
      telegramModelOverride: config.runtimeTelegramModelOverride || null,
      defaultGatewayPort: config.runtimeGatewayPort,
      defaultRequirePairing: config.runtimeRequirePairing,
      defaultAllowPublicBind: config.runtimeAllowPublicBind,
      runtimeHttpTimeoutMs: config.runtimeHttpTimeoutMs,
      runtimeProvisioningStaleMs: config.runtimeProvisioningStaleMs,
      runtimeReconcileIntervalMs: config.runtimeReconcileIntervalMs,
      runtimeEventsMaxEntries: config.runtimeEventsMaxEntries,
      runtimeEventsMaxAgeDays: config.runtimeEventsMaxAgeDays,
      startupValidationMode: config.runtimeStartupValidation,
      authMode: "local"
    }
  }));

  app.get("/api/auth/me", async (request) => {
    const auth = getAuthContextOrThrow(request);
    return {
      sub: auth.sub,
      orgId: auth.orgId,
      authMode: "local"
    };
  });

  app.get("/api/runtime/model-catalog", async (request, reply) => {
    getAuthContextOrThrow(request);
    const query = request.query as { provider?: string; limit?: string };
    const provider = String(query.provider || config.runtimeProvider || "openrouter")
      .trim()
      .toLowerCase();
    const requestedLimit = Number.parseInt(String(query.limit || "60"), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(200, requestedLimit)) : 60;

    if (provider !== "openrouter") {
      return reply.status(501).send({
        message: `Provider '${provider}' model catalog is not supported yet.`
      });
    }

    const headerApiKey = typeof request.headers["x-openrouter-api-key"] === "string"
      ? request.headers["x-openrouter-api-key"].trim()
      : "";
    const apiKey = headerApiKey || config.runtimeApiKey;

    const headers: Record<string, string> = {
      Accept: "application/json"
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers,
        signal: resolveTimeoutSignal(config.runtimeHttpTimeoutMs)
      });
      const payload = await parseResponseJson(response);
      if (!response.ok) {
        const message =
          typeof payload?.error?.message === "string"
            ? payload.error.message
            : `Model catalog request failed (${response.status})`;
        return reply.status(response.status).send({ message });
      }

      const rawItems: unknown[] = Array.isArray(payload?.data) ? payload.data : [];
      const items = rawItems
        .map((item: unknown) => normalizeOpenRouterModel(item))
        .sort((left: OpenRouterModelCatalogItem, right: OpenRouterModelCatalogItem) =>
          toEpochMs(right.createdAt) - toEpochMs(left.createdAt)
        )
        .slice(0, limit);

      return reply.status(200).send({
        provider: "openrouter",
        source: "openrouter",
        fetchedAt: new Date().toISOString(),
        count: items.length,
        items
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load model catalog";
      return reply.status(502).send({
        message: `Failed to load openrouter model catalog: ${message}`
      });
    }
  });
}

async function parseResponseJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalizeOpenRouterModel(raw: unknown): OpenRouterModelCatalogItem {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pricing =
    obj.pricing && typeof obj.pricing === "object" ? (obj.pricing as Record<string, unknown>) : {};

  const id = typeof obj.id === "string" ? obj.id : "";
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : id;
  const description = typeof obj.description === "string" ? obj.description.trim() : "";
  const createdAt = parseCreatedAt(obj.created);
  const promptPerToken = parseNumber(pricing.prompt);
  const completionPerToken = parseNumber(pricing.completion);

  return {
    id,
    name,
    description,
    promptPricePer1M: promptPerToken === null ? null : promptPerToken * 1_000_000,
    completionPricePer1M: completionPerToken === null ? null : completionPerToken * 1_000_000,
    createdAt
  };
}

function parseNumber(value: unknown): number | null {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCreatedAt(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const ms = value < 1000000000000 ? value * 1000 : value;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toEpochMs(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
