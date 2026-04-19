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

  it("renders the installed, recommended, and manual install sections", () => {
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

    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(screen.getByText("Recommended for this preset")).toBeInTheDocument();
    expect(screen.getByText("Install from source")).toBeInTheDocument();
    expect(screen.getByTestId("installed-skill-brainstorming")).toBeInTheDocument();
    expect(screen.getByTestId("recommended-skill-writing-plans")).toBeInTheDocument();
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

    fireEvent.click(screen.getByTestId("install-recommended-writing-plans"));
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

  it("installs a manual skills.sh URL and saves it as a manual install", async () => {
    const onSave = vi.fn().mockResolvedValue({
      agent: buildAgent(),
      workspaceSync: {
        status: "deferred",
        message: "No runtime exists yet. Skill artifacts will materialize during the next provision."
      }
    });

    render(
      <AgentSkillsSettingsPanel
        agent={buildAgent()}
        catalogItems={[]}
        onSave={onSave}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText("https://skills.sh/obra/superpowers/writing-plans"),
      {
        target: {
          value: "https://skills.sh/obra/superpowers/writing-plans"
        }
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Install source" }));
    fireEvent.click(screen.getByRole("button", { name: "Save skills" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toEqual({
      skills: ["writing-plans"],
      installedSkills: [
        expect.objectContaining({
          key: "writing-plans",
          ref: "https://skills.sh/obra/superpowers/writing-plans",
          label: "Writing Plans",
          sourceKind: "manual"
        })
      ]
    });
  });

  it("installs a GitHub repo source when a manual key is supplied", async () => {
    const onSave = vi.fn().mockResolvedValue({
      agent: buildAgent(),
      workspaceSync: {
        status: "deferred",
        message: "No runtime exists yet. Skill artifacts will materialize during the next provision."
      }
    });

    render(
      <AgentSkillsSettingsPanel
        agent={buildAgent()}
        catalogItems={[]}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("https://skills.sh/obra/superpowers/writing-plans"), {
      target: {
        value: "https://github.com/obra/superpowers"
      }
    });
    fireEvent.change(screen.getByPlaceholderText("writing-plans (optional)"), {
      target: {
        value: "writing-plans"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Install source" }));
    fireEvent.click(screen.getByRole("button", { name: "Save skills" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toEqual({
      skills: ["writing-plans"],
      installedSkills: [
        expect.objectContaining({
          key: "writing-plans",
          ref: "https://github.com/obra/superpowers",
          label: "Writing Plans",
          sourceKind: "manual"
        })
      ]
    });
  });

  it("installs a Skills IL skill page source without an explicit key", async () => {
    const onSave = vi.fn().mockResolvedValue({
      agent: buildAgent(),
      workspaceSync: {
        status: "deferred",
        message: "No runtime exists yet. Skill artifacts will materialize during the next provision."
      }
    });

    render(
      <AgentSkillsSettingsPanel
        agent={buildAgent()}
        catalogItems={[]}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("https://skills.sh/obra/superpowers/writing-plans"), {
      target: {
        value: "https://agentskills.co.il/en/skills/localization/hebrew-document-generator"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Install source" }));
    fireEvent.click(screen.getByRole("button", { name: "Save skills" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toEqual({
      skills: ["hebrew-document-generator"],
      installedSkills: [
        expect.objectContaining({
          key: "hebrew-document-generator",
          ref: "https://agentskills.co.il/en/skills/localization/hebrew-document-generator",
          label: "Hebrew Document Generator",
          sourceKind: "manual"
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
});
