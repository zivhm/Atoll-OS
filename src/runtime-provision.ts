import type { ProvisionJob, RuntimeInstance } from "./store.js";

type CreateProvisionJobInput = {
  tenantId: string;
  agentId: string;
  instanceId: string;
  requestId?: string;
  createdAt?: string;
};

type RuntimeProvisionDeps = {
  listProvisionJobs: () => ProvisionJob[];
  getProvisionJob: (jobId: string) => ProvisionJob | undefined;
  saveProvisionJob: (job: ProvisionJob) => ProvisionJob;
  listRuntimeInstances: () => RuntimeInstance[];
  formatJobError: (error: unknown, context: string) => string;
};

export function createRuntimeProvisionService(deps: RuntimeProvisionDeps) {
  const provisionQueue: string[] = [];
  const provisionWork = new Map<string, () => Promise<void>>();
  let isProvisionWorkerRunning = false;

  return {
    listJobs,
    getJob,
    createJob,
    updateJob,
    enqueueJob,
    requeueProvisioningInstancesOnStartup
  };

  function listJobs(): ProvisionJob[] {
    return deps.listProvisionJobs();
  }

  function getJob(jobId: string): ProvisionJob | undefined {
    return deps.getProvisionJob(jobId);
  }

  function createJob(input: CreateProvisionJobInput): ProvisionJob {
    const now = new Date().toISOString();
    const jobId = input.instanceId;

    const existing = deps.getProvisionJob(jobId);
    if (existing) {
      return existing;
    }

    const job: ProvisionJob = {
      id: jobId,
      tenantId: input.tenantId,
      agentId: input.agentId,
      instanceId: input.instanceId,
      requestId: input.requestId,
      status: "queued",
      createdAt: input.createdAt ?? now,
      updatedAt: now
    };

    return deps.saveProvisionJob(job);
  }

  function updateJob(
    jobId: string,
    patch: Partial<Pick<ProvisionJob, "status" | "error">>
  ): ProvisionJob {
    const current = deps.getProvisionJob(jobId);
    if (!current) {
      throw new Error(`Provision job ${jobId} not found`);
    }

    const updated: ProvisionJob = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    return deps.saveProvisionJob(updated);
  }

  function enqueueJob(jobId: string, work: () => Promise<void>): void {
    if (provisionWork.has(jobId)) {
      return;
    }

    provisionQueue.push(jobId);
    provisionWork.set(jobId, work);
    startProvisionWorker();
  }

  function requeueProvisioningInstancesOnStartup(
    runProvisionWork: (instanceId: string) => Promise<unknown>
  ): void {
    const provisioningInstances = deps
      .listRuntimeInstances()
      .filter((instance) => instance.status === "provisioning");

    provisioningInstances.forEach((instance) => {
      const job = createJob({
        tenantId: instance.tenantId,
        agentId: instance.agentId,
        instanceId: instance.id,
        createdAt: instance.createdAt
      });

      enqueueJob(job.id, async () => {
        await runProvisionWork(instance.id);
      });
    });
  }

  function startProvisionWorker(): void {
    if (isProvisionWorkerRunning) {
      return;
    }

    isProvisionWorkerRunning = true;

    void (async () => {
      while (provisionQueue.length > 0) {
        const jobId = provisionQueue.shift();
        if (!jobId) continue;

        const work = provisionWork.get(jobId);
        if (!work) continue;

        updateJob(jobId, {
          status: "running",
          error: undefined
        });

        try {
          await work();
          updateJob(jobId, {
            status: "succeeded",
            error: undefined
          });
        } catch (error) {
          updateJob(jobId, {
            status: "failed",
            error: deps.formatJobError(error, "Provision job failed")
          });
        } finally {
          provisionWork.delete(jobId);
        }
      }

      isProvisionWorkerRunning = false;

      if (provisionQueue.length > 0) {
        startProvisionWorker();
      }
    })();
  }
}
