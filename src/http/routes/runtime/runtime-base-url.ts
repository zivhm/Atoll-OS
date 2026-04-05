import type { RuntimeProvider } from "../../../runtime-provider.js";
import type { RuntimeInstance } from "../../../store.js";

const IPV4_HOST_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/u;

export async function resolveRuntimeHttpBaseUrl(input: {
  runtimeInstance: RuntimeInstance;
  runtimeProvider: RuntimeProvider;
}): Promise<string | undefined> {
  const baseUrl = input.runtimeInstance.baseUrl?.trim();
  if (!baseUrl) {
    return undefined;
  }
  if (input.runtimeInstance.allowPublicBind) {
    return baseUrl;
  }

  const parsed = tryParseUrl(baseUrl);
  if (!parsed) {
    return baseUrl;
  }
  if (isHostDirectlyReachable(parsed.hostname)) {
    return baseUrl;
  }
  if (!input.runtimeProvider.listManagedRuntimeContainers) {
    return baseUrl;
  }

  try {
    const containers = await input.runtimeProvider.listManagedRuntimeContainers();
    const managedContainer = containers.find((container) => container.name === input.runtimeInstance.containerName);
    if (!managedContainer?.networkIps) {
      return baseUrl;
    }

    const preferredIp =
      managedContainer.networkIps[input.runtimeInstance.networkName] ??
      Object.values(managedContainer.networkIps).find((value) => Boolean(value?.trim()));
    if (!preferredIp) {
      return baseUrl;
    }

    parsed.hostname = preferredIp;
    return parsed.origin;
  } catch {
    return baseUrl;
  }
}

function tryParseUrl(baseUrl: string): URL | undefined {
  try {
    return new URL(baseUrl);
  } catch {
    return undefined;
  }
}

function isHostDirectlyReachable(host: string): boolean {
  const normalizedHost = host.trim().toLowerCase();
  if (!normalizedHost) {
    return false;
  }

  return normalizedHost === "127.0.0.1" || normalizedHost === "localhost" || IPV4_HOST_PATTERN.test(normalizedHost);
}
