import { BUSINESS_IDENTITY_PRESETS, type AgentPresetCategory } from "./business-identity-presets.js";
import { normalizeIdentityColorToken } from "./identity-colors.js";

export { type AgentPresetCategory } from "./business-identity-presets.js";

export type AgentPresetCatalogItem = {
  id: string;
  name: string;
  description: string;
  color: string;
  category: AgentPresetCategory;
  sourceRepoUrl?: string;
  sourcePath?: string;
  summary: string;
  suggestedRoleTitle: string;
  recommendedSkills: string[];
  identity: string;
  soul: string;
  tools: string;
  active: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type AgentPresetMetadata = Omit<
  AgentPresetCatalogItem,
  "identity" | "soul" | "tools" | "createdAt" | "updatedAt"
>;

export type AgentPresetExportSnapshot = {
  version: 1;
  exportedAt: string;
  items: Array<
    Omit<AgentPresetCatalogItem, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    }
  >;
};

export function buildInitialAgentPresetCatalog(now = new Date().toISOString()): AgentPresetCatalogItem[] {
  return BUSINESS_IDENTITY_PRESETS.map((preset, index) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    color: normalizeIdentityColorToken(preset.color),
    category: preset.category,
    sourceRepoUrl: preset.sourceRepoUrl,
    sourcePath: preset.sourcePath,
    summary: preset.summary,
    suggestedRoleTitle: preset.suggestedRoleTitle,
    recommendedSkills: [...preset.recommendedSkills],
    identity: preset.identity,
    soul: preset.soul,
    tools: preset.tools,
    active: true,
    position: index,
    createdAt: now,
    updatedAt: now
  }));
}

export function getAgentPresetById(presetId: string | undefined): AgentPresetCatalogItem | undefined {
  const normalized = presetId?.trim();
  if (!normalized) {
    return undefined;
  }

  return buildInitialAgentPresetCatalog().find((preset) => preset.id === normalized);
}

export function toAgentPresetMetadata(preset: AgentPresetCatalogItem): AgentPresetMetadata {
  const {
    identity: _identity,
    soul: _soul,
    tools: _tools,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...metadata
  } = preset;
  return metadata;
}

export function buildAgentPresetExportSnapshot(
  items: AgentPresetCatalogItem[],
  exportedAt = new Date().toISOString()
): AgentPresetExportSnapshot {
  return {
    version: 1,
    exportedAt,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      color: item.color,
      category: item.category,
      sourceRepoUrl: item.sourceRepoUrl,
      sourcePath: item.sourcePath,
      summary: item.summary,
      suggestedRoleTitle: item.suggestedRoleTitle,
      recommendedSkills: [...item.recommendedSkills],
      identity: item.identity,
      soul: item.soul,
      tools: item.tools,
      active: item.active,
      position: item.position
    }))
  };
}
