import {
  SHARED_WORKSPACE_MOUNT_PATH,
  type RuntimeSharedWorkspaceMount,
  type RuntimeWorkspaceProfile
} from "./runtime.js";
import { getAgentTypeById } from "./agent-types.js";
import type { Agent, RuntimeInstance, Tenant } from "./store.js";

type RuntimeWorkspaceStore = {
  getTenant: (tenantId: string) => Tenant | undefined;
  getAgent: (agentId: string) => Agent | undefined;
};

export function resolveRuntimeWorkspaceProfile(
  store: RuntimeWorkspaceStore,
  runtimeInstance: RuntimeInstance
): RuntimeWorkspaceProfile {
  const tenant = store.getTenant(runtimeInstance.tenantId);
  const agent = store.getAgent(runtimeInstance.agentId);
  const agentType = agent ? getAgentTypeById(agent.agentType) : undefined;

  return {
    workspaceName: tenant?.name?.trim() || "Workspace",
    workspaceKind: tenant?.kind,
    workspaceResourceMode: tenant?.resourceMode,
    helperName: agent?.name?.trim() || "Helper",
    helperStyle: agent?.roleTitle?.trim() || undefined,
    agentType: agentType?.id,
    agentTypeName: agentType?.name,
    skills: agent?.skills ?? [],
    installedSkills: agent?.installedSkills ?? [],
    sharedWorkspacePath:
      tenant?.resourceMode === "shared" && tenant.sharedVolumeName
        ? SHARED_WORKSPACE_MOUNT_PATH
        : undefined,
    presetId: agent?.presetId?.trim() || undefined,
    presetName: agent?.presetName?.trim() || undefined,
    presetSummary: agent?.presetSummary?.trim() || undefined,
    presetSourcePath: agent?.presetSourcePath?.trim() || undefined,
    presetIdentityMarkdown: agent?.presetIdentityMarkdown?.trim() || undefined,
    presetSoulMarkdown: agent?.presetSoulMarkdown?.trim() || undefined,
    presetToolsMarkdown: agent?.presetToolsMarkdown?.trim() || undefined,
    presetSoulTemplateMarkdown: agent?.presetSoulTemplateMarkdown?.trim() || undefined
  };
}

export function resolveRuntimeSharedWorkspaceMount(
  tenant?: Tenant
): RuntimeSharedWorkspaceMount | undefined {
  if (!tenant || tenant.resourceMode !== "shared" || !tenant.sharedVolumeName) {
    return undefined;
  }

  return {
    volumeName: tenant.sharedVolumeName,
    mountPath: SHARED_WORKSPACE_MOUNT_PATH
  };
}
