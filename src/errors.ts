import { redactSensitiveText } from "./response-sanitizer.js";

export type FailureClass = "env" | "container" | "provider" | "channel" | "unknown";

export type FailurePayload = {
  message: string;
  failureClass: FailureClass;
  failureHint: string;
};

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return redactSensitiveText(error.message);
  }
  return "Unknown runtime error";
}

export function buildFailurePayload(error: unknown, context: string): FailurePayload {
  const detail = normalizeErrorMessage(error);
  const failureClass = classifyFailureClass(detail);
  return {
    message: `${context}: ${detail}`,
    failureClass,
    failureHint: failureHintForClass(failureClass)
  };
}

export function formatFailureForJob(error: unknown, context: string): string {
  const failure = buildFailurePayload(error, context);
  return `[${failure.failureClass}] ${failure.message}`;
}

export function classifyFailureClass(message: string): FailureClass {
  const normalized = message.toLowerCase();

  if (/admin_api_key|orcas_secrets_key|runtime_.*required|environment|env\b|missing env/i.test(message)) {
    return "env";
  }

  if (
    /(docker|podman|container cli|container|network|volume|image|no such|cannot connect to the docker daemon)/i.test(
      message
    )
  ) {
    return "container";
  }

  if (/(llm|provider|model|api key|openrouter|anthropic)/i.test(message)) {
    return "provider";
  }

  if (/(telegram|channel|pairing|token|webhook)/i.test(message)) {
    return "channel";
  }

  if (normalized.includes("validation failed")) {
    return "unknown";
  }

  return "unknown";
}

export function failureHintForClass(failureClass: FailureClass): string {
  if (failureClass === "env") {
    return "Check required environment variables and runtime defaults in .env.";
  }
  if (failureClass === "container") {
    return "Check container CLI availability plus runtime image/network/container state.";
  }
  if (failureClass === "provider") {
    return "Check LLM provider/model/api key values.";
  }
  if (failureClass === "channel") {
    return "Check channel configuration (pairing/token/webhook/telegram settings).";
  }
  return "Check server logs for detailed diagnostics.";
}
