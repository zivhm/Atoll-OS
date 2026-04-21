import type { FastifyInstance } from "fastify";

import { parsePositiveIntegerUnknown } from "../../../parsers.js";

import type { RuntimeRouteDeps } from "./types.js";

export function registerRuntimeTraceRoutes(app: FastifyInstance, deps: RuntimeRouteDeps): void {
  const {
    getAuthContextOrThrow,
    resolveRuntimeInstanceOrReply,
    listRuntimeTraceRuns,
    getRuntimeTraceRun,
    listRuntimeTraceEvents
  } = deps;

  app.get("/api/runtime/instances/:instanceId/traces", async (request, reply) => {
    getAuthContextOrThrow(request);
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const query = request.query as { limit?: unknown };
    const limit = parsePositiveIntegerUnknown(query.limit, 25);
    return reply.status(200).send({
      items: listRuntimeTraceRuns({
        instanceId: runtimeInstance.id,
        limit
      })
    });
  });

  app.get("/api/runtime/instances/:instanceId/traces/:traceId", async (request, reply) => {
    getAuthContextOrThrow(request);
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const params = request.params as { traceId?: unknown };
    const traceId = typeof params.traceId === "string" ? params.traceId.trim() : "";
    if (!traceId) {
      return reply.status(400).send({
        message: "Validation failed: traceId is required"
      });
    }

    const run = getRuntimeTraceRun(traceId);
    if (!run || run.instanceId !== runtimeInstance.id) {
      return reply.status(404).send({
        message: `Runtime trace ${traceId} not found`
      });
    }

    return reply.status(200).send({
      run,
      events: listRuntimeTraceEvents({ runId: run.id })
    });
  });

  app.get("/api/runtime/instances/:instanceId/traces/:traceId/export", async (request, reply) => {
    getAuthContextOrThrow(request);
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const params = request.params as { traceId?: unknown };
    const traceId = typeof params.traceId === "string" ? params.traceId.trim() : "";
    if (!traceId) {
      return reply.status(400).send({
        message: "Validation failed: traceId is required"
      });
    }

    const run = getRuntimeTraceRun(traceId);
    if (!run || run.instanceId !== runtimeInstance.id) {
      return reply.status(404).send({
        message: `Runtime trace ${traceId} not found`
      });
    }

    return reply.status(200).send({
      exportedAt: new Date().toISOString(),
      run,
      events: listRuntimeTraceEvents({ runId: run.id })
    });
  });
}
