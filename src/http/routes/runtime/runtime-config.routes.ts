import type { FastifyInstance } from "fastify";

import { buildFailurePayload } from "../../../errors.js";
import { sanitizeApiPayload } from "../../../response-sanitizer.js";
import { resolveTimeoutSignal } from "../http-timeout.js";
import { getRuntimeConnector } from "../../../runtime-kind.js";
import {
  parsePairRuntimeInput,
  parseRuntimeConfigSettingsInput,
  parseRuntimeDiscordSettingsInput,
  parseRuntimeLimitsSettingsInput,
  parseRuntimeLlmSettingsInput,
  parseRuntimeSlackSettingsInput,
  parseRuntimeTelegramSettingsInput,
  parseRuntimeWebhookInput,
  parseSetRuntimeTokenInput
} from "../../../parsers.js";
import { resolveRuntimeHttpBaseUrl } from "./runtime-base-url.js";

import type { RuntimeRouteDeps } from "./types.js";

const SLACK_BOT_SCOPES = [
  "app_mentions:read",
  "chat:write",
  "im:history",
  "channels:read",
  "groups:read",
  "mpim:read",
  "im:read",
  "users:read"
] as const;
const SLACK_APP_SCOPES = ["connections:write"] as const;

export function registerRuntimeConfigRoutes(app: FastifyInstance, deps: RuntimeRouteDeps): void {
  const {
    config,
    runtimeProvider,
    resolveRuntimeInstanceOrReply,
    updateInstanceOrThrow,
    parseJsonObject,
    toPublicRuntimeInstance,
    applyRuntimeConfigForInstance,
    appendRuntimeEvent
  } = deps;

  app.post("/api/runtime/instances/:instanceId/pair", async (request, reply) => {
    let runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;
    const connector = getRuntimeConnector(runtimeInstance.runtimeType);
    if (!connector.capabilities.pairingAction) {
      return reply.status(501).send({
        message: `Pair endpoint is not available for ${runtimeInstance.runtimeType} runtimes.`
      });
    }
    const runtimeBaseUrl = await resolveRuntimeHttpBaseUrl({ runtimeInstance, runtimeProvider });
    if (!runtimeBaseUrl) {
      return reply.status(501).send({
        message: `Pair endpoint is not available for ${runtimeInstance.runtimeType} runtimes.`
      });
    }
    if (runtimeBaseUrl !== runtimeInstance.baseUrl) {
      runtimeInstance = updateInstanceOrThrow(runtimeInstance.id, {
        baseUrl: runtimeBaseUrl
      });
    }

    const input = parsePairRuntimeInput(request.body);

    try {
      const response = await fetch(`${runtimeBaseUrl}/pair`, {
        method: "POST",
        headers: {
          "X-Pairing-Code": input.pairingCode
        },
        signal: resolveTimeoutSignal(config.runtimeHttpTimeoutMs)
      });

      const payload = await parseJsonObject(response);
      const token = typeof payload?.token === "string" ? payload.token.trim() : "";

      if (response.ok && token) {
        const updated = updateInstanceOrThrow(runtimeInstance.id, {
          status: "running",
          bearerToken: token,
          lastError: undefined
        });
        appendRuntimeEvent({
          requestId: request.id,
          tenantId: runtimeInstance.tenantId,
          agentId: runtimeInstance.agentId,
          instanceId: runtimeInstance.id,
          action: "pair",
          outcome: "succeeded",
          message: "Runtime paired successfully."
        });

        const sanitizedPayload = sanitizeApiPayload(payload);
        return reply.status(response.status).send({
          ...(sanitizedPayload ?? {}),
          status:
            typeof sanitizedPayload?.status === "string"
              ? sanitizedPayload.status
              : response.ok
                ? "ok"
                : "error",
          hasToken: Boolean(updated.bearerToken)
        });
      }

      const sanitizedPayload = sanitizeApiPayload(payload);
      return reply.status(response.status).send({
        ...(sanitizedPayload ?? {}),
        status:
          typeof sanitizedPayload?.status === "string"
            ? sanitizedPayload.status
            : response.ok
              ? "ok"
              : "error"
      });
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to reach runtime /pair");
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "pair",
        outcome: "failed",
        message: failure.message
      });

      return reply.status(502).send(failure);
    }
  });

  app.post("/api/runtime/instances/:instanceId/token", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const input = parseSetRuntimeTokenInput(request.body);
    const updated = updateInstanceOrThrow(runtimeInstance.id, {
      bearerToken: input.token,
      lastError: undefined
    });
    appendRuntimeEvent({
      requestId: request.id,
      tenantId: runtimeInstance.tenantId,
      agentId: runtimeInstance.agentId,
      instanceId: runtimeInstance.id,
      action: "token_set",
      outcome: "succeeded",
      message: "Runtime token updated."
    });

    return reply.status(200).send({
      status: "ok",
      hasToken: Boolean(updated.bearerToken)
    });
  });

  app.post("/api/runtime/instances/:instanceId/webhook", async (request, reply) => {
    let runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;
    const connector = getRuntimeConnector(runtimeInstance.runtimeType);
    if (!connector.capabilities.webhookAction) {
      return reply.status(501).send({
        message: `Webhook endpoint is not available for ${runtimeInstance.runtimeType} runtimes.`
      });
    }
    const runtimeBaseUrl = await resolveRuntimeHttpBaseUrl({ runtimeInstance, runtimeProvider });
    if (!runtimeBaseUrl) {
      return reply.status(501).send({
        message: `Webhook endpoint is not available for ${runtimeInstance.runtimeType} runtimes.`
      });
    }
    if (runtimeBaseUrl !== runtimeInstance.baseUrl) {
      runtimeInstance = updateInstanceOrThrow(runtimeInstance.id, {
        baseUrl: runtimeBaseUrl
      });
    }

    const input = parseRuntimeWebhookInput(request.body);
    const token = input.token || runtimeInstance.bearerToken;

    if (runtimeInstance.requirePairing && !token) {
      return reply.status(400).send({
        message: "Runtime token missing. Pair runtime or set token first."
      });
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token && runtimeInstance.runtimeType === "zeroclaw" && !runtimeInstance.requirePairing) {
        headers["X-Webhook-Secret"] = token;
      } else if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${runtimeBaseUrl}/webhook`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: input.message
        }),
        signal: resolveTimeoutSignal(config.runtimeHttpTimeoutMs)
      });

      const payload = await parseJsonObject(response);
      if (response.ok) {
        updateInstanceOrThrow(runtimeInstance.id, {
          status: "running",
          lastError: undefined
        });
        appendRuntimeEvent({
          requestId: request.id,
          tenantId: runtimeInstance.tenantId,
          agentId: runtimeInstance.agentId,
          instanceId: runtimeInstance.id,
          action: "webhook",
          outcome: "succeeded",
          message: "Runtime webhook request succeeded."
        });
      }

      const sanitizedPayload = sanitizeApiPayload(payload);
      return reply.status(response.status).send({
        ...(sanitizedPayload ?? {}),
        status:
          typeof sanitizedPayload?.status === "string"
            ? sanitizedPayload.status
            : response.ok
              ? "ok"
              : "error"
      });
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to reach runtime /webhook");
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "webhook",
        outcome: "failed",
        message: failure.message
      });

      return reply.status(502).send(failure);
    }
  });

  app.post("/api/runtime/instances/:instanceId/llm", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const input = parseRuntimeLlmSettingsInput(
      request.body,
      runtimeInstance,
      config.runtimeApiKey,
      config.runtimeTelegramModelOverride
    );
    const updated = updateInstanceOrThrow(runtimeInstance.id, {
      llmProvider: input.provider,
      llmModel: input.model,
      llmApiKey: input.apiKey,
      lastError: undefined
    });

    try {
      const applied = await applyRuntimeConfigForInstance(updated);
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "llm_update",
        outcome: "succeeded",
        message: "LLM settings applied."
      });
      return reply.status(200).send(toPublicRuntimeInstance(applied));
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to apply LLM settings");
      const failed = updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "llm_update",
        outcome: "failed",
        message: failure.message
      });
      return reply.status(502).send({
        ...failure,
        instance: toPublicRuntimeInstance(failed)
      });
    }
  });

  app.post("/api/runtime/instances/:instanceId/telegram", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const input = parseRuntimeTelegramSettingsInput(request.body, runtimeInstance);
    const updated = updateInstanceOrThrow(runtimeInstance.id, {
      telegramEnabled: input.enabled,
      telegramBotToken: input.botToken,
      telegramAllowFrom: input.allowFrom,
      telegramReplyInPrivate: input.replyInPrivate,
      lastError: undefined
    });

    try {
      const applied = await applyRuntimeConfigForInstance(updated);
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "telegram_update",
        outcome: "succeeded",
        message: "Telegram settings applied."
      });
      return reply.status(200).send(toPublicRuntimeInstance(applied));
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to apply telegram settings");
      const failed = updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "telegram_update",
        outcome: "failed",
        message: failure.message
      });
      return reply.status(502).send({
        ...failure,
        instance: toPublicRuntimeInstance(failed)
      });
    }
  });

  app.post("/api/runtime/instances/:instanceId/slack", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const input = parseRuntimeSlackSettingsInput(request.body, runtimeInstance);
    const updated = updateInstanceOrThrow(runtimeInstance.id, {
      slackEnabled: input.enabled,
      slackBotToken: input.botToken,
      slackAppToken: input.appToken,
      slackAllowedChannelIds: input.allowedChannelIds,
      slackAllowedUserIds: input.allowedUserIds,
      slackReplyInThread: input.replyInThread,
      lastError: undefined
    });
    try {
      const applied = await applyRuntimeConfigForInstance(updated);
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "slack_update",
        outcome: "succeeded",
        message: "Slack settings applied."
      });
      return reply.status(200).send(toPublicRuntimeInstance(applied));
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to apply Slack settings");
      const failed = updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "slack_update",
        outcome: "failed",
        message: failure.message
      });
      return reply.status(502).send({
        ...failure,
        instance: toPublicRuntimeInstance(failed)
      });
    }
  });

  app.get("/api/runtime/instances/:instanceId/slack/onboarding", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const checklist = buildSlackOnboardingChecklist({
      runtimeInstance
    });

    return reply.status(200).send({
      mode: "socket",
      requiredFieldsStatus: {
        slackEnabled: runtimeInstance.slackEnabled,
        hasSlackBotToken: Boolean(runtimeInstance.slackBotToken),
        hasSlackAppToken: Boolean(runtimeInstance.slackAppToken),
      },
      recommendedScopes: {
        bot: [...SLACK_BOT_SCOPES],
        app: [...SLACK_APP_SCOPES]
      },
      checklist,
    });
  });

  app.post("/api/runtime/instances/:instanceId/slack/onboarding/check", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const missing: string[] = [];
    if (!runtimeInstance.slackEnabled) {
      missing.push("slack_enabled");
    }
    if (!runtimeInstance.slackBotToken) {
      missing.push("slack_bot_token");
    }
    if (!runtimeInstance.slackAppToken) {
      missing.push("slack_app_token");
    }

    const status = missing.length === 0 ? "ready" : "needs_config";
    return reply.status(200).send({
      status,
      missing,
      message:
        status === "ready"
          ? "Slack socket onboarding is ready."
          : "Slack onboarding still needs additional setup.",
    });
  });

  app.post("/api/runtime/instances/:instanceId/discord", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const input = parseRuntimeDiscordSettingsInput(request.body, runtimeInstance);
    const updated = updateInstanceOrThrow(runtimeInstance.id, {
      discordEnabled: input.enabled,
      discordBotToken: input.botToken,
      discordAllowedGuildIds: input.allowedGuildIds,
      discordAllowedChannelIds: input.allowedChannelIds,
      discordReplyInThread: input.replyInThread,
      discordRequireMention: input.requireMention,
      lastError: undefined
    });
    const hasUnscopedChannelAllowlist =
      input.allowedChannelIds.length > 0 && input.allowedGuildIds.length === 0;
    if (hasUnscopedChannelAllowlist) {
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "discord_update",
        outcome: "started",
        message:
          "Discord channel allowlist was provided without guild allowlist. Native config will keep fail-closed group policy."
      });
    }
    const hasNoGroupAllowlists =
      input.allowedGuildIds.length === 0 && input.allowedChannelIds.length === 0;
    if (hasNoGroupAllowlists) {
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "discord_update",
        outcome: "started",
        message:
          "Discord guild/channel allowlists are empty. Native config will use open group policy (allow all guild channels)."
      });
    }
    try {
      const applied = await applyRuntimeConfigForInstance(updated);
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "discord_update",
        outcome: "succeeded",
        message: "Discord settings applied through native OpenClaw channels.discord."
      });

      return reply.status(200).send(toPublicRuntimeInstance(applied));
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to apply Discord settings");
      const failed = updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "discord_update",
        outcome: "failed",
        message: failure.message
      });
      return reply.status(502).send({
        ...failure,
        instance: toPublicRuntimeInstance(failed)
      });
    }
  });

  app.post("/api/runtime/instances/:instanceId/limits", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const input = parseRuntimeLimitsSettingsInput(request.body);
    const updated = updateInstanceOrThrow(runtimeInstance.id, {
      dailyMessageLimit: input.dailyMessageLimit,
      dailyTokenLimit: input.dailyTokenLimit,
      monthlySpendLimitUsd: input.monthlySpendLimitUsd,
      lastError: undefined
    });

    appendRuntimeEvent({
      requestId: request.id,
      tenantId: runtimeInstance.tenantId,
      agentId: runtimeInstance.agentId,
      instanceId: runtimeInstance.id,
      action: "limits_update",
      outcome: "succeeded",
      message: "Usage limits saved."
    });

    return reply.status(200).send(toPublicRuntimeInstance(updated));
  });

  app.post("/api/runtime/instances/:instanceId/runtime-config", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const input = parseRuntimeConfigSettingsInput(request.body);
    const updated = updateInstanceOrThrow(runtimeInstance.id, {
      runtimeOptions: input.runtimeOptions,
      runtimeSecrets: input.runtimeSecrets,
      lastError: undefined
    });

    try {
      const applied = await applyRuntimeConfigForInstance(updated);
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "runtime_config_update",
        outcome: "succeeded",
        message: "Runtime-specific settings applied."
      });
      return reply.status(200).send(toPublicRuntimeInstance(applied));
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to apply runtime-specific settings");
      const failed = updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "runtime_config_update",
        outcome: "failed",
        message: failure.message
      });
      return reply.status(502).send({
        ...failure,
        instance: toPublicRuntimeInstance(failed)
      });
    }
  });
}

function buildSlackOnboardingChecklist(input: {
  runtimeInstance: {
    slackEnabled: boolean;
    slackBotToken?: string;
    slackAppToken?: string;
  };
}): Array<{ id: string; title: string; done: boolean; hint?: string }> {
  return [
    {
      id: "slack_enabled",
      title: "Enable Slack for this helper",
      done: input.runtimeInstance.slackEnabled,
      hint: "Turn on Slack in helper settings before installing the app.",
    },
    {
      id: "slack_bot_token",
      title: "Save Slack bot token",
      done: Boolean(input.runtimeInstance.slackBotToken),
      hint: "Paste the xoxb bot token from Slack OAuth & Permissions.",
    },
    {
      id: "slack_app_token",
      title: "Save Slack app token",
      done: Boolean(input.runtimeInstance.slackAppToken),
      hint: "Paste the xapp app-level token with connections:write scope.",
    },
    {
      id: "socket_mode",
      title: "Enable Socket Mode in Slack app settings",
      done: true,
      hint: "Socket mode must be enabled for the xapp token to connect.",
    },
  ];
}
