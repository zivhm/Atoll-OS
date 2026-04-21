import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentSkillsSettingsPanel } from "@/components/AgentSkillsSettingsPanel";
import type { Agent, AgentInstalledSkill, AgentSkillCatalogItem } from "@/lib/api";

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn()
}));

vi.mock("sonner", () => ({
  toast: toastMocks
}));

function buildInstalledSkill(overrides: Partial<AgentInstalledSkill> = {}): AgentInstalledSkill {
  return {
    key: "brainstorming",
    ref: "https://skills.sh/obra/superpowers/brainstorming",
    label: "Brainstorming",
    sourceKind: "manual",
    installedAt: "2026-04-17T10:00:00.000Z",
    updatedAt: "2026-04-17T10:00:00.000Z",
    ...overrides
  };
}

function buildAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    tenantId: "tenant-1",
    name: "Nora",
    agentType: "general",
    skills: [],
    installedSkills: [],
    presetId: "project-manager",
    channel: "custom",
    status: "running",
    createdAt: "2026-04-17T10:00:00.000Z",
    ...overrides
  };
}

function buildCatalogItem(overrides: Partial<AgentSkillCatalogItem> = {}): AgentSkillCatalogItem {
  return {
    key: "writing-plans",
    ref: "https://skills.sh/obra/superpowers/writing-plans",
    label: "Writing Plans",
    installed: false,
    enabled: false,
    summary: "Produce structured implementation or execution plans.",
    provider: "obra/superpowers",
    sourceHost: "skills.sh",
    recommendedForCurrentPreset: true,
    originCategories: ["project-management"],
    metadataStatus: "local",
    sourcePresets: [
      {
        presetId: "project-manager",
        presetName: "Project Manager"
      }
    ],
    ...overrides
  };
}

describe("AgentSkillsSettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders installed and browse sections plus root explore sources only", () => {
    render(
      <AgentSkillsSettingsPanel
        agent={buildAgent({
          skills: ["brainstorming"],
          installedSkills: [buildInstalledSkill()]
        })}
        catalogItems={[buildCatalogItem()]}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Installed" })).toBeInTheDocument();
    expect(screen.getByText("Browse skills catalog")).toBeInTheDocument();
    expect(screen.getByText("Explore sources")).toBeInTheDocument();
    expect(screen.queryByText("Install from source")).not.toBeInTheDocument();
    expect(screen.getByTestId("installed-skill-brainstorming")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-skill-writing-plans")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-view-list")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-view-gallery")).toBeInTheDocument();
    expect(screen.getByTestId("explore-source-skills-sh")).toBeInTheDocument();
    expect(screen.getByTestId("explore-source-agentskills-co-il")).toBeInTheDocument();
    expect(screen.getByTestId("explore-source-clawhub-ai")).toBeInTheDocument();
  });

  it("toggles browse between list and gallery views", () => {
    render(
      <AgentSkillsSettingsPanel
        agent={buildAgent()}
        catalogItems={[buildCatalogItem()]}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByTestId("catalog-results-list")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-results-gallery")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("catalog-view-gallery"));
    expect(screen.getByTestId("catalog-results-gallery")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-results-list")).not.toBeInTheDocument();
    expect(screen.getByTestId("catalog-skill-writing-plans")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("catalog-view-list"));
    expect(screen.getByTestId("catalog-results-list")).toBeInTheDocument();
  });

  it("installs a recommended skill and saves the curated payload", async () => {
    const onSave = vi.fn().mockResolvedValue({
      agent: buildAgent({
        skills: ["writing-plans"],
        installedSkills: [
          buildInstalledSkill({
            key: "writing-plans",
            ref: "https://skills.sh/obra/superpowers/writing-plans",
            label: "Writing Plans",
            sourceKind: "curated"
          })
        ]
      }),
      workspaceSync: {
        status: "synced",
        message: "Workspace skill artifacts were updated for the active runtime."
      }
    });

    render(
      <AgentSkillsSettingsPanel
        agent={buildAgent()}
        catalogItems={[buildCatalogItem()]}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByTestId("install-catalog-writing-plans"));
    fireEvent.click(screen.getByRole("button", { name: "Save skills" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toEqual({
      skills: ["writing-plans"],
      installedSkills: [
        expect.objectContaining({
          key: "writing-plans",
          ref: "https://skills.sh/obra/superpowers/writing-plans",
          label: "Writing Plans",
          sourceKind: "curated"
        })
      ]
    });
  });

  it("supports disabling, reordering, uninstalling, and saving the resulting effective skill list", async () => {
    const onSave = vi.fn().mockResolvedValue({
      agent: buildAgent(),
      workspaceSync: {
        status: "synced",
        message: "Workspace skill artifacts were updated for the active runtime."
      }
    });

    render(
      <AgentSkillsSettingsPanel
        agent={buildAgent({
          skills: ["brainstorming", "writing-plans"],
          installedSkills: [
            buildInstalledSkill(),
            buildInstalledSkill({
              key: "writing-plans",
              ref: "https://skills.sh/obra/superpowers/writing-plans",
              label: "Writing Plans",
              sourceKind: "curated"
            })
          ]
        })}
        catalogItems={[buildCatalogItem({ installed: true, enabled: true })]}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByTestId("move-skill-down-brainstorming"));
    fireEvent.click(screen.getByLabelText("Enable Brainstorming"));
    fireEvent.click(screen.getByTestId("uninstall-skill-writing-plans"));
    fireEvent.click(screen.getByRole("button", { name: "Save skills" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toEqual({
      skills: [],
      installedSkills: [
        expect.objectContaining({
          key: "brainstorming",
          ref: "https://skills.sh/obra/superpowers/brainstorming"
        })
      ]
    });
  });

  it("filters the browse catalog and resets source filter when All is selected", () => {
    render(
      <AgentSkillsSettingsPanel
        agent={buildAgent({
          skills: ["brainstorming"],
          installedSkills: [buildInstalledSkill()]
        })}
        catalogItems={[
          buildCatalogItem({
            key: "brainstorming",
            ref: "https://skills.sh/obra/superpowers/brainstorming",
            label: "Brainstorming",
            summary: "Explore options before locking direction.",
            provider: "obra/superpowers",
            sourceHost: "skills.sh",
            recommendedForCurrentPreset: false,
            originCategories: ["strategy"],
            metadataStatus: "remote",
            sourcePresets: [
              {
                presetId: "growth-strategy",
                presetName: "Growth & Strategy"
              }
            ]
          }),
          buildCatalogItem({
            key: "skills-il-skill-creator",
            ref: "https://agentskills.co.il/en/skills/developer-tools/skills-il-skill-creator",
            label: "Skills IL Skill Creator",
            summary: "Interactive workflow for creating new skills.",
            provider: "skills-il/developer-tools",
            sourceHost: "agentskills.co.il",
            recommendedForCurrentPreset: false,
            originCategories: ["external-developer-tools"],
            metadataStatus: "remote",
            sourcePresets: [
              {
                presetId: "project-manager:related:agentskills:developer-tools",
                presetName: "Skills IL · Developer Tools"
              }
            ]
          }),
          buildCatalogItem()
        ]}
        onSave={vi.fn()}
      />
    );

    expect(screen.queryByTestId("catalog-skill-brainstorming")).not.toBeInTheDocument();
    expect(screen.getByTestId("catalog-skill-skills-il-skill-creator")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-skill-writing-plans")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-filter-installed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("catalog-filter-enabled")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("catalog-filter-preset"));
    expect(screen.queryByTestId("catalog-skill-brainstorming")).not.toBeInTheDocument();
    expect(screen.getByTestId("catalog-skill-writing-plans")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("catalog-filter-all"));
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "skills.sh" }));
    expect(screen.queryByTestId("catalog-skill-brainstorming")).not.toBeInTheDocument();
    expect(screen.getByTestId("catalog-skill-writing-plans")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-skill-skills-il-skill-creator")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("catalog-filter-all"));
    expect(screen.getByTestId("catalog-skill-skills-il-skill-creator")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search by skill name, key, source, or description"), {
      target: {
        value: "structured implementation"
      }
    });
    expect(screen.queryByTestId("catalog-skill-brainstorming")).not.toBeInTheDocument();
    expect(screen.getByTestId("catalog-skill-writing-plans")).toBeInTheDocument();
  });

  it("paginates catalog entries with 15 items per page", () => {
    const catalogItems = Array.from({ length: 18 }, (_, index) => {
      const order = String(index + 1).padStart(2, "0");
      return buildCatalogItem({
        key: `skill-${order}`,
        ref: `https://skills.sh/example/repo/skill-${order}`,
        label: `Skill ${order}`,
        sourceHost: "skills.sh",
        recommendedForCurrentPreset: false
      });
    });

    render(
      <AgentSkillsSettingsPanel
        agent={buildAgent()}
        catalogItems={catalogItems}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByTestId("catalog-skill-skill-01")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-skill-skill-18")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("catalog-page-next"));
    expect(screen.getByTestId("catalog-skill-skill-18")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-skill-skill-01")).not.toBeInTheDocument();
  });
});
