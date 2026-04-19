import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Fastify from "fastify";

import { registerTenantAgentRoutes } from "../src/http/routes/tenants-agents.routes.js";
import { parseCreateAgentInput, parseUpdateAgentInput } from "../src/parsers.js";
import { createStore } from "../src/store.js";

type InstalledSkillShape = {
  key: string;
  ref: string;
  label: string;
  sourceKind: string;
  installedAt?: string;
  updatedAt?: string;
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

test("parseCreateAgentInput rejects non-skills.sh installs from helper settings", () => {
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
    })
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
    })
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
