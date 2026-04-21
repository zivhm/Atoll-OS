import { randomBytes, randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import { buildFailurePayload } from "../../../errors.js";
import { redactSensitiveText, sanitizeApiPayload } from "../../../response-sanitizer.js";
import { getRuntimeConnector } from "../../../runtime-kind.js";
import { parsePositiveIntegerUnknown, parseRuntimeChatInput } from "../../../parsers.js";
import type {
  RuntimeChatMessage,
  RuntimeInstance,
  RuntimeTraceEventKind,
  RuntimeTraceTransport,
  RuntimeType
} from "../../../store.js";
import { hasTimeout, resolveTimeoutSignal } from "../http-timeout.js";
import { resolveRuntimeHttpBaseUrl } from "./runtime-base-url.js";
import { resolveRuntimeWebSocketCtor } from "./runtime-websocket.js";

import type { RuntimeRouteDeps } from "./types.js";

const OPENCLAW_PROTOCOL_VERSION = 3;
const OPENCLAW_MAIN_SESSION_KEY = "main";
const OPENCLAW_CHAT_SCOPES = ["operator.write"] as const;
const OPENCLAW_GATEWAY_OPEN_ATTEMPTS = 3;
const OPENCLAW_GATEWAY_RETRY_DELAY_MS = 250;
const OPENCLAW_CLIENT_INFO = {
  id: "gateway-client",
  mode: "backend",
  version: "0.1.0",
  platform: "node",
} as const;

type RuntimeChatAdapterResponse = {
  resolvedBaseUrl: string;
  raw: Record<string, unknown> | null;
  assistantText: string;
  statusCode?: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
  toolCalls?: RuntimeObservedToolCall[];
};

type RuntimeChatExecutionResult =
  | {
      ok: true;
      runtimeInstance: RuntimeInstance;
      userMessage: RuntimeChatMessage;
      assistantMessage: RuntimeChatMessage;
      raw?: Record<string, unknown>;
    }
  | {
      ok: false;
      runtimeInstance: RuntimeInstance;
      statusCode: number;
      message: string;
      userMessage?: RuntimeChatMessage;
      errorMessage: RuntimeChatMessage;
      raw?: Record<string, unknown>;
      failureClass?: string;
      failureHint?: string;
    };

type OpenClawErrorShape = {
  code?: string;
  message?: string;
};

type OpenClawRequestFrame = {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
};

type OpenClawResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: OpenClawErrorShape;
};

type OpenClawEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
};

type OpenClawFrame = OpenClawResponseFrame | OpenClawEventFrame;

type OpenClawTerminalChatPayload = {
  runId?: string;
  state?: string;
  errorMessage?: string;
  message?: unknown;
};

type RuntimeObservedToolCall = {
  id?: string;
  type?: string;
  name?: string;
  argumentsPreview?: string;
};

type RuntimeChatTraceRecorder = {
  runId: string;
  startedAtMs: number;
  record: (
    kind: RuntimeTraceEventKind,
    summary: string,
    data?: Record<string, unknown>,
    createdAt?: string
  ) => void;
  updateRun: (patch: Record<string, unknown>) => void;
  succeed: (patch?: Record<string, unknown>) => void;
  fail: (patch?: Record<string, unknown>) => void;
};

export function registerRuntimeChatRoutes(app: FastifyInstance, deps: RuntimeRouteDeps): void {
  const {
    config,
    runtimeProvider,
    resolveRuntimeInstanceOrReply,
    updateInstanceOrThrow,
    applyRuntimeConfigForInstance,
    parseJsonObject,
    appendRuntimeEvent,
    appendRuntimeChatMessage,
    listRuntimeChatMessages,
    createRuntimeTraceRun,
    updateRuntimeTraceRun,
    appendRuntimeTraceEvent
  } = deps;

  app.get("/api/runtime/instances/:instanceId/chat-messages", async (request, reply) => {
    const runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const query = request.query as { limit?: unknown };
    const limit = parsePositiveIntegerUnknown(query.limit, 50);
    const items = listRuntimeChatMessages({
      instanceId: runtimeInstance.id,
      limit,
    });

    return reply.status(200).send({ items });
  });

  app.post("/api/runtime/instances/:instanceId/chat", async (request, reply) => {
    let runtimeInstance = resolveRuntimeInstanceOrReply(request, request.params, reply);
    if (!runtimeInstance) return;

    const connector = getRuntimeConnector(runtimeInstance.runtimeType);
    if (!connector.capabilities.chatAction) {
      return reply.status(501).send({
        message: `Chat is not available for ${runtimeInstance.runtimeType} runtimes.`,
      });
    }

    if (runtimeInstance.status !== "running") {
      return reply.status(409).send({
        message: "Runtime must be running before chat is available.",
      });
    }

    const input = parseRuntimeChatInput(request.body);
    const result = await executeRuntimeChatRequest({
      deps: {
        config,
        runtimeProvider,
        updateInstanceOrThrow,
        applyRuntimeConfigForInstance,
        parseJsonObject,
        appendRuntimeEvent,
        appendRuntimeChatMessage,
        createRuntimeTraceRun,
        updateRuntimeTraceRun,
        appendRuntimeTraceEvent
      },
      runtimeInstance,
      message: input.message,
      requestId: request.id,
      token: input.token,
    });

    if (result.ok) {
      return reply.status(200).send({
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
        raw: result.raw,
      });
    }

    return reply.status(result.statusCode).send({
      ...(result.failureClass
        ? {
            failureClass: result.failureClass,
            failureHint: result.failureHint,
          }
        : {}),
      message: result.message,
      ...(result.userMessage ? { userMessage: result.userMessage } : {}),
      errorMessage: result.errorMessage,
      ...(result.raw ? { raw: result.raw } : {}),
    });
  });
}

async function executeRuntimeChatRequest(input: {
  deps: Pick<
    RuntimeRouteDeps,
    | "config"
    | "runtimeProvider"
    | "updateInstanceOrThrow"
    | "applyRuntimeConfigForInstance"
    | "parseJsonObject"
    | "appendRuntimeEvent"
    | "appendRuntimeChatMessage"
    | "createRuntimeTraceRun"
    | "updateRuntimeTraceRun"
    | "appendRuntimeTraceEvent"
  >;
  runtimeInstance: RuntimeInstance;
  message: string;
  requestId?: string;
  token?: string;
}): Promise<RuntimeChatExecutionResult> {
  const traceStartedAtMs = Date.now();
  let runtimeInstance = input.runtimeInstance;
  const resolvedToken = await resolveRuntimeChatToken({
    config: input.deps.config,
    runtimeInstance,
    runtimeProvider: input.deps.runtimeProvider,
    updateInstanceOrThrow: input.deps.updateInstanceOrThrow,
    applyRuntimeConfigForInstance: input.deps.applyRuntimeConfigForInstance,
    token: input.token,
  });
  runtimeInstance = resolvedToken.runtimeInstance;
  const token = resolvedToken.token;

  if (runtimeInstance.requirePairing && !token) {
    const errorMessage = input.deps.appendRuntimeChatMessage({
      instanceId: runtimeInstance.id,
      role: "error",
      content: "Runtime token missing. Pair runtime or set token first.",
      requestId: input.requestId,
    });
    return {
      ok: false,
      runtimeInstance,
      statusCode: 400,
      message: errorMessage.content,
      errorMessage,
    };
  }

  const userMessage = input.deps.appendRuntimeChatMessage({
    instanceId: runtimeInstance.id,
    role: "user",
    content: input.message,
    requestId: input.requestId,
  });
  const runtimeAwareMessage = buildRuntimeAwareMessage(runtimeInstance, input.message);
  const trace = createRuntimeChatTraceRecorder({
    deps: input.deps,
    runtimeInstance,
    requestId: input.requestId,
    userMessageId: userMessage.id,
    startedAtMs: traceStartedAtMs
  });
  trace.record("run_started", "Accepted runtime chat request.", {
    runtimeType: runtimeInstance.runtimeType,
    transport: getRuntimeConnector(runtimeInstance.runtimeType).chatTransport,
    model: runtimeInstance.llmModel,
    requestId: input.requestId,
    userMessageId: userMessage.id
  });

  try {
    const result = await sendRuntimeChatMessage({
      config: input.deps.config,
      runtimeInstance,
      runtimeProvider: input.deps.runtimeProvider,
      parseJsonObject: input.deps.parseJsonObject,
      message: runtimeAwareMessage,
      requestId: input.requestId,
      token,
      trace,
    });

    if (result.resolvedBaseUrl !== runtimeInstance.baseUrl) {
      runtimeInstance = input.deps.updateInstanceOrThrow(runtimeInstance.id, {
        baseUrl: result.resolvedBaseUrl,
      });
    }

    runtimeInstance = input.deps.updateInstanceOrThrow(runtimeInstance.id, {
      status: "running",
      lastError: undefined,
    });

    const sanitizedRaw = sanitizeApiPayload(result.raw);
    const assistantMessage = input.deps.appendRuntimeChatMessage({
      instanceId: runtimeInstance.id,
      role: "assistant",
      content: result.assistantText,
      requestId: input.requestId,
      metadata: sanitizedRaw ?? undefined,
    });
    trace.record("assistant_text_extracted", "Extracted assistant text from runtime response.", {
      assistantPreview: buildAssistantPreview(result.assistantText),
      assistantLength: result.assistantText.length,
      assistantMessageId: assistantMessage.id
    });
    trace.succeed({
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - trace.startedAtMs,
      assistantMessageId: assistantMessage.id,
      toolCallCount: result.toolCalls?.length ?? 0,
      usage: result.usage,
      finishReason: result.finishReason,
      lastEventKind: "run_succeeded"
    });
    trace.record("run_succeeded", "Runtime chat request completed successfully.", {
      assistantMessageId: assistantMessage.id,
      durationMs: Date.now() - trace.startedAtMs,
      toolCallCount: result.toolCalls?.length ?? 0,
      usage: result.usage,
      finishReason: result.finishReason
    });

    input.deps.appendRuntimeEvent({
      requestId: input.requestId,
      tenantId: runtimeInstance.tenantId,
      agentId: runtimeInstance.agentId,
      instanceId: runtimeInstance.id,
      action: "chat",
      outcome: "succeeded",
      message: "Runtime chat request succeeded.",
      metadata: {
        role: "assistant",
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      },
    });

    return {
      ok: true,
      runtimeInstance,
      userMessage,
      assistantMessage,
      raw: sanitizedRaw ?? undefined,
    };
  } catch (error) {
    if (error instanceof RuntimeChatHttpError) {
      const message = error.message.trim() || "Runtime chat request failed.";
      const sanitizedRaw = sanitizeApiPayload(error.raw);
      const errorMessage = input.deps.appendRuntimeChatMessage({
        instanceId: runtimeInstance.id,
        role: "error",
        content: message,
        requestId: input.requestId,
        metadata: sanitizedRaw ?? undefined,
      });
      trace.fail({
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - trace.startedAtMs,
        errorMessageId: errorMessage.id,
        failureMessage: message,
        lastEventKind: "run_failed"
      });
      trace.record("run_failed", "Runtime chat request failed.", {
        statusCode: error.statusCode,
        errorMessageId: errorMessage.id,
        failureMessage: message,
        response: summarizeResponsePayload(sanitizedRaw)
      });

      input.deps.appendRuntimeEvent({
        requestId: input.requestId,
        tenantId: runtimeInstance.tenantId,
        agentId: runtimeInstance.agentId,
        instanceId: runtimeInstance.id,
        action: "chat",
        outcome: "failed",
        message,
        metadata: {
          statusCode: error.statusCode,
          errorMessageId: errorMessage.id,
        },
      });

      return {
        ok: false,
        runtimeInstance,
        statusCode: error.statusCode,
        message,
        userMessage,
        errorMessage,
        raw: sanitizedRaw ?? undefined,
      };
    }

    const failure = buildFailurePayload(error, "Failed to reach runtime chat endpoint");
    runtimeInstance = input.deps.updateInstanceOrThrow(runtimeInstance.id, {
      status: "error",
      lastError: failure.message,
    });
    const errorMessage = input.deps.appendRuntimeChatMessage({
      instanceId: runtimeInstance.id,
      role: "error",
      content: failure.message,
      requestId: input.requestId,
      metadata: {
        failureClass: failure.failureClass,
        failureHint: failure.failureHint,
      },
    });
    trace.fail({
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - trace.startedAtMs,
      errorMessageId: errorMessage.id,
      failureClass: failure.failureClass,
      failureMessage: failure.message,
      lastEventKind: "run_failed"
    });
    trace.record("run_failed", "Runtime chat request failed before a runtime response completed.", {
      failureClass: failure.failureClass,
      failureHint: failure.failureHint,
      errorMessageId: errorMessage.id,
      failureMessage: failure.message
    });
    input.deps.appendRuntimeEvent({
      requestId: input.requestId,
      tenantId: runtimeInstance.tenantId,
      agentId: runtimeInstance.agentId,
      instanceId: runtimeInstance.id,
      action: "chat",
      outcome: "failed",
      message: failure.message,
      metadata: {
        failureClass: failure.failureClass,
        errorMessageId: errorMessage.id,
      },
    });

    return {
      ok: false,
      runtimeInstance,
      statusCode: 502,
      message: failure.message,
      userMessage,
      errorMessage,
      failureClass: failure.failureClass,
      failureHint: failure.failureHint,
    };
  }
}

async function sendRuntimeChatMessage(input: {
  config: RuntimeRouteDeps["config"];
  runtimeInstance: RuntimeInstance;
  runtimeProvider: RuntimeRouteDeps["runtimeProvider"];
  parseJsonObject: RuntimeRouteDeps["parseJsonObject"];
  message: string;
  requestId?: string;
  token?: string;
  trace: RuntimeChatTraceRecorder;
}): Promise<RuntimeChatAdapterResponse> {
  const connector = getRuntimeConnector(input.runtimeInstance.runtimeType);
  if (connector.chatTransport === "openclaw-gateway") {
    return sendOpenClawChatMessage(input);
  }
  return sendHttpRuntimeChatMessage(input);
}

async function resolveRuntimeChatToken(input: {
  config: RuntimeRouteDeps["config"];
  runtimeInstance: RuntimeInstance;
  runtimeProvider: RuntimeRouteDeps["runtimeProvider"];
  updateInstanceOrThrow: RuntimeRouteDeps["updateInstanceOrThrow"];
  applyRuntimeConfigForInstance: RuntimeRouteDeps["applyRuntimeConfigForInstance"];
  token?: string;
}): Promise<{
  runtimeInstance: RuntimeInstance;
  token?: string;
}> {
  const explicitToken = pickString(input.token);
  if (explicitToken) {
    return {
      runtimeInstance: input.runtimeInstance,
      token: explicitToken
    };
  }

  const resolved = await readRuntimeChatTokenFromConfig(input);
  if (resolved) {
    return resolved;
  }

  const storedToken = pickString(input.runtimeInstance.bearerToken);
  if (storedToken) {
    const synced = await syncManagedRuntimeChatTokenToConfig(input, storedToken);
    if (synced) {
      return synced;
    }
    return {
      runtimeInstance: input.runtimeInstance,
      token: storedToken
    };
  }

  const seeded = await seedManagedRuntimeChatToken(input);
  if (seeded) {
    return seeded;
  }

  return {
    runtimeInstance: input.runtimeInstance,
    token: undefined
  };
}

async function readRuntimeChatTokenFromConfig(input: {
  config: RuntimeRouteDeps["config"];
  runtimeInstance: RuntimeInstance;
  runtimeProvider: RuntimeRouteDeps["runtimeProvider"];
  updateInstanceOrThrow: RuntimeRouteDeps["updateInstanceOrThrow"];
  applyRuntimeConfigForInstance: RuntimeRouteDeps["applyRuntimeConfigForInstance"];
}): Promise<
  | {
      runtimeInstance: RuntimeInstance;
      token: string;
    }
  | undefined
> {
  const readRuntimeBearerToken = input.runtimeProvider.readRuntimeBearerToken;
  if (!readRuntimeBearerToken) {
    return undefined;
  }

  try {
    const loadedToken = await readRuntimeBearerToken({
      runtimeType: input.runtimeInstance.runtimeType,
      volumeName: input.runtimeInstance.volumeName
    });
    const token = pickString(loadedToken);
    if (!token) {
      return undefined;
    }

    if (token === pickString(input.runtimeInstance.bearerToken)) {
      return {
        runtimeInstance: input.runtimeInstance,
        token
      };
    }

    const updated = input.updateInstanceOrThrow(input.runtimeInstance.id, {
      bearerToken: token
    });
    return {
      runtimeInstance: updated,
      token
    };
  } catch {
    return undefined;
  }
}

async function seedManagedRuntimeChatToken(input: {
  config: RuntimeRouteDeps["config"];
  runtimeInstance: RuntimeInstance;
  runtimeProvider: RuntimeRouteDeps["runtimeProvider"];
  updateInstanceOrThrow: RuntimeRouteDeps["updateInstanceOrThrow"];
  applyRuntimeConfigForInstance: RuntimeRouteDeps["applyRuntimeConfigForInstance"];
}): Promise<
  | {
      runtimeInstance: RuntimeInstance;
      token: string;
    }
  | undefined
> {
  if (input.runtimeInstance.requirePairing || !supportsManagedRuntimeChatToken(input.runtimeInstance.runtimeType)) {
    return undefined;
  }

  const token = randomBytes(24).toString("hex");
  const updated = input.updateInstanceOrThrow(input.runtimeInstance.id, {
    bearerToken: token,
    lastError: undefined
  });
  const applied = await input.applyRuntimeConfigForInstance(updated);
  await waitForRuntimeHealthReady({
    config: input.config,
    runtimeInstance: applied,
    runtimeProvider: input.runtimeProvider
  });

  return {
    runtimeInstance: applied,
    token
  };
}

async function syncManagedRuntimeChatTokenToConfig(
  input: {
    config: RuntimeRouteDeps["config"];
    runtimeInstance: RuntimeInstance;
    runtimeProvider: RuntimeRouteDeps["runtimeProvider"];
    updateInstanceOrThrow: RuntimeRouteDeps["updateInstanceOrThrow"];
    applyRuntimeConfigForInstance: RuntimeRouteDeps["applyRuntimeConfigForInstance"];
  },
  token: string
): Promise<
  | {
      runtimeInstance: RuntimeInstance;
      token: string;
    }
  | undefined
> {
  if (input.runtimeInstance.runtimeType !== "zeroclaw" || input.runtimeInstance.requirePairing) {
    return undefined;
  }

  const applied = await input.applyRuntimeConfigForInstance(input.runtimeInstance);
  await waitForRuntimeHealthReady({
    config: input.config,
    runtimeInstance: applied,
    runtimeProvider: input.runtimeProvider
  });

  return {
    runtimeInstance: applied,
    token
  };
}

async function sendHttpRuntimeChatMessage(input: {
  config: RuntimeRouteDeps["config"];
  runtimeInstance: RuntimeInstance;
  runtimeProvider: RuntimeRouteDeps["runtimeProvider"];
  parseJsonObject: RuntimeRouteDeps["parseJsonObject"];
  message: string;
  token?: string;
  trace: RuntimeChatTraceRecorder;
}): Promise<RuntimeChatAdapterResponse> {
  const connector = getRuntimeConnector(input.runtimeInstance.runtimeType);
  const runtimeBaseUrl = await resolveRuntimeHttpBaseUrl({
    runtimeInstance: input.runtimeInstance,
    runtimeProvider: input.runtimeProvider,
  });

  if (!runtimeBaseUrl) {
    throw new RuntimeChatHttpError(
      501,
      `Chat endpoint is not available for ${input.runtimeInstance.runtimeType} runtimes.`,
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (
    input.token &&
    connector.authTransport === "webhook-secret" &&
    !input.runtimeInstance.requirePairing
  ) {
    headers["X-Webhook-Secret"] = input.token;
  } else if (input.token) {
    headers.Authorization = `Bearer ${input.token}`;
  }

  const endpoint = connector.chatEndpoint;
  if (!endpoint) {
    throw new RuntimeChatHttpError(
      501,
      `Chat endpoint is not available for ${input.runtimeInstance.runtimeType} runtimes.`,
    );
  }

  const body = buildRuntimeChatRequestBody(input.runtimeInstance, input.message);
  input.trace.record("request_built", "Built runtime chat request payload.", {
    runtimeType: input.runtimeInstance.runtimeType,
    transport: connector.chatTransport,
    baseUrl: runtimeBaseUrl,
    endpoint,
    headers: sanitizeApiPayload(headers),
    body: buildTraceRequestBodySummary(body)
  });
  input.trace.record("request_sent", "Sent runtime chat request to runtime endpoint.", {
    method: "POST",
    url: `${runtimeBaseUrl}${endpoint}`,
    timeoutMs: input.config.runtimeHttpTimeoutMs
  });
  const response = await fetch(`${runtimeBaseUrl}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: resolveTimeoutSignal(input.config.runtimeHttpTimeoutMs),
  });

  const raw = await input.parseJsonObject(response);
  const sanitizedRaw = sanitizeApiPayload(raw);
  const usage = extractRuntimeTraceUsage(raw);
  const finishReason = extractRuntimeTraceFinishReason(raw);
  const toolCalls = connector.chatTransport === "openai-chat-completions" ? extractObservedToolCalls(raw) : [];
  input.trace.record("response_received", "Received runtime chat response.", {
    statusCode: response.status,
    response: summarizeResponsePayload(sanitizedRaw),
    usage,
    finishReason,
    toolCallCount: toolCalls.length
  });
  if (toolCalls.length > 0) {
    input.trace.record("tool_calls_observed", "Observed tool calls in runtime response payload.", {
      toolCalls,
      toolCallCount: toolCalls.length
    });
  }
  if (!response.ok) {
    throw new RuntimeChatHttpError(
      response.status,
      resolveRuntimeChatErrorMessage(raw, response.status),
      raw,
    );
  }

  return {
    resolvedBaseUrl: runtimeBaseUrl,
    raw,
    statusCode: response.status,
    usage,
    finishReason,
    toolCalls,
    assistantText:
      connector.chatTransport === "openai-chat-completions"
        ? normalizeOpenAiChatAssistantText(raw)
        : normalizeRuntimeChatAssistantText(raw),
  };
}

async function sendOpenClawChatMessage(input: {
  config: RuntimeRouteDeps["config"];
  runtimeInstance: RuntimeInstance;
  runtimeProvider: RuntimeRouteDeps["runtimeProvider"];
  message: string;
  requestId?: string;
  token?: string;
  trace: RuntimeChatTraceRecorder;
}): Promise<RuntimeChatAdapterResponse> {
  const runtimeBaseUrl = await resolveRuntimeHttpBaseUrl({
    runtimeInstance: input.runtimeInstance,
    runtimeProvider: input.runtimeProvider,
  });

  if (!runtimeBaseUrl) {
    throw new RuntimeChatHttpError(501, "Chat endpoint is not available for openclaw runtimes.");
  }

  await waitForRuntimeHealthReady({
    config: input.config,
    runtimeInstance: input.runtimeInstance,
    runtimeProvider: input.runtimeProvider,
  });

  const gatewayUrl = resolveRuntimeGatewayUrl(runtimeBaseUrl);
  input.trace.record("request_built", "Prepared OpenClaw gateway chat request.", {
    runtimeType: input.runtimeInstance.runtimeType,
    transport: "openclaw-gateway",
    baseUrl: runtimeBaseUrl,
    gatewayUrl,
    request: {
      sessionKey: OPENCLAW_MAIN_SESSION_KEY,
      messageLength: input.message.length,
      hasToken: Boolean(input.token)
    }
  });
  const socket = await openGatewaySocketWithRetry(
    gatewayUrl,
    input.config.runtimeHttpTimeoutMs,
    OPENCLAW_GATEWAY_OPEN_ATTEMPTS
  );

  try {
    await socket.waitFor(
      (frame) => frame.type === "event" && frame.event === "connect.challenge",
      input.config.runtimeHttpTimeoutMs,
      "OpenClaw gateway did not send connect challenge.",
    );
    input.trace.record("gateway_event", "OpenClaw gateway challenge received.", {
      gatewayUrl,
      event: "connect.challenge"
    });

    const connectRequestId = randomUUID();
    input.trace.record("request_sent", "Sent OpenClaw gateway connect request.", {
      gatewayUrl,
      method: "connect"
    });
    socket.send({
      type: "req",
      id: connectRequestId,
      method: "connect",
      params: {
        minProtocol: OPENCLAW_PROTOCOL_VERSION,
        maxProtocol: OPENCLAW_PROTOCOL_VERSION,
        client: OPENCLAW_CLIENT_INFO,
        role: "operator",
        scopes: [...OPENCLAW_CHAT_SCOPES],
        auth: input.token
          ? {
              token: input.token,
            }
          : undefined,
      },
    });

    const connectResponse = await socket.waitFor(
      (frame): frame is OpenClawResponseFrame =>
        frame.type === "res" && frame.id === connectRequestId,
      input.config.runtimeHttpTimeoutMs,
      "OpenClaw gateway connect timed out.",
    );
    if (!connectResponse.ok || !isOpenClawHelloPayload(connectResponse.payload)) {
      throw new RuntimeChatHttpError(
        502,
        resolveOpenClawResponseMessage(connectResponse, "OpenClaw gateway rejected connect."),
        toRecord(connectResponse.payload) ?? toRecord(connectResponse.error),
      );
    }
    input.trace.record("gateway_event", "OpenClaw gateway connection acknowledged.", {
      gatewayUrl,
      event: "connect.ok"
    });

    const chatRequestId = randomUUID();
    input.trace.record("request_sent", "Sent OpenClaw chat.send request.", {
      gatewayUrl,
      method: "chat.send"
    });
    socket.send({
      type: "req",
      id: chatRequestId,
      method: "chat.send",
      params: {
        sessionKey: OPENCLAW_MAIN_SESSION_KEY,
        message: input.message,
        idempotencyKey: input.requestId ?? randomUUID(),
      },
    });

    const chatResponse = await socket.waitFor(
      (frame): frame is OpenClawResponseFrame => frame.type === "res" && frame.id === chatRequestId,
      input.config.runtimeHttpTimeoutMs,
      "OpenClaw chat request timed out.",
    );
    if (!chatResponse.ok) {
      throw new RuntimeChatHttpError(
        502,
        resolveOpenClawResponseMessage(chatResponse, "OpenClaw chat request failed."),
        toRecord(chatResponse.payload) ?? toRecord(chatResponse.error),
      );
    }
    input.trace.record("gateway_event", "OpenClaw chat request accepted.", {
      gatewayUrl,
      event: "chat.send.accepted"
    });

    const runId = pickString(toRecord(chatResponse.payload)?.runId);
    if (!runId) {
      throw new Error("OpenClaw chat response did not include a runId.");
    }

    const terminalEvent = await socket.waitFor(
      (frame): frame is OpenClawEventFrame =>
        frame.type === "event" &&
        frame.event === "chat" &&
        matchesOpenClawTerminalChatPayload(frame.payload, runId),
      input.config.runtimeHttpTimeoutMs,
      "OpenClaw chat did not finish before the timeout.",
    );

    const terminalPayload = toRecord(terminalEvent.payload) as OpenClawTerminalChatPayload | null;
    if (!terminalPayload) {
      throw new Error("OpenClaw chat event payload was empty.");
    }
    const sanitizedTerminalPayload = sanitizeApiPayload(toRecord(terminalEvent.payload));
    input.trace.record("gateway_event", "OpenClaw terminal chat event received.", {
      gatewayUrl,
      event: "chat",
      state: terminalPayload.state,
      runId
    });
    input.trace.record("response_received", "Received OpenClaw terminal chat payload.", {
      statusCode: 200,
      response: summarizeResponsePayload(sanitizedTerminalPayload)
    });

    if (terminalPayload.state === "error") {
      throw new RuntimeChatHttpError(
        502,
        pickString(terminalPayload.errorMessage) || "OpenClaw chat request failed.",
        toRecord(terminalEvent.payload),
      );
    }

    if (terminalPayload.state !== "final") {
      throw new Error(`Unexpected OpenClaw chat terminal state: ${String(terminalPayload.state)}`);
    }

    return {
      resolvedBaseUrl: runtimeBaseUrl,
      raw: toRecord(terminalEvent.payload),
      statusCode: 200,
      assistantText: extractOpenClawAssistantText(terminalPayload.message),
    };
  } finally {
    socket.close();
  }
}

function createRuntimeChatTraceRecorder(input: {
  deps: Pick<
    RuntimeRouteDeps,
    "createRuntimeTraceRun" | "updateRuntimeTraceRun" | "appendRuntimeTraceEvent"
  >;
  runtimeInstance: RuntimeInstance;
  requestId?: string;
  userMessageId?: string;
  startedAtMs: number;
}): RuntimeChatTraceRecorder {
  const transport = getRuntimeConnector(input.runtimeInstance.runtimeType)
    .chatTransport as RuntimeTraceTransport;
  const startedAt = new Date(input.startedAtMs).toISOString();
  const run = input.deps.createRuntimeTraceRun({
    requestId: input.requestId,
    tenantId: input.runtimeInstance.tenantId,
    agentId: input.runtimeInstance.agentId,
    instanceId: input.runtimeInstance.id,
    runtimeType: input.runtimeInstance.runtimeType,
    transport,
    model: input.runtimeInstance.llmModel,
    status: "started",
    startedAt,
    userMessageId: input.userMessageId,
    toolCallCount: 0
  });

  return {
    runId: run.id,
    startedAtMs: input.startedAtMs,
    record(kind, summary, data, createdAt) {
      input.deps.appendRuntimeTraceEvent({
        runId: run.id,
        kind,
        createdAt,
        summary,
        data: data ? sanitizeApiPayload(data) : undefined
      });
      input.deps.updateRuntimeTraceRun(run.id, {
        lastEventKind: kind
      });
    },
    updateRun(patch) {
      input.deps.updateRuntimeTraceRun(run.id, sanitizeApiPayload(patch));
    },
    succeed(patch = {}) {
      input.deps.updateRuntimeTraceRun(run.id, sanitizeApiPayload({
        ...patch,
        status: "succeeded"
      }));
    },
    fail(patch = {}) {
      input.deps.updateRuntimeTraceRun(run.id, sanitizeApiPayload({
        ...patch,
        status: "failed"
      }));
    }
  };
}

function buildRuntimeChatRequestBody(runtimeInstance: RuntimeInstance, message: string): Record<string, unknown> {
  const connector = getRuntimeConnector(runtimeInstance.runtimeType);
  if (connector.chatTransport === "openai-chat-completions") {
    return {
      model: runtimeInstance.llmModel,
      stream: false,
      messages: [
        {
          role: "user",
          content: message
        }
      ]
    };
  }

  return { message };
}

async function waitForRuntimeHealthReady(input: {
  config: RuntimeRouteDeps["config"];
  runtimeInstance: RuntimeInstance;
  runtimeProvider: RuntimeRouteDeps["runtimeProvider"];
}): Promise<void> {
  const healthPath = getRuntimeConnector(input.runtimeInstance.runtimeType).healthPath;
  if (!healthPath) {
    return;
  }

  const runtimeBaseUrl = await resolveRuntimeHttpBaseUrl({
    runtimeInstance: input.runtimeInstance,
    runtimeProvider: input.runtimeProvider
  });
  if (!runtimeBaseUrl) {
    return;
  }

  const deadline = hasTimeout(input.config.runtimeHttpTimeoutMs)
    ? Date.now() + input.config.runtimeHttpTimeoutMs
    : Number.POSITIVE_INFINITY;
  while (Date.now() < deadline) {
    try {
      const remainingMs = Number.isFinite(deadline)
        ? Math.max(250, Math.min(1_000, deadline - Date.now()))
        : 1_000;
      const response = await fetch(`${runtimeBaseUrl}${healthPath}`, {
        signal: AbortSignal.timeout(remainingMs)
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore transient startup failures while the runtime restarts.
    }

    const delayMs = Number.isFinite(deadline)
      ? Math.min(250, Math.max(50, deadline - Date.now()))
      : 250;
    if (delayMs <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

function resolveRuntimeGatewayUrl(runtimeBaseUrl: string): string {
  const url = new URL(runtimeBaseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function resolveRuntimeChatErrorMessage(
  payload: Record<string, unknown> | null,
  statusCode: number,
): string {
  const message = pickString(payload?.message) ?? pickString(payload?.error);
  return message || `Runtime chat request failed (status=${statusCode}).`;
}

function resolveOpenClawResponseMessage(
  response: OpenClawResponseFrame,
  fallback: string,
): string {
  return (
    pickString(response.error?.message) ??
    pickString(toRecord(response.payload)?.message) ??
    pickString(toRecord(response.payload)?.summary) ??
    fallback
  );
}

function buildAssistantPreview(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

function summarizeResponsePayload(
  payload: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!payload) {
    return undefined;
  }

  return sanitizeApiPayload({
    keys: Object.keys(payload),
    usage: extractRuntimeTraceUsage(payload),
    finishReason: extractRuntimeTraceFinishReason(payload),
    assistantPreview: buildAssistantPreview(
      extractRuntimeTraceAssistantPreview(payload) ?? JSON.stringify(payload, null, 2)
    ),
    toolCallCount: extractObservedToolCalls(payload).length
  });
}

function extractRuntimeTraceAssistantPreview(
  payload: Record<string, unknown> | null
): string | undefined {
  if (!payload) {
    return undefined;
  }
  return normalizeOpenAiChatAssistantText(payload) || normalizeRuntimeChatAssistantText(payload);
}

function extractRuntimeTraceUsage(
  payload: Record<string, unknown> | null
): RuntimeChatAdapterResponse["usage"] | undefined {
  const usage = toRecord(payload?.usage);
  if (!usage) {
    return undefined;
  }

  const inputTokens = pickFiniteNumber(usage.prompt_tokens) ?? pickFiniteNumber(usage.input_tokens);
  const outputTokens =
    pickFiniteNumber(usage.completion_tokens) ?? pickFiniteNumber(usage.output_tokens);
  const totalTokens = pickFiniteNumber(usage.total_tokens) ?? sumFiniteNumbers(inputTokens, outputTokens);

  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined;
  }

  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens })
  };
}

function extractRuntimeTraceFinishReason(payload: Record<string, unknown> | null): string | undefined {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  for (const choice of choices) {
    const finishReason = pickString(toRecord(choice)?.finish_reason);
    if (finishReason) {
      return finishReason;
    }
  }

  return pickString(payload?.finish_reason);
}

function extractObservedToolCalls(payload: Record<string, unknown> | null): RuntimeObservedToolCall[] {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  const observed: RuntimeObservedToolCall[] = [];

  for (const choice of choices) {
    const message = toRecord(toRecord(choice)?.message);
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    for (const toolCall of toolCalls) {
      const record = toRecord(toolCall);
      const functionRecord = toRecord(record?.function);
      observed.push({
        id: pickString(record?.id),
        type: pickString(record?.type),
        name: pickString(functionRecord?.name),
        argumentsPreview: buildArgumentsPreview(functionRecord?.arguments)
      });
    }
  }

  return observed;
}

function buildArgumentsPreview(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return buildAssistantPreview(redactSensitiveText(value.trim()), 220);
  }
  if (!value) {
    return undefined;
  }

  try {
    return buildAssistantPreview(redactSensitiveText(JSON.stringify(value)), 220);
  } catch {
    return undefined;
  }
}

function normalizeRuntimeChatAssistantText(payload: Record<string, unknown> | null): string {
  const direct =
    pickString(payload?.message) ??
    pickString(payload?.reply) ??
    pickString(payload?.text) ??
    pickString(payload?.content) ??
    pickString(payload?.response);
  if (direct) {
    return direct;
  }

  const nested =
    pickNestedString(payload?.data) ??
    pickNestedString(payload?.result) ??
    pickNestedString(payload?.assistant);
  if (nested) {
    return nested;
  }

  if (payload && Object.keys(payload).length > 0) {
    return JSON.stringify(payload, null, 2);
  }

  return "Runtime completed without a text response.";
}

function normalizeOpenAiChatAssistantText(payload: Record<string, unknown> | null): string {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  for (const choice of choices) {
    const message = toRecord(choice)?.message;
    const direct = pickString(toRecord(message)?.content);
    if (direct) {
      return direct;
    }
  }

  return normalizeRuntimeChatAssistantText(payload);
}

function extractOpenClawAssistantText(message: unknown): string {
  const record = toRecord(message);
  const direct = pickString(record?.text) ?? extractTextContent(record?.content);
  if (direct) {
    return direct;
  }
  if (record && Object.keys(record).length > 0) {
    return JSON.stringify(record, null, 2);
  }
  return "Runtime completed without a text response.";
}

function extractTextContent(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parts = value
    .map((entry) => {
      const record = toRecord(entry);
      return pickString(record?.text) ?? pickString(record?.content);
    })
    .filter((entry): entry is string => Boolean(entry));

  return parts.length > 0 ? parts.join("\n") : undefined;
}

function pickNestedString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => pickNestedString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length > 0 ? parts.join("\n") : undefined;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return (
    pickString(record.message) ??
    pickString(record.text) ??
    pickString(record.content) ??
    pickString(record.response)
  );
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pickFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sumFiniteNumbers(left?: number, right?: number): number | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }
  return (left ?? 0) + (right ?? 0);
}

function supportsManagedRuntimeChatToken(runtimeType: RuntimeType): boolean {
  return (
    runtimeType === "openclaw" ||
    runtimeType === "zeroclaw" ||
    runtimeType === "hermes"
  );
}

function buildTraceRequestBodySummary(body: Record<string, unknown>): Record<string, unknown> {
  return {
    model: pickString(body.model),
    stream: typeof body.stream === "boolean" ? body.stream : undefined,
    messageCount: Array.isArray(body.messages) ? body.messages.length : undefined,
    userMessageLength: getChatBodyUserMessageLength(body),
    hasPlainMessage: typeof body.message === "string",
    plainMessageLength: pickString(body.message)?.length
  };
}

function getChatBodyUserMessageLength(body: Record<string, unknown>): number | undefined {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const userMessage = messages.find((entry) => toRecord(entry)?.role === "user");
  return pickString(toRecord(userMessage)?.content)?.length;
}

function buildRuntimeAwareMessage(runtimeInstance: RuntimeInstance, userMessage: string): string {
  const slackConfigured = Boolean(
    runtimeInstance.slackEnabled && runtimeInstance.slackBotToken && runtimeInstance.slackAppToken
  );

  const contextLines = [
    "<atoll_runtime_context>",
    `runtime_type=${runtimeInstance.runtimeType}`,
    `llm_provider=${runtimeInstance.llmProvider}`,
    `llm_model=${runtimeInstance.llmModel}`,
    `telegram_enabled=${runtimeInstance.telegramEnabled}`,
    `slack_enabled=${runtimeInstance.slackEnabled}`,
    `slack_configured=${slackConfigured}`,
    "slack_transport=native_socket",
    "slack_native_runtime_channel_expected=true",
    "slack_source_of_truth=workspace/ATOLL_INTEGRATIONS.json",
    "</atoll_runtime_context>"
  ];

  return `${contextLines.join("\n")}\n\n${userMessage}`;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function isOpenClawHelloPayload(value: unknown): boolean {
  return pickString(toRecord(value)?.type) === "hello-ok";
}

function matchesOpenClawTerminalChatPayload(value: unknown, runId: string): boolean {
  const payload = toRecord(value) as OpenClawTerminalChatPayload | null;
  if (!payload) {
    return false;
  }
  const payloadRunId = pickString(payload.runId);
  const state = pickString(payload.state);
  return payloadRunId === runId && (state === "final" || state === "error");
}

async function openGatewaySocket(url: string, timeoutMs: number): Promise<BufferedJsonSocket> {
  return await new Promise<BufferedJsonSocket>((resolve, reject) => {
    const RuntimeWebSocket = resolveRuntimeWebSocketCtor();
    const socket = new RuntimeWebSocket(url);
    let settled = false;

    const timer = hasTimeout(timeoutMs)
      ? setTimeout(() => {
          cleanup();
          try {
            socket.close();
          } catch {
            // Ignore close failures during timeout cleanup.
          }
          reject(new Error(`Timed out opening OpenClaw gateway socket: ${url}`));
        }, timeoutMs)
      : undefined;

    const handleOpen = () => {
      cleanup();
      settled = true;
      resolve(new BufferedJsonSocket(socket));
    };

    const handleError = () => {
      cleanup();
      if (!settled) {
        reject(new Error(`Failed to open OpenClaw gateway socket: ${url}`));
      }
    };

    const handleClose = () => {
      cleanup();
      if (!settled) {
        reject(new Error(`OpenClaw gateway socket closed before ready: ${url}`));
      }
    };

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
      }
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("error", handleError);
      socket.removeEventListener("close", handleClose);
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("error", handleError);
    socket.addEventListener("close", handleClose);
  });
}

async function openGatewaySocketWithRetry(
  url: string,
  timeoutMs: number,
  attempts: number
): Promise<BufferedJsonSocket> {
  const totalAttempts = Math.max(1, attempts);
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      return await openGatewaySocket(url, timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isFinalAttempt = attempt >= totalAttempts;
      if (isFinalAttempt) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, OPENCLAW_GATEWAY_RETRY_DELAY_MS));
    }
  }

  throw new RuntimeChatHttpError(
    503,
    "OpenClaw gateway is not reachable yet. Start or repair the helper runtime, then try again.",
    {
      gatewayUrl: url,
      ...(lastError?.message ? { detail: lastError.message } : {}),
    }
  );
}

class BufferedJsonSocket {
  private socket: WebSocket;
  private frames: OpenClawFrame[] = [];
  private waiters = new Set<{
    predicate: (frame: OpenClawFrame) => boolean;
    resolve: (frame: OpenClawFrame) => void;
    reject: (error: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
  }>();
  private terminalError?: Error;
  private handleMessageBound: (event: MessageEvent) => void;
  private handleErrorBound: () => void;
  private handleCloseBound: (event: Event) => void;

  constructor(socket: WebSocket) {
    this.socket = socket;
    this.handleMessageBound = (event) => this.handleMessage(event);
    this.handleErrorBound = () => {
      this.failPending(new Error("OpenClaw gateway socket error."));
    };
    this.handleCloseBound = (event) => {
      const details = event as Event & { code?: number; reason?: string };
      const code = typeof details.code === "number" ? details.code : undefined;
      const reason = pickString(details.reason);
      const suffix = code ? ` (code=${code}${reason ? `, reason=${reason}` : ""})` : "";
      this.failPending(new Error(`OpenClaw gateway socket closed unexpectedly${suffix}.`));
    };

    this.socket.addEventListener("message", this.handleMessageBound);
    this.socket.addEventListener("error", this.handleErrorBound);
    this.socket.addEventListener("close", this.handleCloseBound);
  }

  send(frame: OpenClawRequestFrame): void {
    this.socket.send(JSON.stringify(frame));
  }

  async waitFor<TFrame extends OpenClawFrame>(
    predicate: (frame: OpenClawFrame) => frame is TFrame,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<TFrame>;
  async waitFor(
    predicate: (frame: OpenClawFrame) => boolean,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<OpenClawFrame>;
  async waitFor(
    predicate: (frame: OpenClawFrame) => boolean,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<OpenClawFrame> {
    const bufferedIndex = this.frames.findIndex((frame) => predicate(frame));
    if (bufferedIndex >= 0) {
      const [frame] = this.frames.splice(bufferedIndex, 1);
      if (frame) {
        return frame;
      }
    }
    if (this.terminalError) {
      throw this.terminalError;
    }

    return await new Promise<OpenClawFrame>((resolve, reject) => {
      const waiter = {
        predicate,
        resolve: (frame: OpenClawFrame) => {
          if (waiter.timer) {
            clearTimeout(waiter.timer);
          }
          this.waiters.delete(waiter);
          resolve(frame);
        },
        reject: (error: Error) => {
          if (waiter.timer) {
            clearTimeout(waiter.timer);
          }
          this.waiters.delete(waiter);
          reject(error);
        },
        timer: undefined as ReturnType<typeof setTimeout> | undefined,
      };

      if (hasTimeout(timeoutMs)) {
        waiter.timer = setTimeout(() => {
          this.waiters.delete(waiter);
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }
      this.waiters.add(waiter);
    });
  }

  close(): void {
    this.socket.removeEventListener("message", this.handleMessageBound);
    this.socket.removeEventListener("error", this.handleErrorBound);
    this.socket.removeEventListener("close", this.handleCloseBound);
    this.failPending(new Error("OpenClaw gateway socket closed."));
    try {
      this.socket.close();
    } catch {
      // Ignore close failures during cleanup.
    }
  }

  private handleMessage(event: MessageEvent): void {
    const frame = parseOpenClawFrame(event.data);
    if (!frame) {
      return;
    }

    for (const waiter of this.waiters) {
      if (waiter.predicate(frame)) {
        waiter.resolve(frame);
        return;
      }
    }

    this.frames.push(frame);
  }

  private failPending(error: Error): void {
    if (!this.terminalError) {
      this.terminalError = error;
    }
    for (const waiter of [...this.waiters]) {
      waiter.reject(this.terminalError);
    }
  }
}

function parseOpenClawFrame(value: unknown): OpenClawFrame | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value) as { type?: unknown };
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    if (parsed.type === "res") {
      return parsed as OpenClawResponseFrame;
    }
    if (parsed.type === "event") {
      return parsed as OpenClawEventFrame;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

class RuntimeChatHttpError extends Error {
  statusCode: number;
  raw?: Record<string, unknown> | null;

  constructor(statusCode: number, message: string, raw?: Record<string, unknown> | null) {
    super(message);
    this.name = "RuntimeChatHttpError";
    this.statusCode = statusCode;
    this.raw = raw;
  }
}
