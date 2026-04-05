export function hasTimeout(timeoutMs: number): boolean {
  return Number.isFinite(timeoutMs) && timeoutMs > 0;
}

export function resolveTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (!hasTimeout(timeoutMs)) {
    return undefined;
  }
  return AbortSignal.timeout(Math.floor(timeoutMs));
}
