import type { FastifyInstance } from "fastify";

import { buildFailurePayload } from "../../../errors.js";
import { buildRuntimeStatsResponse } from "../../../runtime-stats.js";
import { resolveTimeoutSignal } from "../http-timeout.js";
import {
  getRuntimeConnector,
  resolveRuntimeHealthPath,
  resolveRuntimeImageForType
} from "../../../runtime-kind.js";
import {
  parseBooleanQueryValue,
  parsePositiveIntegerUnknown,
  parseRuntimeSharedFileParams,
  parseRuntimeSharedFilesUploadInput
} from "../../../parsers.js";
import { resolveRuntimeHttpBaseUrl } from "./runtime-base-url.js";

import type { RuntimeRouteDeps } from "./types.js";

export function registerRuntimeInstancesRoutes(app: FastifyInstance, deps: RuntimeRouteDeps): void {
  const {
    store,
    config,
    runtimeProvider,
    getAuthContextOrThrow,
    toPublicRuntimeInstance,
    resolveRuntimeInstanceOrReply,
    updateInstanceOrThrow,
    applyRuntimeConfigForInstance,
    parseJsonObject,
    appendRuntimeEvent
  } = deps;

  app.get("/api/runtime/instances", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const query = request.query as { tenantId?: string };
    if (query.tenantId) {
      const tenant = store.getTenant(query.tenantId);
      if (!tenant || tenant.identityOrgId !== auth.orgId) {
        return reply.status(404).send({
          message: `Tenant ${query.tenantId} not found`
        });
      }
    }
    const tenantIds = new Set(store.listTenants(auth.orgId).map((tenant) => tenant.id));
    const instances = await Promise.all(
      store
        .listRuntimeInstances(query.tenantId)
        .filter((item) => tenantIds.has(item.tenantId))
        .map((item) => refreshRuntimeInstanceState(item))
    );
    return {
      items: instances.map(toPublicRuntimeInstance)
    };
  });

  app.get("/api/runtime/instances/:instanceId", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    return toPublicRuntimeInstance(await refreshRuntimeInstanceState(runtimeInstance));
  });

  app.get("/api/runtime/instances/:instanceId/files", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    try {
      const items = await runtimeProvider.listRuntimeSharedFiles?.({
        runtimeType: runtimeInstance.runtimeType,
        volumeName: runtimeInstance.volumeName
      });
      return reply.status(200).send({
        items: items ?? []
      });
    } catch (error) {
      return reply.status(502).send(buildFailurePayload(error, "Failed to list shared files"));
    }
  });

  app.post("/api/runtime/instances/:instanceId/files", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    try {
      const input = parseRuntimeSharedFilesUploadInput(request.body);
      const items = [];
      for (const file of input.files) {
        const uploaded = await runtimeProvider.writeRuntimeSharedFile?.({
          runtimeType: runtimeInstance.runtimeType,
          volumeName: runtimeInstance.volumeName,
          fileName: file.relativePath,
          content: file.content
        });
        if (uploaded) {
          items.push(uploaded);
        }
      }
      return reply.status(201).send({ items });
    } catch (error) {
      return reply.status(400).send(buildFailurePayload(error, "Failed to upload shared files"));
    }
  });

  app.get("/api/runtime/instances/:instanceId/files/:fileId", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    try {
      const params = parseRuntimeSharedFileParams(request.params);
      const file = await runtimeProvider.readRuntimeSharedFile?.({
        runtimeType: runtimeInstance.runtimeType,
        volumeName: runtimeInstance.volumeName,
        relativePath: decodeURIComponent(params.fileId)
      });

      if (!file) {
        return reply.status(404).send({
          message: `Shared file ${params.fileId} not found`
        });
      }

      reply.header("content-type", "application/octet-stream");
      reply.header("content-disposition", `attachment; filename="${file.fileName}"`);
      return reply.status(200).send(file.content);
    } catch (error) {
      return reply.status(400).send(buildFailurePayload(error, "Failed to read shared file"));
    }
  });

  app.delete("/api/runtime/instances/:instanceId/files/:fileId", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    try {
      const params = parseRuntimeSharedFileParams(request.params);
      await runtimeProvider.deleteRuntimeSharedFile?.({
        runtimeType: runtimeInstance.runtimeType,
        volumeName: runtimeInstance.volumeName,
        relativePath: decodeURIComponent(params.fileId)
      });
      return reply.status(204).send();
    } catch (error) {
      return reply.status(400).send(buildFailurePayload(error, "Failed to delete shared file"));
    }
  });

  app.get("/api/runtime/instances/:instanceId/logs", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const query = request.query as { tail?: unknown };
    const tail = Math.min(parsePositiveIntegerUnknown(query.tail, 250), 1000);

    try {
      const logs = await runtimeProvider.readRuntimeContainerLogs(runtimeInstance.containerName, tail);
      return reply.status(200).send({
        containerName: runtimeInstance.containerName,
        tail,
        logs,
        fetchedAt: new Date().toISOString()
      });
    } catch (error) {
      return reply.status(502).send(buildFailurePayload(error, "Failed to read runtime container logs"));
    }
  });

  app.get("/api/runtime/instances/:instanceId/stats", async (request, reply) => {
    let runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const connector = getRuntimeConnector(runtimeInstance.runtimeType);
    const healthPath = resolveRuntimeHealthPath(runtimeInstance.runtimeType);
    const events = store.listRuntimeEvents({
      instanceId: runtimeInstance.id
    });
    let healthPayload: Record<string, unknown> | null | undefined;

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
          healthPayload = await parseJsonObject(response);
        }
      }

      if (!healthPayload) {
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
        healthPayload = diagnostics as Record<string, unknown>;
      }
    } catch {
      healthPayload = undefined;
    }

    return reply.status(200).send(
      buildRuntimeStatsResponse({
        instanceId: runtimeInstance.id,
        healthPayload,
        events,
        instanceUpdatedAt: runtimeInstance.updatedAt
      })
    );
  });

  app.post("/api/runtime/instances/:instanceId/start", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    try {
      await runtimeProvider.startRuntimeContainer(runtimeInstance.containerName);
      const updated = updateInstanceOrThrow(runtimeInstance.id, {
        status: "running",
        lastError: undefined
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "start",
        outcome: "succeeded",
        message: "Runtime instance started."
      });
      return reply.status(200).send(toPublicRuntimeInstance(updated));
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to start runtime instance");
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "start",
        outcome: "failed",
        message: failure.message
      });
      return reply.status(502).send(failure);
    }
  });

  app.post("/api/runtime/instances/:instanceId/stop", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    try {
      await runtimeProvider.stopRuntimeContainer(runtimeInstance.containerName);
      const updated = updateInstanceOrThrow(runtimeInstance.id, {
        status: "stopped",
        lastError: undefined
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "stop",
        outcome: "succeeded",
        message: "Runtime instance stopped."
      });
      return reply.status(200).send(toPublicRuntimeInstance(updated));
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to stop runtime instance");
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "stop",
        outcome: "failed",
        message: failure.message
      });
      return reply.status(502).send(failure);
    }
  });

  app.post("/api/runtime/instances/:instanceId/restart", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    try {
      // Apply latest config first; this may already restart when instance is currently running.
      const configuredInstance = await applyRuntimeConfigForInstance(runtimeInstance);
      if (configuredInstance.status !== "running") {
        await runtimeProvider.restartRuntimeContainer(runtimeInstance.containerName);
      }
      const updated = updateInstanceOrThrow(runtimeInstance.id, {
        status: "running",
        lastError: undefined
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "restart",
        outcome: "succeeded",
        message: "Runtime instance restarted."
      });
      return reply.status(200).send(toPublicRuntimeInstance(updated));
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to restart runtime instance");
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "restart",
        outcome: "failed",
        message: failure.message
      });
      return reply.status(502).send(failure);
    }
  });

  app.delete("/api/runtime/instances/:instanceId", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const query = request.query as { destroyVolume?: unknown };
    const destroyVolume = parseBooleanQueryValue(query.destroyVolume, true);

    try {
      await runtimeProvider.destroyRuntimeContainer({
        containerName: runtimeInstance.containerName,
        volumeName: runtimeInstance.volumeName,
        destroyVolume
      });
    } catch (error) {
      const failure = buildFailurePayload(error, "Failed to delete runtime instance");
      updateInstanceOrThrow(runtimeInstance.id, {
        status: "error",
        lastError: failure.message
      });
      appendRuntimeEvent({
        requestId: request.id,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "delete",
        outcome: "failed",
        message: failure.message
      });
      return reply.status(502).send(failure);
    }

    const deleted = store.deleteRuntimeInstance(runtimeInstance.id);
    if (!deleted) {
      return reply.status(404).send({
        message: `Runtime instance ${runtimeInstance.id} not found`
      });
    }
    store.deleteAgent(deleted.agentId);
    appendRuntimeEvent({
      requestId: request.id,
      tenantId: deleted.tenantId,
      agentId: deleted.agentId,
      instanceId: deleted.id,
      action: "delete",
      outcome: "succeeded",
      message: "Runtime instance deleted."
    });

    return reply.status(200).send({
      deleted: toPublicRuntimeInstance(deleted)
    });
  });

  async function refreshRuntimeInstanceState(runtimeInstance: Parameters<typeof toPublicRuntimeInstance>[0]) {
    try {
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

      if (running && runtimeInstance.status !== "running") {
        return updateInstanceOrThrow(runtimeInstance.id, {
          status: "running",
          lastError: undefined
        });
      }

      if (!running && runtimeInstance.status === "running") {
        return updateInstanceOrThrow(runtimeInstance.id, {
          status: "stopped",
          lastError: undefined
        });
      }

      if (!running && runtimeInstance.status === "provisioning") {
        return updateInstanceOrThrow(runtimeInstance.id, {
          status: "error",
          lastError: diagnostics.container?.message
        });
      }
    } catch {
      return runtimeInstance;
    }

    return runtimeInstance;
  }
}
