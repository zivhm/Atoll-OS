import type { FastifyInstance, FastifyRequest } from "fastify";

import {
  buildAgentSkillCatalog,
  buildInstalledSkillsFromRefs,
  discoverExternalSkillPresets,
  enrichAgentSkillCatalogItems,
  type AgentSkillCatalogItem
} from "../../agent-skills.js";
import type { AgentPresetCatalogItem } from "../../agent-presets.js";
import { listAgentTypes } from "../../agent-types.js";
import {
  buildAgentPresetExportSnapshot,
  toAgentPresetMetadata
} from "../../agent-presets.js";
import {
  parseAgentParams,
  parseAgentPresetArchiveInput,
  parseAgentPresetImportInput,
  parseAgentPresetInput,
  parseAgentPresetParams,
  parseAgentPresetReorderInput,
  parseCreateAgentInput,
  parseCreateTenantInput,
  parseUpdateAgentInput
} from "../../parsers.js";
import type { RuntimeProvider } from "../../runtime-provider.js";
import { resolveRuntimeWorkspaceProfile } from "../../runtime-workspace-profile.js";
import type { Agent, Store } from "../../store.js";

type AuthContext = {
  sub: string;
  orgId: string;
};

export function registerTenantAgentRoutes(
  app: FastifyInstance,
  deps: {
    store: Store;
    getAuthContextOrThrow: (request: FastifyRequest) => AuthContext;
    runtimeProvider?: RuntimeProvider;
    discoverSkillPresets?: (input: {
      currentPresetId?: string;
      currentPresetCategory?: string;
    }) => Promise<AgentPresetCatalogItem[]>;
    enrichSkillCatalogItems?: (
      items: AgentSkillCatalogItem[]
    ) => Promise<AgentSkillCatalogItem[]>;
  }
): void {
  const {
    store,
    getAuthContextOrThrow,
    runtimeProvider,
    discoverSkillPresets,
    enrichSkillCatalogItems
  } = deps;

  app.get("/api/agent-types", async () => {
    return {
      items: listAgentTypes()
    };
  });

  app.get("/api/agent-presets", async () => {
    return {
      items: store.listAgentPresets({ activeOnly: true }).map(toAgentPresetMetadata)
    };
  });

  app.get("/api/admin/agent-presets", async () => {
    return {
      items: store.listAgentPresets()
    };
  });

  app.get("/api/admin/agent-presets/export", async () => {
    return buildAgentPresetExportSnapshot(store.listAgentPresets());
  });

  app.post("/api/admin/agent-presets", async (request, reply) => {
    const input = parseAgentPresetInput(request.body);
    const preset = store.createAgentPreset({
      id: input.id ?? "",
      name: input.name ?? "",
      description: input.description ?? "",
      color: input.color ?? "neutral",
      category: input.category ?? "general",
      sourceRepoUrl: input.sourceRepoUrl,
      sourcePath: input.sourcePath,
      summary: input.summary ?? "",
      suggestedRoleTitle: input.suggestedRoleTitle ?? "",
      recommendedSkills: input.recommendedSkills ?? [],
      identity: input.identity ?? "",
      soul: input.soul ?? "",
      tools: input.tools ?? "",
      active: input.active ?? true,
      position: input.position
    });
    return reply.status(201).send(preset);
  });

  app.post("/api/admin/agent-presets/import", async (request) => {
    const input = parseAgentPresetImportInput(request.body);
    const current = store.listAgentPresets();
    const imported = input.replaceExisting
      ? store.replaceAgentPresets(input.items)
      : store.replaceAgentPresets(mergeAgentPresetImports(current, input.items));

    return {
      summary: {
        imported: imported.length,
        replaceExisting: input.replaceExisting
      },
      items: imported
    };
  });

  app.post("/api/admin/agent-presets/reorder", async (request) => {
    const input = parseAgentPresetReorderInput(request.body);
    return {
      items: store.reorderAgentPresets(input.presetIds)
    };
  });

  app.post("/api/admin/agent-presets/:presetId", async (request, reply) => {
    const params = parseAgentPresetParams(request.params);
    const input = parseAgentPresetInput(request.body, { partial: true });
    const updated = store.updateAgentPreset(params.presetId, {
      name: input.name,
      description: input.description,
      color: input.color,
      category: input.category,
      sourceRepoUrl: input.sourceRepoUrl,
      sourcePath: input.sourcePath,
      summary: input.summary,
      suggestedRoleTitle: input.suggestedRoleTitle,
      recommendedSkills: input.recommendedSkills,
      identity: input.identity,
      soul: input.soul,
      tools: input.tools,
      active: input.active,
      position: input.position
    });

    if (!updated) {
      return reply.status(404).send({
        message: `Preset ${params.presetId} not found`
      });
    }

    return updated;
  });

  app.post("/api/admin/agent-presets/:presetId/archive", async (request, reply) => {
    const params = parseAgentPresetParams(request.params);
    const input = parseAgentPresetArchiveInput(request.body);
    const updated = store.updateAgentPreset(params.presetId, {
      active: !input.archived
    });

    if (!updated) {
      return reply.status(404).send({
        message: `Preset ${params.presetId} not found`
      });
    }

    return updated;
  });

  app.get("/api/tenants", async (request) => {
    const auth = getAuthContextOrThrow(request);
    store.ensureDefaultTenant(auth.orgId);
    return {
      items: store.listTenants(auth.orgId)
    };
  });

  app.post("/api/tenants", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const input = parseCreateTenantInput(request.body);
    if (input.kind !== "dedicated") {
      const existing = store.getDefaultTenantByIdentityOrgId(auth.orgId);
      if (existing) {
        return reply.status(200).send(existing);
      }
      const tenant = store.ensureDefaultTenant(auth.orgId);
      return reply.status(201).send(tenant);
    }

    const tenant = store.createTenant({
      ...input,
      identityOrgId: auth.orgId
    });
    return reply.status(201).send(tenant);
  });

  app.get("/api/agents", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const query = request.query as { tenantId?: string };
    if (query.tenantId) {
      const tenant = store.getTenant(query.tenantId);
      if (!tenant || tenant.identityOrgId !== auth.orgId) {
        return reply.status(404).send({
          message: `Tenant ${query.tenantId} not found`
        });
      }
    }

    const tenantIds = new Set(store.listTenants(auth.orgId).map((tenant) => tenant.id));
    return {
      items: store
        .listAgents(query.tenantId)
        .filter((agent) => tenantIds.has(agent.tenantId))
        .map(toPublicAgent)
    };
  });

  app.post("/api/agents", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const input = parseCreateAgentInput(request.body);
    const tenant = store.getTenant(input.tenantId);
    if (!tenant || tenant.identityOrgId !== auth.orgId) {
      return reply.status(404).send({
        message: `Tenant ${input.tenantId} not found`
      });
    }

    const preset = input.presetId ? store.getAgentPreset(input.presetId) : undefined;
    if (input.presetId && !preset) {
      return reply.status(400).send({
        message: `Validation failed: presetId '${input.presetId}' is not supported`
      });
    }

    const agent = store.createAgent({
      ...input,
      installedSkills:
        input.installedSkills ?? buildInstalledSkillsFromRefs(preset?.recommendedSkills, "preset"),
      presetId: preset?.id,
      presetName: preset?.name,
      presetSourcePath: preset?.sourcePath,
      presetSummary: preset?.summary,
      presetIdentityMarkdown: preset?.identity,
      presetSoulMarkdown: preset?.soul,
      presetToolsMarkdown: preset?.tools,
      presetSoulTemplateMarkdown: undefined
    });
    return reply.status(201).send(toPublicAgent(agent));
  });

  app.get("/api/agents/:agentId/skills/catalog", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const params = parseAgentParams(request.params);
    const agent = store.getAgent(params.agentId);
    if (!agent) {
      return reply.status(404).send({
        message: `Agent ${params.agentId} not found`
      });
    }

    const tenant = store.getTenant(agent.tenantId);
    if (!tenant || tenant.identityOrgId !== auth.orgId) {
      return reply.status(404).send({
        message: `Agent ${params.agentId} not found`
      });
    }

    const basePresets = store.listAgentPresets({ activeOnly: true });
    const currentPreset = agent.presetId ? store.getAgentPreset(agent.presetId) : undefined;
    const discoverPresets =
      discoverSkillPresets ??
      ((input: { currentPresetId?: string; currentPresetCategory?: string }) =>
        discoverExternalSkillPresets({
          currentPresetId: input.currentPresetId,
          currentPresetCategory: input.currentPresetCategory
        }));

    let extraPresets: AgentPresetCatalogItem[] = [];
    try {
      extraPresets = await discoverPresets({
        currentPresetId: agent.presetId,
        currentPresetCategory: currentPreset?.category
      });
    } catch {
      extraPresets = [];
    }

    const localCatalogItems = buildAgentSkillCatalog({
      presets: [...basePresets, ...extraPresets],
      installedSkills: agent.installedSkills,
      enabledSkills: agent.skills,
      currentPresetId: agent.presetId
    });

    const remoteEnricher =
      enrichSkillCatalogItems ??
      ((items: AgentSkillCatalogItem[]) =>
        enrichAgentSkillCatalogItems({
          items
        }));

    let catalogItems = localCatalogItems;
    try {
      catalogItems = await remoteEnricher(localCatalogItems);
    } catch {
      catalogItems = localCatalogItems;
    }

    return {
      items: catalogItems
    };
  });

  app.post("/api/agents/:agentId", async (request, reply) => {
    const auth = getAuthContextOrThrow(request);
    const params = parseAgentParams(request.params);
    const input = parseUpdateAgentInput(request.body);
    const agent = store.getAgent(params.agentId);
    if (!agent) {
      return reply.status(404).send({
        message: `Agent ${params.agentId} not found`
      });
    }

    const tenant = store.getTenant(agent.tenantId);
    if (!tenant || tenant.identityOrgId !== auth.orgId) {
      return reply.status(404).send({
        message: `Agent ${params.agentId} not found`
      });
    }

    const updated = store.updateAgent(params.agentId, input);
    const publicAgent = toPublicAgent(updated ?? agent);
    const requestedSkillStateChange =
      input.skills !== undefined || input.installedSkills !== undefined;
    let workspaceSync:
      | {
          status: "unchanged" | "synced" | "deferred";
          message: string;
        }
      | undefined;

    if (requestedSkillStateChange) {
      const runtimeInstance = store.getRuntimeInstanceForAgent(publicAgent.id);
      if (runtimeInstance && runtimeProvider?.syncRuntimeSkillArtifacts) {
        await runtimeProvider.syncRuntimeSkillArtifacts({
          runtimeType: runtimeInstance.runtimeType,
          volumeName: runtimeInstance.volumeName,
          workspaceProfile: resolveRuntimeWorkspaceProfile(store, runtimeInstance)
        });
        workspaceSync = {
          status: "synced",
          message: "Workspace skill artifacts were updated for the active runtime."
        };
      } else {
        workspaceSync = {
          status: "deferred",
          message: "No runtime exists yet. Skill artifacts will materialize during the next provision."
        };
      }
    } else {
      workspaceSync = {
        status: "unchanged",
        message: "No skill lifecycle changes were requested."
      };
    }

    return {
      agent: publicAgent,
      workspaceSync
    };
  });
}

function toPublicAgent(
  agent: Agent
) : Omit<
  Agent,
  "presetIdentityMarkdown" | "presetSoulMarkdown" | "presetToolsMarkdown" | "presetSoulTemplateMarkdown"
> {
  const {
    presetIdentityMarkdown: _presetIdentityMarkdown,
    presetSoulMarkdown: _presetSoulMarkdown,
    presetToolsMarkdown: _presetToolsMarkdown,
    presetSoulTemplateMarkdown: _presetSoulTemplateMarkdown,
    ...publicAgent
  } = agent;
  return publicAgent;
}

function mergeAgentPresetImports(
  current: ReturnType<Store["listAgentPresets"]>,
  incoming: Array<
    ReturnType<typeof parseAgentPresetImportInput>["items"][number]
  >
) {
  const merged = new Map(current.map((preset) => [preset.id, preset]));
  incoming.forEach((item, index) => {
    const existing = merged.get(item.id);
    merged.set(item.id, {
      ...existing,
      ...item,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      position: item.position ?? index
    });
  });
  return [...merged.values()];
}
