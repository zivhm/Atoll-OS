import type { ProvisionJob, RuntimeInstance } from "./store.js";
import type { RuntimeProvider } from "./runtime-provider.js";

export type RuntimeReconcileAction = {
  instanceId: string;
  tenantId: string;
  containerName: string;
  statusBefore: RuntimeInstance["status"];
  statusAfter: RuntimeInstance["status"];
  changed: boolean;
  reason: string;
  containerRunning: boolean | null;
  provisioningStale: boolean;
  error?: string;
};

export type RuntimeReconcileOutcome = {
  summary: {
    checked: number;
    updated: number;
    unchanged: number;
    errors: number;
  };
  actions: RuntimeReconcileAction[];
};

type RuntimeReconcileSource = "manual" | "interval";

type RuntimeReconcileDeps = {
  runtimeProvider: RuntimeProvider;
  resolveRuntimeImage: (instance: RuntimeInstance) => string;
  runtimeNetwork: string;
  runtimeProvisioningStaleMs: number;
  runtimeReconcileIntervalMs: number;
  listRuntimeInstances: () => RuntimeInstance[];
  getProvisionJob: (jobId: string) => ProvisionJob | undefined;
  updateProvisionJob: (
    jobId: string,
    patch: Partial<Pick<ProvisionJob, "status" | "error">>
  ) => ProvisionJob;
  updateInstance: (
    instanceId: string,
    patch: Partial<Pick<RuntimeInstance, "status" | "lastError">>
  ) => RuntimeInstance;
  logger: {
    debug: (context: Record<string, unknown>, message: string) => void;
    info: (context: Record<string, unknown>, message: string) => void;
    warn: (context: Record<string, unknown>, message: string) => void;
    error: (context: Record<string, unknown>, message: string) => void;
  };
};

export function createRuntimeReconcileService(deps: RuntimeReconcileDeps) {
  let reconcileIntervalHandle: NodeJS.Timeout | undefined;

  return {
    startLoop,
    stopLoop,
    reconcileInstances
  };

  function startLoop(): void {
    if (deps.runtimeReconcileIntervalMs <= 0) {
      return;
    }

    reconcileIntervalHandle = setInterval(() => {
      void runBackgroundReconcile();
    }, deps.runtimeReconcileIntervalMs);
    reconcileIntervalHandle.unref?.();
  }

  function stopLoop(): void {
    if (reconcileIntervalHandle) {
      clearInterval(reconcileIntervalHandle);
      reconcileIntervalHandle = undefined;
    }
  }

  async function runBackgroundReconcile(): Promise<void> {
    try {
      const instances = deps.listRuntimeInstances();
      if (instances.length === 0) {
        return;
      }

      const outcome = await reconcileInstances({
        instances,
        dryRun: false,
        source: "interval"
      });
      const context = {
        checked: outcome.summary.checked,
        updated: outcome.summary.updated,
        unchanged: outcome.summary.unchanged,
        errors: outcome.summary.errors
      };
      if (outcome.summary.errors > 0) {
        deps.logger.warn(context, "Runtime reconcile interval completed with errors");
        return;
      }
      if (outcome.summary.updated > 0) {
        deps.logger.info(context, "Runtime reconcile interval applied state updates");
        return;
      }
      deps.logger.debug(context, "Runtime reconcile interval found no drift");
    } catch (error) {
      deps.logger.error(
        { error: normalizeErrorMessage(error) },
        "Runtime reconcile interval crashed"
      );
      return;
    }
  }

  async function reconcileInstances(input: {
    instances: RuntimeInstance[];
    dryRun: boolean;
    source: RuntimeReconcileSource;
  }): Promise<RuntimeReconcileOutcome> {
    const actions: RuntimeReconcileAction[] = [];
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    const nowMs = Date.now();

    for (const instance of input.instances) {
      let statusAfter = instance.status;
      let changed = false;
      let reason = "No drift detected";
      let errorMessage: string | undefined;
      let containerRunning: boolean | null = null;
      const provisioningStale = isProvisioningStale(
        instance,
        nowMs,
        deps.runtimeProvisioningStaleMs
      );

      if (provisioningStale) {
        statusAfter = "error";
        changed = true;
        reason =
          `Provisioning exceeded timeout (${formatDurationMs(deps.runtimeProvisioningStaleMs)}). ` +
          "Marking runtime as error for operator remediation.";

        if (!input.dryRun) {
          deps.updateInstance(instance.id, {
            status: "error",
            lastError: `Reconcile (${input.source}): ${reason}`
          });
          const staleJob = deps.getProvisionJob(instance.id);
          if (staleJob && (staleJob.status === "queued" || staleJob.status === "running")) {
            deps.updateProvisionJob(staleJob.id, {
              status: "failed",
              error: `[container] Reconcile (${input.source}): ${reason}`
            });
          }
        }
      } else {
        try {
          const diagnostics = await deps.runtimeProvider.getRuntimeEnvironmentDiagnostics({
            image: deps.resolveRuntimeImage(instance),
            network: deps.runtimeNetwork,
            containerName: instance.containerName
          });
          containerRunning = diagnostics.container?.running ?? false;

          if (instance.status === "running" && !containerRunning) {
            statusAfter = "error";
            changed = true;
            reason = "Container is missing or not running while Atoll state is running.";
          } else if (instance.status === "stopped" && containerRunning) {
            statusAfter = "running";
            changed = true;
            reason = "Container is running while Atoll state is stopped.";
          }

          if (changed && !input.dryRun) {
            if (statusAfter === "error") {
              deps.updateInstance(instance.id, {
                status: "error",
                lastError: `Reconcile (${input.source}): ${reason}`
              });
            } else {
              deps.updateInstance(instance.id, {
                status: "running",
                lastError: undefined
              });
            }
          }
        } catch (error) {
          errorMessage = normalizeErrorMessage(error);
          reason = `Reconcile diagnostics failed: ${errorMessage}`;
        }
      }

      if (errorMessage) {
        errors += 1;
        unchanged += 1;
      } else if (changed) {
        updated += 1;
      } else {
        unchanged += 1;
      }

      actions.push({
        instanceId: instance.id,
        tenantId: instance.tenantId,
        containerName: instance.containerName,
        statusBefore: instance.status,
        statusAfter,
        changed,
        reason,
        containerRunning,
        provisioningStale,
        error: errorMessage
      });
    }

    return {
      summary: {
        checked: input.instances.length,
        updated,
        unchanged,
        errors
      },
      actions
    };
  }
}

function isProvisioningStale(
  instance: RuntimeInstance,
  nowMs: number,
  runtimeProvisioningStaleMs: number
): boolean {
  if (instance.status !== "provisioning") {
    return false;
  }

  const reference = Date.parse(instance.updatedAt || instance.createdAt);
  if (!Number.isFinite(reference)) {
    return false;
  }
  return nowMs - reference >= runtimeProvisioningStaleMs;
}

function formatDurationMs(valueMs: number): string {
  const totalSeconds = Math.max(1, Math.floor(valueMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Unknown runtime error";
}
