import type { FastifyInstance } from "fastify";

import { buildFailurePayload } from "../../../errors.js";
import { sanitizeApiPayload } from "../../../response-sanitizer.js";
import { resolveTimeoutSignal } from "../http-timeout.js";
import {
  getRuntimeConnector,
  resolveRuntimeHealthPath,
  resolveRuntimeImageForType
} from "../../../runtime-kind.js";
import {
  resolveRuntimeSharedWorkspaceMount,
  resolveRuntimeWorkspaceProfile
} from "../../../runtime-workspace-profile.js";
import { resolveRuntimeHttpBaseUrl } from "./runtime-base-url.js";

import type { RuntimeRouteDeps } from "./types.js";

export function registerRuntimeDiagnosticsRoutes(app: FastifyInstance, deps: RuntimeRouteDeps): void {
  const {
    store,
    config,
    runtimeProvider,
    getAuthContextOrThrow,
    resolveRuntimeInstanceOrReply,
    updateInstanceOrThrow,
    parseJsonObject,
    appendRuntimeEvent
  } = deps;

  app.get("/api/runtime/diagnostics", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const query = request.query as { instanceId?: unknown };
    const requestedInstanceId =
      typeof query.instanceId === "string" ? query.instanceId.trim() : "";
    const runtimeInstance = requestedInstanceId
      ? store.getRuntimeInstance(requestedInstanceId)
      : undefined;

    if (requestedInstanceId && !runtimeInstance) {
      return reply.status(404).send({
        message: `Runtime instance ${requestedInstanceId} not found`
      });
    }
    if (runtimeInstance) {
      const tenant = store.getTenant(runtimeInstance.tenantId);
      if (!tenant || tenant.identityOrgId !== auth.orgId) {
        return reply.status(404).send({
          message: `Runtime instance ${requestedInstanceId} not found`
        });
      }
    }

    try {
      const diagnostics = await runtimeProvider.getRuntimeEnvironmentDiagnostics({
        image: runtimeInstance
          ? resolveRuntimeImageForType({
              runtimeType: runtimeInstance.runtimeType,
              zeroclawImage: config.runtimeImage,
              openclawImage: config.runtimeOpenclawImage,
              hermesImage: config.runtimeHermesImage
            })
          : resolveRuntimeImageForType({
              runtimeType: config.defaultRuntimeType,
              zeroclawImage: config.runtimeImage,
              openclawImage: config.runtimeOpenclawImage,
              hermesImage: config.runtimeHermesImage
            }),
        network: config.runtimeNetwork,
        containerName: runtimeInstance?.containerName
      });

      return {
        ...sanitizeApiPayload(diagnostics),
        instanceId: runtimeInstance?.id ?? null,
        instanceStatus: runtimeInstance?.status ?? null
      };
    } catch (error) {
      return reply.status(502).send(buildFailurePayload(error, "Failed to run runtime diagnostics"));
    }
  });

  app.get("/api/runtime/instances/:instanceId/health", async (request, reply) => {
    let runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;
    const connector = getRuntimeConnector(runtimeInstance.runtimeType);
    const healthPath = resolveRuntimeHealthPath(runtimeInstance.runtimeType);

    try {
      if (connector.healthMode === "http" && healthPath) {
        const runtimeBaseUrl = await resolveRuntimeHttpBaseUrl({ runtimeInstance, runtimeProvider });
        if (runtimeBaseUrl) {
          if (runtimeBaseUrl !== runtimeInstance.baseUrl) {
            runtimeInstance = updateInstanceOrThrow(runtimeInstance.id, {
              baseUrl: runtimeBaseUrl
            });
          }

          const response = await fetch(`${runtimeBaseUrl}${healthPath}`, {
            signal: resolveTimeoutSignal(config.runtimeHttpTimeoutMs)
          });
          const payload = await parseJsonObject(response);

          if (response.ok) {
            updateInstanceOrThrow(runtimeInstance.id, {
              status: "running",
              lastError: undefined
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
                  : "unknown"
          });
        }
      }

      const diagnostics = await runtimeProvider.getRuntimeEnvironmentDiagnostics({
        image: resolveRuntimeImageForType({
          runtimeType: runtimeInstance.runtimeType,
          zeroclawImage: config.runtimeImage,
          openclawImage: config.runtimeOpenclawImage,
          hermesImage: config.runtimeHermesImage
        }),
        network: runtimeInstance.networkName,
        containerName: runtimeInstance.containerName
      });
      const running = diagnostics.container?.running ?? false;

      if (running) {
        updateInstanceOrThrow(runtimeInstance.id, {
          status: "running",
          lastError: undefined
        });
      } else {
        updateInstanceOrThrow(runtimeInstance.id, {
          status: runtimeInstance.status === "provisioning" ? "error" : "stopped",
          lastError: diagnostics.container?.message
        });
      }

      return reply.status(running ? 200 : 503).send({
        status: running ? "ok" : "error",
        healthMode: connector.healthMode,
        runtimeType: runtimeInstance.runtimeType,
        containerRunning: running,
        container: sanitizeApiPayload(diagnostics.container) ?? null
      });
    } catch (error) {
      const failure = buildFailurePayload(
        error,
        connector.healthMode === "http" && healthPath
          ? `Failed to reach runtime ${healthPath}`
          : "Failed to probe runtime container state"
      );
      return reply.status(502).send(failure);
    }
  });

  app.get("/api/runtime/instances/:instanceId/pairing-info", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;
    const connector = getRuntimeConnector(runtimeInstance.runtimeType);

    if (!connector.capabilities.pairingInfo) {
      return reply.status(501).send({
        message: `Pairing info endpoint is not available for ${runtimeInstance.runtimeType} runtimes.`
      });
    }

    if (!runtimeInstance.requirePairing) {
      return reply.status(200).send({
        requirePairing: false,
        message: "Pairing is not required for this runtime."
      });
    }

    try {
      const info = await runtimeProvider.getRuntimePairingInfo(runtimeInstance.containerName);
      return reply.status(200).send({
        requirePairing: true,
        pairingCode: info.pairingCode,
        message: sanitizeApiPayload(info.message),
        logExcerpt: sanitizeApiPayload(info.logExcerpt)
      });
    } catch (error) {
      return reply.status(502).send(buildFailurePayload(error, "Failed to load pairing info"));
    }
  });

  app.post("/api/runtime/instances/:instanceId/sync", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const statusBefore = runtimeInstance.status;
    const requestId = request.id;

    try {
      const diagnostics = await runtimeProvider.getRuntimeEnvironmentDiagnostics({
        image: resolveRuntimeImageForType({
          runtimeType: runtimeInstance.runtimeType,
          zeroclawImage: config.runtimeImage,
          openclawImage: config.runtimeOpenclawImage,
          hermesImage: config.runtimeHermesImage
        }),
        network: config.runtimeNetwork,
        containerName: runtimeInstance.containerName
      });
      const running = diagnostics.container?.running ?? false;

      const statusAfter = running
        ? "running"
        : runtimeInstance.status === "provisioning"
          ? "error"
          : "stopped";
      const reason = running
        ? "Container is running; runtime state synced to running."
        : runtimeInstance.status === "provisioning"
          ? "Container is not running while provisioning; state moved to error."
          : "Container is not running; runtime state synced to stopped.";

      const updated = updateInstanceOrThrow(runtimeInstance.id, {
        status: statusAfter,
        lastError: statusAfter === "error" ? reason : undefined
      });

      appendRuntimeEvent({
        requestId,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "sync",
        outcome: "succeeded",
        message: reason,
        metadata: {
          statusBefore,
          statusAfter
        }
      });

      return reply.status(200).send({
        statusBefore,
        statusAfter: updated.status,
        reason,
        diagnostics: sanitizeApiPayload(diagnostics)
      });
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to sync runtime instance state");
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "sync",
        outcome: "failed",
        message: failure.message,
        metadata: {
          statusBefore
        }
      });
      return reply.status(502).send(failure);
    }
  });

  app.post("/api/runtime/instances/:instanceId/repair", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const requestId = request.id;
    const steps: Array<{ step: string; ok: boolean; detail: string }> = [];
    const runtimeImage = resolveRuntimeImageForType({
      runtimeType: runtimeInstance.runtimeType,
      zeroclawImage: config.runtimeImage,
      openclawImage: config.runtimeOpenclawImage,
      hermesImage: config.runtimeHermesImage
    });
    const tenant = store.getTenant(runtimeInstance.tenantId);
    const agent = store.getAgent(runtimeInstance.agentId);
    const workspaceProfile = resolveRuntimeWorkspaceProfile(store, runtimeInstance);
    const sharedWorkspaceMount = resolveRuntimeSharedWorkspaceMount(tenant);

    appendRuntimeEvent({
      requestId,
      tenantId: runtimeInstance.tenantId,
      agentId: runtimeInstance.agentId,
      instanceId: runtimeInstance.id,
      action: "repair",
      outcome: "started",
      message: "Runtime repair runbook started"
    });

    const probe = async (label: string): Promise<boolean> => {
      try {
        const diagnostics = await runtimeProvider.getRuntimeEnvironmentDiagnostics({
          image: runtimeImage,
          network: runtimeInstance.networkName,
          containerName: runtimeInstance.containerName
        });
        const running = diagnostics.container?.running ?? false;
        steps.push({
          step: label,
          ok: true,
          detail: running ? "Container is running" : "Container is not running"
        });
        return running;
      } catch (error) {
        const failure = buildFailurePayload(error, "Diagnostics probe failed during repair");
        steps.push({
          step: label,
          ok: false,
          detail: failure.message
        });
        return false;
      }
    };

    const initiallyRunning = await probe("diagnostics-before");
    if (initiallyRunning) {
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "running",
        lastError: undefined
      });
      appendRuntimeEvent({
        requestId,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "repair",
        outcome: "succeeded",
        message: "No repair needed; container already running."
      });
      return reply.status(200).send({
        outcome: "succeeded",
        statusAfter: "running",
        steps
      });
    }

    try {
      await runtimeProvider.startRuntimeContainer(runtimeInstance.containerName);
      await runtimeProvider.syncRuntimeSkillArtifacts?.({
        runtimeType: runtimeInstance.runtimeType,
        volumeName: runtimeInstance.volumeName,
        workspaceProfile: resolveRuntimeWorkspaceProfile(store, runtimeInstance)
      });
      steps.push({
        step: "start-container",
        ok: true,
        detail: "Start command succeeded"
      });
    } catch (error) {
      const failure = buildFailurePayload(error, "Start command failed during repair");
      steps.push({
        step: "start-container",
        ok: false,
        detail: failure.message
      });
    }

    if (await probe("diagnostics-after-start")) {
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "running",
        lastError: undefined
      });
      appendRuntimeEvent({
        requestId,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "repair",
        outcome: "succeeded",
        message: "Repair succeeded after start command."
      });
      return reply.status(200).send({
        outcome: "succeeded",
        statusAfter: "running",
        steps
      });
    }

    try {
      await runtimeProvider.restartRuntimeContainer(runtimeInstance.containerName);
      await runtimeProvider.syncRuntimeSkillArtifacts?.({
        runtimeType: runtimeInstance.runtimeType,
        volumeName: runtimeInstance.volumeName,
        workspaceProfile: resolveRuntimeWorkspaceProfile(store, runtimeInstance)
      });
      steps.push({
        step: "restart-container",
        ok: true,
        detail: "Restart command succeeded"
      });
    } catch (error) {
      const failure = buildFailurePayload(error, "Restart command failed during repair");
      steps.push({
        step: "restart-container",
        ok: false,
        detail: failure.message
      });
    }

    if (await probe("diagnostics-after-restart")) {
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "running",
        lastError: undefined
      });
      appendRuntimeEvent({
        requestId,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "repair",
        outcome: "succeeded",
        message: "Repair succeeded after restart command."
      });
      return reply.status(200).send({
        outcome: "succeeded",
        statusAfter: "running",
        steps
      });
    }

    try {
      await runtimeProvider.provisionRuntimeContainer({
        runtimeType: runtimeInstance.runtimeType,
        containerName: runtimeInstance.containerName,
        volumeName: runtimeInstance.volumeName,
        networkName: runtimeInstance.networkName,
        instanceId: runtimeInstance.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        identityOrgId: tenant?.identityOrgId,
        createNetworkIfMissing: true,
        sharedWorkspaceMount,
        llm: {
          provider: runtimeInstance.llmProvider,
          model: runtimeInstance.llmModel,
          apiKey: runtimeInstance.llmApiKey ?? ""
        },
        telegram: {
          enabled: runtimeInstance.telegramEnabled,
          botToken: runtimeInstance.telegramBotToken,
          allowFrom: runtimeInstance.telegramAllowFrom,
          replyInPrivate: runtimeInstance.telegramReplyInPrivate
        },
        slack: {
          enabled: runtimeInstance.slackEnabled,
          botToken: runtimeInstance.slackBotToken,
          appToken: runtimeInstance.slackAppToken,
          allowedChannelIds: runtimeInstance.slackAllowedChannelIds,
          allowedUserIds: runtimeInstance.slackAllowedUserIds,
          replyInThread: runtimeInstance.slackReplyInThread
        },
        workspaceProfile,
        image: runtimeImage,
        gatewayPort: runtimeInstance.gatewayPort,
        requirePairing: runtimeInstance.requirePairing,
        allowPublicBind: runtimeInstance.allowPublicBind,
        bearerToken: runtimeInstance.bearerToken,
        runtimeOptions: runtimeInstance.runtimeOptions,
        runtimeSecrets: runtimeInstance.runtimeSecrets
      });
      steps.push({
        step: "reprovision-container",
        ok: true,
        detail: "Reprovision command succeeded"
      });
    } catch (error) {
      const failure = buildFailurePayload(error, "Reprovision command failed during repair");
      steps.push({
        step: "reprovision-container",
        ok: false,
        detail: failure.message
      });
    }

    if (await probe("diagnostics-after-reprovision")) {
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "running",
        lastError: undefined
      });
      appendRuntimeEvent({
        requestId,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "repair",
        outcome: "succeeded",
        message: "Repair succeeded after reprovision command."
      });
      return reply.status(200).send({
        outcome: "succeeded",
        statusAfter: "running",
        steps
      });
    }

    const message = "Repair runbook could not restore runtime to running state.";
    updateInstanceOrThrow(runtimeInstance.id, {
      status: "error",
      lastError: message
    });
    appendRuntimeEvent({
      requestId,
      tenantId: runtimeInstance.tenantId,
      agentId: runtimeInstance.agentId,
      instanceId: runtimeInstance.id,
      action: "repair",
      outcome: "failed",
      message
    });
    return reply.status(502).send({
      message,
      outcome: "failed",
      statusAfter: "error",
      steps
    });
  });
}

