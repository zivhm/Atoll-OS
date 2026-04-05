const REDACTED = "[redacted]";
const SENSITIVE_KEY_RE =
  /(?:^|[_-])(token|secret|api[_-]?key|authorization|cookie|password|webhook(?:_?url)?)(?:$|[_-])/i;

export function redactSensitiveText(input: string): string {
  return input
    .replace(
      /("?(?:token|secret|api[_-]?key|authorization|cookie|password|webhook(?:_?url)?)"?\s*:\s*")([^"]*)(")/giu,
      `$1${REDACTED}$3`
    )
    .replace(
      /((?:bearer\s+)|(?:token|secret|api[_-]?key|authorization|cookie|password|webhook(?:_?url)?)\s*[=:]\s*)([^\s,;]+)/giu,
      `$1${REDACTED}`
    );
}

export function sanitizeApiPayload<T>(
  value: T,
  options: {
    allowKeys?: string[];
  } = {}
): T {
  return sanitizeValue(value, new Set(options.allowKeys ?? [])) as T;
}

function sanitizeValue(value: unknown, allowedKeys: Set<string>): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, allowedKeys));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, entryValue]) => {
      if (!allowedKeys.has(key) && isSensitiveKey(key)) {
        return [key, REDACTED];
      }
      return [key, sanitizeValue(entryValue, allowedKeys)];
    })
  );
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key) || /bearerToken/i.test(key);
}
