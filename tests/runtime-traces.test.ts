import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Fastify from "fastify";

import { registerRuntimeChatRoutes } from "../src/http/routes/runtime/runtime-chat.routes.js";
import { registerRuntimeTraceRoutes } from "../src/http/routes/runtime/runtime-traces.routes.js";
import type { RuntimeRouteDeps } from "../src/http/routes/runtime/types.js";
import { createStore, type RuntimeInstance, type RuntimeType } from "../src/store.js";

function createTempStore() {
  const root = mkdtempSync(join(tmpdir(), "atoll-runtime-traces-"));
  return createStore({
    stateFilePath: join(root, "state.json"),
    secretsKey: "test-secret",
    runtimeTraceRunsMaxEntries: 2,
    runtimeTraceEventsMaxEntries: 10,
    runtimeTraceMaxAgeDays: 30
  });
}

function createRuntimeInstance(runtimeType: RuntimeType): RuntimeInstance {
  const now = new Date().toISOString();
  return {
    id: `${runtimeType}-instance-1`,
    tenantId: "tenant-1",
    agentId: "agent-1",
    runtimeType,
    containerName: `atoll-rt-${runtimeType}-1`,
    volumeName: `atoll_rt_${runtimeType}_1`,
    networkName: "atoll-network",
    baseUrl: "http://127.0.0.1:42617",
    gatewayPort: 42617,
    requirePairing: false,
    allowPublicBind: true,
    llmProvider: "openrouter",
    llmModel: runtimeType === "hermes" ? "openai/gpt-5.3-chat" : "anthropic/claude-sonnet-4.6",
    telegramEnabled: false,
    telegramAllowFrom: [],
    telegramReplyInPrivate: true,
    slackEnabled: false,
    slackAllowedChannelIds: [],
    slackAllowedUserIds: [],
    slackReplyInThread: true,
    discordEnabled: false,
    discordAllowedUserIds: [],
    discordAllowedGuildIds: [],
    discordAllowedChannelIds: [],
    discordReplyInThread: true,
    discordRequireMention: true,
    runtimeOptions: {},
    status: "running",
    createdAt: now,
    updatedAt: now
  };
}

async function buildTraceTestApp(runtimeType: RuntimeType) {
  const store = createTempStore();
  const tenant = store.ensureDefaultTenant("org-1");
  const agent = store.createAgent({
    tenantId: tenant.id,
    name: `${runtimeType} helper`,
    channel: "custom"
  });
  const created = store.createRuntimeInstance({
    ...createRuntimeInstance(runtimeType),
    tenantId: tenant.id,
    agentId: agent.id
  });
  const instance = store.updateRuntimeInstance(created.id, {
    status: "running"
  }) as RuntimeInstance;
  const app = Fastify();
  const deps = createRouteDeps(store);
  registerRuntimeChatRoutes(app, deps);
  registerRuntimeTraceRoutes(app, deps);
  await app.ready();
  return { app, store, instance };
}

function createRouteDeps(store: ReturnType<typeof createStore>): RuntimeRouteDeps {
  const runtimeProvider = {
    id: "test-runtime",
    displayName: "Test Runtime",
    checkPrereqs: async () => ({
      image: { name: "test", status: "present", message: "" },
      network: { name: "test", status: "present", message: "" },
      containerCli: "docker",
      processMode: "daemon" as const
    }),
    provisionRuntimeContainer: async () => {},
    writeRuntimeConfig: async () => {},
    restartRuntimeContainer: async () => {},
    startRuntimeContainer: async () => {},
    stopRuntimeContainer: async () => {},
    readRuntimeContainerLogs: async () => "",
    getRuntimePairingInfo: async () => ({ message: "" }),
    getRuntimeEnvironmentDiagnostics: async () => ({
      containerCli: "docker",
      processMode: "daemon" as const,
      image: { name: "test", status: "present", message: "" },
      network: { name: "test", status: "present", message: "" },
      container: {
        name: "atoll-rt-test",
        status: "reachable" as const,
        running: true,
        message: ""
      }
    }),
    destroyRuntimeContainer: async () => {}
  } as unknown as RuntimeRouteDeps["runtimeProvider"];

  return {
    store,
    config: {
      runtimeImage: "zeroclaw:test",
      runtimeOpenclawImage: "openclaw:test",
      runtimeHermesImage: "hermes:test",
      runtimeEventsMaxEntries: 5000,
      runtimeEventsMaxAgeDays: 30,
      supportedRuntimeTypes: ["openclaw", "zeroclaw", "hermes"],
      defaultRuntimeType: "openclaw",
      runtimeCatalog: [],
      runtimeNetwork: "atoll-network",
      runtimeApiKey: "api-key",
      runtimeHttpTimeoutMs: 5000,
      runtimeProvider: "openrouter",
      runtimeModel: "openai/gpt-5.3-chat",
      runtimeGatewayPort: 42617,
      runtimeRequirePairing: false,
      runtimeAllowPublicBind: true
    },
    runtimeProvider,
    getAuthContextOrThrow: () => ({
      sub: "user-1",
      orgId: "org-1"
    }),
    toPublicRuntimeInstance: (instance) => instance,
    appendRuntimeEvent: (input) => {
      store.appendRuntimeEvent(input);
    },
    appendRuntimeChatMessage: (input) =>
      store.appendRuntimeChatMessage({
        instanceId: input.instanceId,
        role: input.role,
        content: input.content,
        requestId: input.requestId,
        metadata: input.metadata
      }),
    listRuntimeChatMessages: (input) => store.listRuntimeChatMessages(input),
    listRuntimeTraceRuns: (input) => store.listRuntimeTraceRuns(input),
    getRuntimeTraceRun: (traceId) => store.getRuntimeTraceRun(traceId),
    createRuntimeTraceRun: (input) => store.createRuntimeTraceRun(input),
    updateRuntimeTraceRun: (traceId, patch) => store.updateRuntimeTraceRun(traceId, patch),
    listRuntimeTraceEvents: (input) => store.listRuntimeTraceEvents(input),
    appendRuntimeTraceEvent: (input) => store.appendRuntimeTraceEvent(input),
    resolveRuntimeCreationInput: () => ({ ok: false, statusCode: 501, message: "unused" }),
    createProvisioningRuntimeRecord: async () => {
      throw new Error("unused");
    },
    runProvisionWork: async () => {
      throw new Error("unused");
    },
    resolveRuntimeInstanceOrReply: (_request, paramsPayload, reply) => {
      const params = paramsPayload as { instanceId?: unknown };
      const instanceId = typeof params.instanceId === "string" ? params.instanceId.trim() : "";
      const runtimeInstance = store.getRuntimeInstance(instanceId);
      if (!runtimeInstance) {
        void reply.status(404).send({
          message: `Runtime instance ${instanceId} not found`
        });
        return undefined;
      }
      return runtimeInstance;
    },
    updateInstanceOrThrow: (instanceId, patch) => {
      const updated = store.updateRuntimeInstance(instanceId, patch);
      if (!updated) {
        throw new Error(`Runtime instance ${instanceId} not found`);
      }
      return updated;
    },
    applyRuntimeConfigForInstance: async (runtimeInstance) => runtimeInstance,
    parseJsonObject: async (response) => {
      const text = await response.text();
      if (!text.trim()) {
        return null;
      }
      return JSON.parse(text) as Record<string, unknown>;
    },
    provisionService: {
      listJobs: () => [],
      getJob: () => undefined,
      createJob: () => ({ id: "job-1", instanceId: "instance-1", status: "queued" }),
      enqueueJob: () => {}
    },
    reconcileService: {
      reconcileInstances: async () => ({
        summary: {
          checked: 0,
          updated: 0,
          unchanged: 0,
          errors: 0
        },
        actions: []
      })
    }
  };
}

test("hermes chat traces store usage, tool calls, and sanitized request headers", async (t) => {
  const { app, instance } = await buildTraceTestApp("hermes");
  t.after(async () => {
    await app.close();
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "chatcmpl-1",
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: "Working on it.",
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "lookup_weather",
                    arguments: "{\"city\":\"Tel Aviv\",\"apiKey\":\"secret\"}"
                  }
                }
              ]
            }
          }
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 7,
          total_tokens: 19
        }
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/runtime/instances/${instance.id}/chat`,
    payload: {
      message: "What is the weather?",
      token: "super-secret-token"
    }
  });

  assert.equal(response.statusCode, 200);

  const tracesResponse = await app.inject({
    method: "GET",
    url: `/api/runtime/instances/${instance.id}/traces`
  });
  assert.equal(tracesResponse.statusCode, 200);
  const tracesPayload = tracesResponse.json() as {
    items: Array<{
      id: string;
      status: string;
      toolCallCount: number;
      usage?: { totalTokens?: number };
      finishReason?: string;
      assistantMessageId?: string;
    }>;
  };
  assert.equal(tracesPayload.items.length, 1);
  assert.equal(tracesPayload.items[0]?.status, "succeeded");
  assert.equal(tracesPayload.items[0]?.toolCallCount, 1);
  assert.equal(tracesPayload.items[0]?.usage?.totalTokens, 19);
  assert.equal(tracesPayload.items[0]?.finishReason, "tool_calls");
  assert.ok(tracesPayload.items[0]?.assistantMessageId);

  const traceId = tracesPayload.items[0]?.id;
  assert.ok(traceId);
  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/runtime/instances/${instance.id}/traces/${traceId}`
  });
  assert.equal(detailResponse.statusCode, 200);
  const detailPayload = detailResponse.json() as {
    run: { status: string };
    events: Array<{ kind: string; data?: Record<string, unknown> }>;
  };
  assert.equal(detailPayload.run.status, "succeeded");
  assert.ok(detailPayload.events.some((event) => event.kind === "tool_calls_observed"));
  const requestBuilt = detailPayload.events.find((event) => event.kind === "request_built");
  assert.equal(
    ((requestBuilt?.data?.headers as Record<string, unknown> | undefined)?.Authorization),
    "[redacted]"
  );
});

test("openclaw chat traces record gateway milestones and completion timing", async (t) => {
  const { app, instance } = await buildTraceTestApp("openclaw");
  t.after(async () => {
    await app.close();
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const originalWebSocket = globalThis.WebSocket;
  class FakeWebSocket {
    static instances: FakeWebSocket[] = [];
    url: string;
    readyState = 1;
    private listeners = new Map<string, Set<(event: unknown) => void>>();

    constructor(url: string) {
      this.url = url;
      FakeWebSocket.instances.push(this);
      setTimeout(() => {
        this.emit("open", {});
        this.emit("message", {
          data: JSON.stringify({
            type: "event",
            event: "connect.challenge",
            payload: {}
          })
        });
      }, 0);
    }

    addEventListener(type: string, listener: (event: unknown) => void) {
      const existing = this.listeners.get(type) ?? new Set();
      existing.add(listener);
      this.listeners.set(type, existing);
    }

    removeEventListener(type: string, listener: (event: unknown) => void) {
      this.listeners.get(type)?.delete(listener);
    }

    send(data: string) {
      const payload = JSON.parse(data) as { id: string; method: string };
      if (payload.method === "connect") {
        setTimeout(() => {
          this.emit("message", {
            data: JSON.stringify({
              type: "res",
              id: payload.id,
              ok: true,
              payload: { type: "hello-ok" }
            })
          });
        }, 0);
        return;
      }

      if (payload.method === "chat.send") {
        setTimeout(() => {
          this.emit("message", {
            data: JSON.stringify({
              type: "res",
              id: payload.id,
              ok: true,
              payload: { runId: "run-1" }
            })
          });
          this.emit("message", {
            data: JSON.stringify({
              type: "event",
              event: "chat",
              payload: {
                runId: "run-1",
                state: "final",
                message: {
                  text: "OpenClaw response"
                }
              }
            })
          });
        }, 0);
      }
    }

    close() {
      this.emit("close", { code: 1000, reason: "closed" });
    }

    private emit(type: string, event: unknown) {
      for (const listener of this.listeners.get(type) ?? []) {
        listener(event);
      }
    }
  }

  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  t.after(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/runtime/instances/${instance.id}/chat`,
    payload: {
      message: "Ping OpenClaw"
    }
  });
  assert.equal(response.statusCode, 200);

  const tracesResponse = await app.inject({
    method: "GET",
    url: `/api/runtime/instances/${instance.id}/traces`
  });
  const tracesPayload = tracesResponse.json() as {
    items: Array<{ id: string; status: string; durationMs?: number }>;
  };
  assert.equal(tracesPayload.items[0]?.status, "succeeded");
  assert.equal(typeof tracesPayload.items[0]?.durationMs, "number");

  const traceId = tracesPayload.items[0]?.id;
  assert.ok(traceId);
  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/runtime/instances/${instance.id}/traces/${traceId}`
  });
  const detailPayload = detailResponse.json() as {
    events: Array<{ kind: string; summary: string }>;
  };
  const gatewayEvents = detailPayload.events.filter((event) => event.kind === "gateway_event");
  assert.ok(gatewayEvents.length >= 3);
  assert.ok(gatewayEvents.some((event) => /challenge/u.test(event.summary)));
});

test("failed chat traces capture failure message and terminal status", async (t) => {
  const { app, instance } = await buildTraceTestApp("hermes");
  t.after(async () => {
    await app.close();
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("connection refused");
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/runtime/instances/${instance.id}/chat`,
    payload: {
      message: "This will fail"
    }
  });
  assert.equal(response.statusCode, 502);

  const tracesResponse = await app.inject({
    method: "GET",
    url: `/api/runtime/instances/${instance.id}/traces`
  });
  const tracesPayload = tracesResponse.json() as {
    items: Array<{ id: string; status: string; failureMessage?: string }>;
  };
  assert.equal(tracesPayload.items[0]?.status, "failed");
  assert.match(tracesPayload.items[0]?.failureMessage ?? "", /Failed to reach runtime chat endpoint/u);
});

test("runtime trace pruning keeps trace limits separate from runtime events", () => {
  const store = createTempStore();
  const nowMs = Date.now();
  const tenant = store.ensureDefaultTenant("org-1");
  const agent = store.createAgent({
    tenantId: tenant.id,
    name: "Trace pruning helper",
    channel: "custom"
  });
  const instance = store.createRuntimeInstance({
    ...createRuntimeInstance("hermes"),
    tenantId: tenant.id,
    agentId: agent.id
  });

  const runOne = store.createRuntimeTraceRun({
    requestId: "req-1",
    tenantId: tenant.id,
    agentId: agent.id,
    instanceId: instance.id,
    runtimeType: "hermes",
    transport: "openai-chat-completions",
    model: "openai/gpt-5.3-chat",
    status: "started",
    startedAt: new Date(nowMs - 2 * 60_000).toISOString(),
    toolCallCount: 0
  });
  store.appendRuntimeTraceEvent({
    runId: runOne.id,
    kind: "run_started",
    summary: "run one"
  });

  const runTwo = store.createRuntimeTraceRun({
    requestId: "req-2",
    tenantId: tenant.id,
    agentId: agent.id,
    instanceId: instance.id,
    runtimeType: "hermes",
    transport: "openai-chat-completions",
    model: "openai/gpt-5.3-chat",
    status: "started",
    startedAt: new Date(nowMs - 60_000).toISOString(),
    toolCallCount: 0
  });
  store.appendRuntimeTraceEvent({
    runId: runTwo.id,
    kind: "run_started",
    summary: "run two"
  });

  const runThree = store.createRuntimeTraceRun({
    requestId: "req-3",
    tenantId: tenant.id,
    agentId: agent.id,
    instanceId: instance.id,
    runtimeType: "hermes",
    transport: "openai-chat-completions",
    model: "openai/gpt-5.3-chat",
    status: "started",
    startedAt: new Date(nowMs).toISOString(),
    toolCallCount: 0
  });
  store.appendRuntimeEvent({
    tenantId: tenant.id,
    agentId: agent.id,
    instanceId: instance.id,
    action: "chat",
    outcome: "succeeded",
    message: "Runtime event survives trace pruning."
  });
  store.appendRuntimeTraceEvent({
    runId: runThree.id,
    kind: "run_started",
    summary: "run three"
  });

  const runs = store.listRuntimeTraceRuns({ instanceId: instance.id });
  assert.equal(runs.length, 2);
  assert.deepEqual(
    runs.map((run) => run.requestId),
    ["req-3", "req-2"]
  );
  assert.equal(store.listRuntimeTraceEvents({ runId: runOne.id }).length, 0);
  assert.equal(store.listRuntimeEvents({ instanceId: instance.id }).length, 1);
});
