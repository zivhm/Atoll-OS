import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Fastify from "fastify";

import {
  buildAgentSkillCatalog,
  clearAgentSkillMetadataCache,
  discoverExternalSkillPresets,
  enrichAgentSkillCatalogItems,
  resolveSkillInstallSource
} from "../src/agent-skills.js";
import { registerTenantAgentRoutes } from "../src/http/routes/tenants-agents.routes.js";
import type { AgentPresetCatalogItem } from "../src/agent-presets.js";
import { parseCreateAgentInput, parseUpdateAgentInput } from "../src/parsers.js";
import { createStore } from "../src/store.js";

type InstalledSkillShape = {
  key: string;
  ref: string;
  label: string;
  sourceKind: "manual" | "preset" | "curated" | "legacy";
  installedAt: string;
  updatedAt: string;
};

function createTempStore(input?: { snapshot?: Record<string, unknown> }) {
  const root = mkdtempSync(join(tmpdir(), "atoll-agent-skills-"));
  mkdirSync(root, { recursive: true });
  const stateFilePath = join(root, "state.json");
  if (input?.snapshot) {
    writeFileSync(stateFilePath, `${JSON.stringify(input.snapshot, null, 2)}\n`, "utf8");
  }

  return createStore({
    stateFilePath,
    secretsKey: "test-secret"
  });
}

function createInstalledSkill(overrides: Partial<InstalledSkillShape> = {}): InstalledSkillShape {
  const now = "2026-04-17T10:00:00.000Z";
  return {
    key: "brainstorming",
    ref: "https://skills.sh/obra/superpowers/brainstorming",
    label: "Brainstorming",
    sourceKind: "manual",
    installedAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createPreset(overrides: Partial<AgentPresetCatalogItem> = {}): AgentPresetCatalogItem {
  return {
    id: "project-manager",
    name: "Project Manager",
    description: "Coordinates projects",
    color: "cyan",
    category: "project-management",
    sourceRepoUrl: "https://skills.sh",
    sourcePath: "business-identities/project-manager",
    summary: "Project management preset",
    suggestedRoleTitle: "Project manager",
    recommendedSkills: ["https://skills.sh/obra/superpowers/writing-plans"],
    identity: "identity",
    soul: "soul",
    tools: [
      "# TOOLS.md - Recommended Skills",
      "",
      "- [writing-plans](https://skills.sh/obra/superpowers/writing-plans): Produce structured implementation or execution plans."
    ].join("\n"),
    active: true,
    position: 0,
    createdAt: "2026-04-17T10:00:00.000Z",
    updatedAt: "2026-04-17T10:00:00.000Z",
    ...overrides
  };
}

test("parseCreateAgentInput rejects enabled skills that are not installed", () => {
  assert.throws(
    () =>
      parseCreateAgentInput({
        tenantId: "tenant-1",
        name: "Nora",
        channel: "custom",
        installedSkills: [createInstalledSkill()],
        skills: ["writing-plans"]
      }),
    /installedSkills/u
  );
});

test("parseCreateAgentInput rejects unsupported helper skill sources", () => {
  assert.throws(
    () =>
      parseCreateAgentInput({
        tenantId: "tenant-1",
        name: "Nora",
        channel: "custom",
        installedSkills: [
          createInstalledSkill({
            key: "external-skill",
            ref: "https://example.com/skills/external-skill",
            label: "External Skill"
          })
        ],
        skills: ["external-skill"]
      }),
    /supported skill source/u
  );
});

test("parseCreateAgentInput accepts GitHub repo skill installs when the key is provided", () => {
  const parsed = parseCreateAgentInput({
    tenantId: "tenant-1",
    name: "Nora",
    channel: "custom",
    installedSkills: [
      createInstalledSkill({
        key: "writing-plans",
        ref: "https://github.com/obra/superpowers",
        label: "Writing Plans"
      })
    ],
    skills: ["writing-plans"]
  });

  assert.deepEqual(parsed.skills, ["writing-plans"]);
  assert.equal(parsed.installedSkills?.[0]?.ref, "https://github.com/obra/superpowers");
  assert.equal(parsed.installedSkills?.[0]?.key, "writing-plans");
});

test("parseCreateAgentInput accepts local skill paths", () => {
  const parsed = parseCreateAgentInput({
    tenantId: "tenant-1",
    name: "Nora",
    channel: "custom",
    installedSkills: [
      createInstalledSkill({
        key: "local-skill",
        ref: "C:\\skills\\local-skill",
        label: "Local Skill"
      })
    ],
    skills: ["local-skill"]
  });

  assert.deepEqual(parsed.skills, ["local-skill"]);
  assert.equal(parsed.installedSkills?.[0]?.ref, "C:\\skills\\local-skill");
  assert.equal(parsed.installedSkills?.[0]?.key, "local-skill");
});

test("parseCreateAgentInput accepts Skills IL skill page installs", () => {
  const parsed = parseCreateAgentInput({
    tenantId: "tenant-1",
    name: "Nora",
    channel: "custom",
    installedSkills: [
      createInstalledSkill({
        key: "hebrew-document-generator",
        ref: "https://agentskills.co.il/en/skills/localization/hebrew-document-generator",
        label: "Hebrew Document Generator"
      })
    ],
    skills: ["hebrew-document-generator"]
  });

  assert.deepEqual(parsed.skills, ["hebrew-document-generator"]);
  assert.equal(
    parsed.installedSkills?.[0]?.ref,
    "https://agentskills.co.il/en/skills/localization/hebrew-document-generator"
  );
  assert.equal(parsed.installedSkills?.[0]?.key, "hebrew-document-generator");
});

test("parseCreateAgentInput accepts ClawHub skill page installs", () => {
  const parsed = parseCreateAgentInput({
    tenantId: "tenant-1",
    name: "Nora",
    channel: "custom",
    installedSkills: [
      createInstalledSkill({
        key: "marketing-strategy-pmm",
        ref: "https://clawhub.ai/skills/marketing-strategy-pmm",
        label: "Marketing Strategy PMM"
      })
    ],
    skills: ["marketing-strategy-pmm"]
  });

  assert.deepEqual(parsed.skills, ["marketing-strategy-pmm"]);
  assert.equal(parsed.installedSkills?.[0]?.ref, "https://clawhub.ai/skills/marketing-strategy-pmm");
  assert.equal(parsed.installedSkills?.[0]?.key, "marketing-strategy-pmm");
});

test("resolveSkillInstallSource maps Skills IL pages to the category GitHub repo", () => {
  const source = resolveSkillInstallSource({
    ref: "https://agentskills.co.il/en/skills/localization/hebrew-document-generator"
  });

  assert.deepEqual(source, {
    kind: "github",
    key: "hebrew-document-generator",
    source: "skills-il/localization",
    packageRef: "https://github.com/skills-il/localization"
  });
});

test("resolveSkillInstallSource maps ClawHub pages to a ClawHub source descriptor", () => {
  const source = resolveSkillInstallSource({
    ref: "https://clawhub.ai/skills/marketing-strategy-pmm"
  });

  assert.deepEqual(source, {
    kind: "clawhub",
    key: "marketing-strategy-pmm",
    slug: "marketing-strategy-pmm",
    ref: "https://clawhub.ai/skills/marketing-strategy-pmm"
  });
});

test("buildAgentSkillCatalog merges TOOLS.md summaries, preset origins, and browse metadata", () => {
  const catalog = buildAgentSkillCatalog({
    presets: [
      createPreset(),
      createPreset({
        id: "growth-strategy",
        name: "Growth & Strategy",
        category: "strategy",
        recommendedSkills: ["https://skills.sh/obra/superpowers/writing-plans"],
        tools: [
          "# TOOLS.md - Recommended Skills",
          "",
          "- [writing-plans](https://skills.sh/obra/superpowers/writing-plans): Build executable plans for growth experiments."
        ].join("\n")
      })
    ],
    installedSkills: [
      createInstalledSkill({
        key: "writing-plans",
        ref: "https://skills.sh/obra/superpowers/writing-plans",
        label: "Writing Plans"
      })
    ],
    enabledSkills: ["writing-plans"],
    currentPresetId: "project-manager"
  });

  assert.equal(catalog.length, 1);
  assert.deepEqual(catalog[0], {
    key: "writing-plans",
    ref: "https://skills.sh/obra/superpowers/writing-plans",
    label: "Writing Plans",
    installed: true,
    enabled: true,
    summary: "Produce structured implementation or execution plans.",
    provider: "obra/superpowers",
    sourceHost: "skills.sh",
    recommendedForCurrentPreset: true,
    originCategories: ["project-management", "strategy"],
    metadataStatus: "local",
    sourcePresets: [
      {
        presetId: "project-manager",
        presetName: "Project Manager"
      },
      {
        presetId: "growth-strategy",
        presetName: "Growth & Strategy"
      }
    ]
  });
});

test("enrichAgentSkillCatalogItems uses stale cache on remote fetch failures", async () => {
  clearAgentSkillMetadataCache();

  const baseItem = {
    key: "writing-plans",
    ref: "https://skills.sh/obra/superpowers/writing-plans",
    label: "Writing Plans",
    installed: false,
    enabled: false,
    summary: "",
    provider: "obra/superpowers",
    sourceHost: "skills.sh",
    recommendedForCurrentPreset: false,
    originCategories: ["project-management"],
    metadataStatus: "local" as const,
    sourcePresets: [
      {
        presetId: "project-manager",
        presetName: "Project Manager"
      }
    ]
  };

  const remoteHtml = [
    "<html><head>",
    '<meta property="og:title" content="Advanced Writing Plans" />',
    '<meta property="og:description" content="Build clear implementation milestones and execution paths." />',
    "</head><body></body></html>"
  ].join("");

  const remoteFetch: typeof fetch = async () =>
    new Response(remoteHtml, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });

  const enriched = await enrichAgentSkillCatalogItems({
    items: [baseItem],
    fetchImpl: remoteFetch,
    ttlMs: 1000,
    nowMs: 1000
  });

  assert.equal(enriched[0]?.metadataStatus, "remote");
  assert.equal(enriched[0]?.summary, "Build clear implementation milestones and execution paths.");

  const failingFetch: typeof fetch = async () => {
    throw new Error("upstream failed");
  };

  const stale = await enrichAgentSkillCatalogItems({
    items: [baseItem],
    fetchImpl: failingFetch,
    ttlMs: 1000,
    nowMs: 5000
  });

  assert.equal(stale[0]?.metadataStatus, "stale");
  assert.equal(stale[0]?.summary, "Build clear implementation milestones and execution paths.");
});

test("discoverExternalSkillPresets returns role-related Skills IL presets", async () => {
  const html = [
    "<html><body>",
    '<a href="/en/skills/developer-tools/skills-il-skill-creator">creator</a>',
    '<a href="/en/skills/marketing-growth/israeli-social-content">social</a>',
    '<a href="/en/skills/tax-and-finance/israeli-tax-returns">tax</a>',
    "</body></html>"
  ].join("");

  const fetchMock: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("https://agentskills.co.il/en/skills")) {
      return new Response(html, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8"
        }
      });
    }

    if (url.startsWith("https://clawhub.ai/api/v1/search")) {
      const parsedUrl = new URL(url);
      const query = parsedUrl.searchParams.get("q") ?? "";
      const results =
        query === "project management"
          ? [
              {
                slug: "project-management-pro",
                displayName: "Project Management Pro",
                summary: "Project planning and milestone tracking."
              },
              {
                slug: "task-planner-lite",
                displayName: "Task Planner Lite",
                summary: "Task decomposition and ownership workflows."
              }
            ]
          : [];

      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8"
        }
      });
    }

    return new Response("not found", {
      status: 404
    });
  };

  const presets = await discoverExternalSkillPresets({
    currentPresetId: "project-manager",
    currentPresetCategory: "project-management",
    fetchImpl: fetchMock,
    nowMs: 1234
  });

  assert.ok(presets.length >= 2);
  const developerTools = presets.find((preset) => preset.id.includes("agentskills:developer-tools"));
  assert.ok(developerTools);
  assert.ok(developerTools?.id.startsWith("project-manager:related:"));
  assert.ok(
    developerTools?.recommendedSkills.includes(
      "https://agentskills.co.il/en/skills/developer-tools/skills-il-skill-creator"
    )
  );
  const clawHub = presets.find((preset) => preset.id.includes("clawhub:skills"));
  assert.ok(clawHub);
  assert.ok(
    clawHub?.recommendedSkills.includes("https://clawhub.ai/skills/project-management-pro")
  );
  assert.equal(
    presets.some((preset) => preset.recommendedSkills.some((ref) => ref.includes("tax-and-finance"))),
    false,
    "project-management role should not include finance-only category discovery"
  );
});

test("parseUpdateAgentInput rejects duplicate installed skill refs and keys", () => {
  assert.throws(
    () =>
      parseUpdateAgentInput({
        installedSkills: [
          createInstalledSkill(),
          createInstalledSkill({
            key: "BRAINSTORMING",
            ref: "https://skills.sh/obra/superpowers/brainstorming",
            label: "Brainstorming Duplicate"
          })
        ],
        skills: ["brainstorming"]
      }),
    /duplicate/u
  );
});

test("store load migrates legacy skill strings into installedSkills", () => {
  const store = createTempStore({
    snapshot: {
      version: 1,
      tenants: [
        {
          id: "tenant-1",
          name: "Default Workspace",
          kind: "default",
          resourceMode: "individual",
          isDefault: true,
          identityOrgId: "org-1",
          createdAt: "2026-04-17T09:00:00.000Z"
        }
      ],
      agents: [
        {
          id: "agent-1",
          tenantId: "tenant-1",
          name: "Legacy Nora",
          agentType: "general",
          skills: [
            "brainstorming",
            "https://skills.sh/obra/superpowers/writing-plans",
            "legacy-custom-skill"
          ],
          channel: "custom",
          status: "running",
          createdAt: "2026-04-17T09:00:00.000Z"
        }
      ],
      runtimeInstances: []
    }
  });

  const agent = store.getAgent("agent-1") as
    | (ReturnType<typeof store.getAgent> & { installedSkills?: InstalledSkillShape[] })
    | undefined;

  assert.ok(agent);
  assert.deepEqual(agent.skills, [
    "brainstorming",
    "writing-plans",
    "legacy-custom-skill"
  ]);
  assert.deepEqual(
    agent.installedSkills?.map((skill) => ({
      key: skill.key,
      ref: skill.ref,
      sourceKind: skill.sourceKind
    })),
    [
      {
        key: "brainstorming",
        ref: "brainstorming",
        sourceKind: "legacy"
      },
      {
        key: "writing-plans",
        ref: "https://skills.sh/obra/superpowers/writing-plans",
        sourceKind: "legacy"
      },
      {
        key: "legacy-custom-skill",
        ref: "legacy-custom-skill",
        sourceKind: "legacy"
      }
    ]
  );
});

test("helper creation from a preset seeds installedSkills and the helper skill catalog", async (t) => {
  const store = createTempStore();
  const tenant = store.ensureDefaultTenant("org-1");
  const app = Fastify();
  t.after(async () => {
    await app.close();
  });

  registerTenantAgentRoutes(app, {
    store,
    getAuthContextOrThrow: () => ({
      sub: "user-1",
      orgId: "org-1"
    }),
    discoverSkillPresets: async () => [],
    enrichSkillCatalogItems: async (items) => items
  });

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/agents",
    payload: {
      tenantId: tenant.id,
      name: "Preset Nora",
      presetId: "project-manager",
      channel: "custom"
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as {
    id: string;
    skills: string[];
    installedSkills?: InstalledSkillShape[];
  };
  assert.ok(created.id);
  assert.ok(created.skills.length > 0);
  assert.equal(created.installedSkills?.length, created.skills.length);
  assert.ok(
    created.installedSkills?.every((skill) => skill.ref.startsWith("https://skills.sh/")),
    "preset-seeded skills should use trusted refs"
  );

  const catalogResponse = await app.inject({
    method: "GET",
    url: `/api/agents/${created.id}/skills/catalog`
  });

  assert.equal(catalogResponse.statusCode, 200);
  const catalog = catalogResponse.json() as {
    items: Array<{
      key: string;
      ref: string;
      installed: boolean;
      enabled: boolean;
      summary: string;
      provider: string;
      sourceHost: string;
      recommendedForCurrentPreset: boolean;
      originCategories: string[];
      metadataStatus: string;
    }>;
  };

  const writingPlans = catalog.items.find((item) => item.key === "writing-plans");
  assert.ok(writingPlans);
  assert.equal(writingPlans?.installed, true);
  assert.equal(writingPlans?.enabled, true);
  assert.equal(
    writingPlans?.ref,
    "https://skills.sh/obra/superpowers/writing-plans"
  );
  assert.match(writingPlans?.summary ?? "", /structured implementation or execution plans/u);
  assert.equal(writingPlans?.provider, "obra/superpowers");
  assert.equal(writingPlans?.sourceHost, "skills.sh");
  assert.equal(writingPlans?.recommendedForCurrentPreset, true);
  assert.deepEqual(writingPlans?.originCategories, ["project-management"]);
  assert.equal(writingPlans?.metadataStatus, "local");
});

test("helper skill catalog includes dynamically discovered role-related skills", async (t) => {
  const store = createTempStore();
  const tenant = store.ensureDefaultTenant("org-1");
  const app = Fastify();
  t.after(async () => {
    await app.close();
  });

  registerTenantAgentRoutes(app, {
    store,
    getAuthContextOrThrow: () => ({
      sub: "user-1",
      orgId: "org-1"
    }),
    discoverSkillPresets: async () => [
      createPreset({
        id: "project-manager:related:agentskills:developer-tools",
        name: "Skills IL · Developer Tools",
        category: "external-developer-tools",
        recommendedSkills: [
          "https://agentskills.co.il/en/skills/developer-tools/skills-il-skill-creator"
        ],
        tools: [
          "# TOOLS.md - Recommended Skills",
          "",
          "- [skills-il-skill-creator](https://agentskills.co.il/en/skills/developer-tools/skills-il-skill-creator): Dynamic role-related discovery."
        ].join("\n")
      })
    ],
    enrichSkillCatalogItems: async (items) => items
  });

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/agents",
    payload: {
      tenantId: tenant.id,
      name: "Discovered Nora",
      presetId: "project-manager",
      channel: "custom"
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { id: string };

  const catalogResponse = await app.inject({
    method: "GET",
    url: `/api/agents/${created.id}/skills/catalog`
  });

  assert.equal(catalogResponse.statusCode, 200);
  const catalog = catalogResponse.json() as {
    items: Array<{
      key: string;
      ref: string;
      sourceHost: string;
      recommendedForCurrentPreset: boolean;
    }>;
  };

  const discovered = catalog.items.find((item) => item.key === "skills-il-skill-creator");
  assert.ok(discovered);
  assert.equal(discovered?.ref, "https://agentskills.co.il/en/skills/developer-tools/skills-il-skill-creator");
  assert.equal(discovered?.sourceHost, "agentskills.co.il");
  assert.equal(discovered?.recommendedForCurrentPreset, true);
});

test("helper skill saves are deferred when no runtime exists yet", async (t) => {
  const store = createTempStore();
  const tenant = store.ensureDefaultTenant("org-1");
  const agent = store.createAgent({
    tenantId: tenant.id,
    name: "Deferred Nora",
    channel: "custom",
    skills: ["brainstorming"]
  });
  const app = Fastify();
  t.after(async () => {
    await app.close();
  });

  registerTenantAgentRoutes(app, {
    store,
    getAuthContextOrThrow: () => ({
      sub: "user-1",
      orgId: "org-1"
    }),
    discoverSkillPresets: async () => [],
    enrichSkillCatalogItems: async (items) => items
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/agents/${agent.id}`,
    payload: {
      installedSkills: [
        createInstalledSkill({
          key: "brainstorming",
          ref: "https://skills.sh/obra/superpowers/brainstorming",
          label: "Brainstorming",
          sourceKind: "manual"
        })
      ],
      skills: ["brainstorming"]
    }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    agent: { installedSkills: InstalledSkillShape[]; skills: string[] };
    workspaceSync: { status: string; message: string };
  };

  assert.equal(payload.workspaceSync.status, "deferred");
  assert.match(payload.workspaceSync.message, /next provision/u);
  assert.equal(payload.agent.installedSkills.length, 1);
  assert.deepEqual(payload.agent.skills, ["brainstorming"]);
});

test("helper skill saves sync workspace artifacts immediately when a runtime exists", async (t) => {
  const store = createTempStore();
  const tenant = store.ensureDefaultTenant("org-1");
  const agent = store.createAgent({
    tenantId: tenant.id,
    name: "Synced Nora",
    channel: "custom",
    skills: ["brainstorming"]
  });
  const runtimeInstance = store.createRuntimeInstance({
    tenantId: tenant.id,
    agentId: agent.id,
    runtimeType: "openclaw",
    containerName: "atoll-rt-synced",
    volumeName: "atoll_rt_synced",
    networkName: "atoll-network",
    gatewayPort: 42617,
    requirePairing: false,
    allowPublicBind: true,
    llmProvider: "openrouter",
    llmModel: "openai/gpt-5.3-chat"
  });
  const syncCalls: Array<{
    runtimeType?: string;
    volumeName: string;
    skills: string[];
    installedSkillKeys: string[];
  }> = [];
  const app = Fastify();
  t.after(async () => {
    await app.close();
  });

  registerTenantAgentRoutes(app, {
    store,
    getAuthContextOrThrow: () => ({
      sub: "user-1",
      orgId: "org-1"
    }),
    discoverSkillPresets: async () => [],
    enrichSkillCatalogItems: async (items) => items,
    runtimeProvider: {
      id: "test-runtime",
      displayName: "Test Runtime",
      checkPrereqs: async () => {
        throw new Error("not implemented");
      },
      provisionRuntimeContainer: async () => {},
      writeRuntimeConfig: async () => {},
      syncRuntimeSkillArtifacts: async (input) => {
        syncCalls.push({
          runtimeType: input.runtimeType,
          volumeName: input.volumeName,
          skills: input.workspaceProfile?.skills ?? [],
          installedSkillKeys:
            input.workspaceProfile?.installedSkills?.map((skill) => skill.key) ?? []
        });
      },
      restartRuntimeContainer: async () => {},
      startRuntimeContainer: async () => {},
      stopRuntimeContainer: async () => {},
      readRuntimeContainerLogs: async () => "",
      getRuntimePairingInfo: async () => ({
        message: ""
      }),
      getRuntimeEnvironmentDiagnostics: async () => ({
        containerCli: "docker",
        processMode: "daemon",
        image: {
          name: "test",
          status: "present",
          message: ""
        },
        network: {
          name: "test",
          status: "present",
          message: ""
        }
      }),
      destroyRuntimeContainer: async () => {}
    }
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/agents/${agent.id}`,
    payload: {
      installedSkills: [
        createInstalledSkill({
          key: "brainstorming",
          ref: "https://skills.sh/obra/superpowers/brainstorming",
          label: "Brainstorming",
          sourceKind: "manual"
        }),
        createInstalledSkill({
          key: "writing-plans",
          ref: "https://skills.sh/obra/superpowers/writing-plans",
          label: "Writing Plans",
          sourceKind: "curated"
        })
      ],
      skills: ["writing-plans", "brainstorming"]
    }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    workspaceSync: { status: string };
  };

  assert.equal(payload.workspaceSync.status, "synced");
  assert.equal(syncCalls.length, 1);
  assert.deepEqual(syncCalls[0], {
    runtimeType: runtimeInstance.runtimeType,
    volumeName: runtimeInstance.volumeName,
    skills: ["writing-plans", "brainstorming"],
    installedSkillKeys: ["brainstorming", "writing-plans"]
  });
});
