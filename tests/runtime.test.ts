import assert from "node:assert/strict";
import test from "node:test";

import { getAgentPresetById } from "../src/agent-presets.js";
import {
  buildHermesConfigYaml,
  buildHermesEnvFile,
  buildOpenClawConfigJson,
  buildRuntimeSkillsLockJson,
  buildWorkspaceSeedFiles,
  renderRuntimeSkillArtifacts,
  sanitizeRuntimeSharedRelativePath
} from "../src/runtime.js";
import {
  parseCreateRuntimeInstanceInput,
  parseRuntimeDiscordSettingsInput,
  parseRuntimeSharedFilesUploadInput
} from "../src/parsers.js";
import type { RuntimeInstance } from "../src/store.js";
import {
  buildRuntimeCatalog,
  getRuntimeConnector,
  getRuntimeDescriptor,
  getRuntimeTypes,
  normalizeRuntimeType,
  resolveRuntimeHealthPath,
  resolveRuntimeEnvironment,
  resolveRuntimeLaunchArgs
} from "../src/runtime-kind.js";

test("buildOpenClawConfigJson uses agents.defaults (not legacy agent.* keys)", () => {
  const payload = JSON.parse(
    buildOpenClawConfigJson({
      llm: {
        provider: "anthropic",
        model: "anthropic/claude-sonnet-4.5",
        apiKey: "test-api-key"
      },
      telegram: {
        enabled: false,
        allowFrom: [],
        replyInPrivate: true
      },
      slack: {
        enabled: false,
        allowedChannelIds: [],
        allowedUserIds: [],
        replyInThread: true
      },
      gatewayPort: 42617
    })
  ) as Record<string, unknown>;

  assert.equal(typeof payload.agents, "object");
  assert.equal(Object.hasOwn(payload, "agent"), false);

  const defaults = (payload.agents as { defaults?: { workspace?: string; model?: { primary?: string } } })
    .defaults;
  assert.equal(defaults?.workspace, "~/.openclaw/workspace");
  assert.equal(defaults?.model?.primary, "anthropic/claude-sonnet-4.5");
});

test("buildOpenClawConfigJson writes telegram allowlist policy when telegram is enabled", () => {
  const payload = JSON.parse(
    buildOpenClawConfigJson({
      llm: {
        provider: "openai",
        model: "gpt-4.1-mini",
        apiKey: "test-api-key"
      },
      telegram: {
        enabled: true,
        botToken: "123456:abcdef",
        allowFrom: ["543895054"],
        replyInPrivate: true
      },
      slack: {
        enabled: false,
        allowedChannelIds: [],
        allowedUserIds: [],
        replyInThread: true
      },
      gatewayPort: 42617
    })
  ) as {
    channels?: {
      telegram?: {
        enabled?: boolean;
        botToken?: string;
        allowFrom?: string[];
        dmPolicy?: string;
      };
    };
  };

  assert.equal(payload.channels?.telegram?.enabled, true);
  assert.equal(payload.channels?.telegram?.botToken, "123456:abcdef");
  assert.deepEqual(payload.channels?.telegram?.allowFrom, ["543895054"]);
  assert.equal(payload.channels?.telegram?.dmPolicy, "allowlist");
});

test("buildOpenClawConfigJson prefixes openrouter provider for nested catalog model ids", () => {
  const payload = JSON.parse(
    buildOpenClawConfigJson({
      llm: {
        provider: "openrouter",
        model: "openai/gpt-5.3-chat",
        apiKey: "test-api-key"
      },
      telegram: {
        enabled: false,
        allowFrom: [],
        replyInPrivate: true
      },
      slack: {
        enabled: false,
        allowedChannelIds: [],
        allowedUserIds: [],
        replyInThread: true
      },
      gatewayPort: 42617
    })
  ) as {
    agents?: { defaults?: { model?: { primary?: string } } };
  };

  assert.equal(payload.agents?.defaults?.model?.primary, "openrouter/openai/gpt-5.3-chat");
});

test("buildOpenClawConfigJson does not double-prefix openrouter model refs", () => {
  const payload = JSON.parse(
    buildOpenClawConfigJson({
      llm: {
        provider: "openrouter",
        model: "openrouter/openai/gpt-5.3-chat",
        apiKey: "test-api-key"
      },
      telegram: {
        enabled: false,
        allowFrom: [],
        replyInPrivate: true
      },
      slack: {
        enabled: false,
        allowedChannelIds: [],
        allowedUserIds: [],
        replyInThread: true
      },
      gatewayPort: 42617
    })
  ) as {
    agents?: { defaults?: { model?: { primary?: string } } };
  };

  assert.equal(payload.agents?.defaults?.model?.primary, "openrouter/openai/gpt-5.3-chat");
});

test("buildOpenClawConfigJson writes docs-aligned native discord channel config", () => {
  const payload = JSON.parse(
    buildOpenClawConfigJson({
      llm: {
        provider: "openrouter",
        model: "openai/gpt-5.3-chat",
        apiKey: "test-api-key"
      },
      telegram: {
        enabled: false,
        allowFrom: [],
        replyInPrivate: true
      },
      slack: {
        enabled: false,
        allowedChannelIds: [],
        allowedUserIds: [],
        replyInThread: true
      },
      discord: {
        enabled: true,
        botToken: "discord-token",
        allowedGuildIds: ["123456789012345678"],
        allowedChannelIds: ["234567890123456789"],
        replyInThread: true,
        requireMention: false
      },
      gatewayPort: 42617
    })
  ) as {
    channels?: {
      discord?: {
        enabled?: boolean;
        token?: string;
        dmPolicy?: string;
        allowBots?: boolean;
        groupPolicy?: string;
        replyToMode?: string;
        guilds?: Record<
          string,
          {
            requireMention?: boolean;
            channels?: Record<string, { requireMention?: boolean }>;
          }
        >;
      };
    };
  };

  assert.equal(payload.channels?.discord?.enabled, true);
  assert.equal(payload.channels?.discord?.token, "discord-token");
  assert.equal(payload.channels?.discord?.dmPolicy, "pairing");
  assert.equal(payload.channels?.discord?.allowBots, false);
  assert.equal(payload.channels?.discord?.groupPolicy, "allowlist");
  assert.equal(payload.channels?.discord?.replyToMode, "first");
  assert.equal(payload.channels?.discord?.guilds?.["123456789012345678"]?.requireMention, false);
  assert.equal(
    payload.channels?.discord?.guilds?.["123456789012345678"]?.channels?.["234567890123456789"]
      ?.requireMention,
    false
  );
});

test("buildOpenClawConfigJson opens discord group policy when guild/channel allowlists are empty", () => {
  const payload = JSON.parse(
    buildOpenClawConfigJson({
      llm: {
        provider: "openrouter",
        model: "openai/gpt-5.3-chat",
        apiKey: "test-api-key"
      },
      telegram: {
        enabled: false,
        allowFrom: [],
        replyInPrivate: true
      },
      slack: {
        enabled: false,
        allowedChannelIds: [],
        allowedUserIds: [],
        replyInThread: true
      },
      discord: {
        enabled: true,
        botToken: "discord-token",
        allowedGuildIds: [],
        allowedChannelIds: [],
        replyInThread: false
      },
      gatewayPort: 42617
    })
  ) as {
    channels?: {
      discord?: {
        groupPolicy?: string;
        replyToMode?: string;
        guilds?: Record<string, unknown>;
      };
    };
  };

  assert.equal(payload.channels?.discord?.groupPolicy, "open");
  assert.equal(payload.channels?.discord?.replyToMode, "off");
  assert.equal(payload.channels?.discord?.guilds, undefined);
});

test("buildHermes config output matches the container-native Hermes layout", () => {
  const configYaml = buildHermesConfigYaml({
    llm: {
      provider: "openrouter",
      model: "openai/gpt-5.3-chat",
      apiKey: "test-api-key"
    },
    telegram: {
      enabled: true,
      botToken: "telegram-token",
      allowFrom: ["12345"],
      replyInPrivate: true
    },
    slack: {
      enabled: true,
      botToken: "xoxb-bot",
      allowedChannelIds: ["C123"],
      allowedUserIds: ["U123"],
      replyInThread: true
    },
    discord: {
      enabled: true,
      botToken: "discord-token",
      allowedGuildIds: ["G123"],
      allowedChannelIds: ["D123"],
      replyInThread: true,
      requireMention: true
    },
    gatewayPort: 42617,
    gatewayAuthToken: "bearer-token"
  });
  const envFile = buildHermesEnvFile({
    llm: {
      provider: "openrouter",
      model: "openai/gpt-5.3-chat",
      apiKey: "test-api-key"
    },
    telegram: {
      enabled: true,
      botToken: "telegram-token",
      allowFrom: ["12345"],
      replyInPrivate: true
    },
    slack: {
      enabled: true,
      botToken: "xoxb-bot",
      appToken: "xapp-app",
      allowedChannelIds: ["C123"],
      allowedUserIds: ["U123"],
      replyInThread: true
    },
    discord: {
      enabled: true,
      botToken: "discord-token",
      allowedGuildIds: ["G123"],
      allowedChannelIds: ["D123"],
      replyInThread: true,
      requireMention: true
    },
    gatewayPort: 42617,
    gatewayAuthToken: "bearer-token"
  });

  assert.match(configYaml, /model:\n\s+default:\s*"openai\/gpt-5\.3-chat"/u);
  assert.match(configYaml, /provider:\s*"openrouter"/u);
  assert.match(configYaml, /base_url:\s*"https:\/\/openrouter\.ai\/api\/v1"/u);
  assert.match(configYaml, /terminal:\n\s+backend:\s*"local"/u);
  assert.match(configYaml, /cwd:\s*"\/opt\/data\/atoll\/workspace"/u);
  assert.match(configYaml, /platforms:\n\s+slack:/u);
  assert.match(configYaml, /reply_in_thread:\s*true/u);
  assert.match(configYaml, /discord:/u);
  assert.doesNotMatch(configYaml, /api_server:/u);

  assert.match(envFile, /^OPENROUTER_API_KEY=test-api-key/mu);
  assert.match(envFile, /^API_SERVER_ENABLED=true/mu);
  assert.match(envFile, /^API_SERVER_PORT=42617/mu);
  assert.match(envFile, /^API_SERVER_KEY=bearer-token/mu);
  assert.match(envFile, /^API_SERVER_MODEL_NAME=openai\/gpt-5\.3-chat/mu);
  assert.match(envFile, /^MESSAGING_CWD=\/opt\/data\/atoll\/workspace/mu);
  assert.match(envFile, /^TELEGRAM_BOT_TOKEN=telegram-token/mu);
  assert.match(envFile, /^SLACK_BOT_TOKEN=xoxb-bot/mu);
  assert.match(envFile, /^SLACK_APP_TOKEN=xapp-app/mu);
  assert.match(envFile, /^SLACK_ALLOWED_USERS=U123/mu);
  assert.doesNotMatch(envFile, /^SLACK_ALLOWED_CHANNELS=/mu);
  assert.match(envFile, /^DISCORD_BOT_TOKEN=discord-token/mu);
});

test("workspace seed files include first-contact onboarding protocol", () => {
  const seeded = buildWorkspaceSeedFiles({
    workspaceName: "Ops Workspace",
    helperName: "Nora",
    helperStyle: "Direct and concise"
  });

  assert.match(seeded.soulMarkdown, /First-Contact Onboarding \(Required\)/u);
  assert.match(seeded.soulMarkdown, /Heartbeat preference/u);
  assert.match(seeded.userMarkdown, /Status: pending/u);
  assert.match(seeded.userMarkdown, /After first-contact onboarding/u);
});

test("business identity presets preserve the onboarding placeholder and generic TOOLS.md remains stable", () => {
  const preset = getAgentPresetById("project-manager");
  assert.ok(preset);

  const seeded = buildWorkspaceSeedFiles({
    workspaceName: "Atoll Delivery",
    helperName: "Nora",
    helperStyle: "Custom helper style should not override the preset soul",
    presetId: preset.id,
    presetName: preset.name,
    presetSummary: preset.summary,
    presetSourcePath: preset.sourcePath,
    presetToolsMarkdown: preset.tools
  });

  assert.match(preset.identity, /\[set during onboarding\]/u);
  assert.match(preset.soul, /\[set during onboarding\]/u);
  assert.match(seeded.soulMarkdown, /First-Contact Onboarding \(Required\)/u);
  assert.match(seeded.userMarkdown, /## Preset Profile/u);
  assert.match(seeded.userMarkdown, /business-identities\/project-manager/u);
  assert.match(seeded.toolsMarkdown, /# TOOLS\.md/u);
  assert.match(seeded.toolsMarkdown, /Atoll Managed Skills/u);
  assert.match(seeded.toolsMarkdown, /skills-lock\.json/u);
});

test("buildRuntimeSkillsLockJson writes enabled and installed helper skill state", () => {
  const lockJson = buildRuntimeSkillsLockJson({
    workspaceName: "Ops Workspace",
    helperName: "Nora",
    presetId: "project-manager",
    presetName: "Project Manager",
    skills: ["writing-plans", "brainstorming"],
    installedSkills: [
      {
        key: "writing-plans",
        ref: "https://skills.sh/obra/superpowers/writing-plans",
        label: "Writing Plans",
        sourceKind: "preset",
        installedAt: "2026-04-17T09:00:00.000Z",
        updatedAt: "2026-04-17T09:00:00.000Z"
      },
      {
        key: "brainstorming",
        ref: "https://skills.sh/obra/superpowers/brainstorming",
        label: "Brainstorming",
        sourceKind: "manual",
        installedAt: "2026-04-17T09:05:00.000Z",
        updatedAt: "2026-04-17T09:05:00.000Z"
      }
    ]
  });

  const payload = JSON.parse(lockJson) as {
    version: number;
    helper: { name: string; presetId?: string };
    enabledSkills: string[];
    installedSkills: Array<{ key: string; sourceKind: string }>;
  };

  assert.equal(payload.version, 1);
  assert.equal(payload.helper.name, "Nora");
  assert.equal(payload.helper.presetId, "project-manager");
  assert.deepEqual(payload.enabledSkills, ["writing-plans", "brainstorming"]);
  assert.deepEqual(
    payload.installedSkills.map((skill) => [skill.key, skill.sourceKind]),
    [
      ["writing-plans", "preset"],
      ["brainstorming", "manual"]
    ]
  );
});

test("renderRuntimeSkillArtifacts replaces managed skill blocks and preserves unmanaged content", () => {
  const rendered = renderRuntimeSkillArtifacts({
    runtimeType: "openclaw",
    workspaceProfile: {
      workspaceName: "Ops Workspace",
      helperName: "Nora",
      helperStyle: "Direct and concise",
      agentTypeName: "General Helper",
      skills: ["writing-plans"],
      installedSkills: [
        {
          key: "writing-plans",
          ref: "https://skills.sh/obra/superpowers/writing-plans",
          label: "Writing Plans",
          sourceKind: "preset",
          installedAt: "2026-04-17T09:00:00.000Z",
          updatedAt: "2026-04-17T09:00:00.000Z"
        }
      ]
    },
    userMarkdown: [
      "# USER.md - Workspace Context",
      "",
      "Custom intro",
      "",
      "<!-- ATOLL:MANAGED-SKILLS:USER:START -->",
      "outdated",
      "<!-- ATOLL:MANAGED-SKILLS:USER:END -->",
      "",
      "## Onboarding Status",
      "",
      "- Status: confirmed",
      "",
      "Custom footer"
    ].join("\n"),
    toolsMarkdown: [
      "# TOOLS.md - Skill Profile",
      "",
      "User-owned notes",
      "",
      "<!-- ATOLL:MANAGED-SKILLS:TOOLS:START -->",
      "outdated",
      "<!-- ATOLL:MANAGED-SKILLS:TOOLS:END -->",
      "",
      "More notes"
    ].join("\n")
  });

  assert.match(rendered.userMarkdown, /Custom intro/u);
  assert.match(rendered.userMarkdown, /Custom footer/u);
  assert.doesNotMatch(rendered.userMarkdown, /outdated/u);
  assert.match(rendered.userMarkdown, /Managed Skill State/u);
  assert.match(rendered.userMarkdown, /writing-plans/u);

  assert.match(rendered.toolsMarkdown, /User-owned notes/u);
  assert.match(rendered.toolsMarkdown, /More notes/u);
  assert.doesNotMatch(rendered.toolsMarkdown, /outdated/u);
  assert.match(rendered.toolsMarkdown, /Atoll Managed Skills/u);
  assert.match(rendered.toolsMarkdown, /Writing Plans/u);
});

test("renderRuntimeSkillArtifacts inserts managed blocks when workspace docs do not have them yet", () => {
  const rendered = renderRuntimeSkillArtifacts({
    runtimeType: "openclaw",
    workspaceProfile: {
      workspaceName: "Ops Workspace",
      helperName: "Nora",
      helperStyle: "Direct and concise",
      skills: [],
      installedSkills: []
    },
    userMarkdown: [
      "# USER.md - Workspace Context",
      "",
      "Custom intro",
      "",
      "## Onboarding Status",
      "",
      "- Status: pending"
    ].join("\n"),
    toolsMarkdown: [
      "# TOOLS.md - Skill Profile",
      "",
      "Custom tools preface"
    ].join("\n")
  });

  assert.match(
    rendered.userMarkdown,
    /<!-- ATOLL:MANAGED-SKILLS:USER:START -->[\s\S]*Managed Skill State[\s\S]*## Onboarding Status/u
  );
  assert.match(
    rendered.toolsMarkdown,
    /Custom tools preface[\s\S]*<!-- ATOLL:MANAGED-SKILLS:TOOLS:START -->[\s\S]*Atoll Managed Skills/u
  );
});

test("runtime descriptors expose mount, config, and workspace paths per runtime", () => {
  const openclaw = getRuntimeDescriptor("openclaw");
  const zeroclaw = getRuntimeDescriptor("zeroclaw");
  const hermes = getRuntimeDescriptor("hermes");

  assert.equal(openclaw.mountPath, "/home/node/.openclaw");
  assert.equal(openclaw.configPath, "/openclaw-data/openclaw.json");
  assert.equal(openclaw.workspaceDir, "/openclaw-data/workspace");

  assert.equal(zeroclaw.mountPath, "/zeroclaw-data");
  assert.equal(zeroclaw.configPath, "/zeroclaw-data/.zeroclaw/config.toml");
  assert.equal(zeroclaw.workspaceDir, "/zeroclaw-data/workspace");

  assert.equal(hermes.mountPath, "/opt/data");
  assert.equal(hermes.configPath, "/opt/data/config.yaml");
  assert.equal(hermes.workspaceDir, "/opt/data/atoll/workspace");
});

test("runtime launch args resolve from descriptor metadata", () => {
  assert.deepEqual(
    resolveRuntimeLaunchArgs("openclaw", {
      image: "openclaw:test",
      gatewayPort: 42617,
      processMode: "daemon"
    }),
    ["openclaw:test", "node", "dist/index.js", "gateway", "--bind", "lan", "--port", "42617"]
  );

  assert.deepEqual(
    resolveRuntimeLaunchArgs("zeroclaw", {
      image: "zeroclaw:test",
      gatewayPort: 42617,
      processMode: "gateway"
    }),
    ["zeroclaw:test", "gateway", "--host", "0.0.0.0", "--port", "42617"]
  );

  assert.deepEqual(
    resolveRuntimeLaunchArgs("hermes", {
      image: "hermes:test",
      gatewayPort: 42617,
      processMode: "daemon"
    }),
    ["hermes:test", "gateway", "run", "--replace"]
  );
});

test("runtime environment adds deprecation suppression only for openclaw", () => {
  assert.deepEqual(resolveRuntimeEnvironment("openclaw"), {
    NODE_OPTIONS: "--no-deprecation"
  });
  assert.deepEqual(resolveRuntimeEnvironment("zeroclaw"), {});
  assert.deepEqual(resolveRuntimeEnvironment("hermes"), {});
});

test("runtime health metadata stays connector-driven", () => {
  assert.equal(getRuntimeConnector("openclaw").healthMode, "http");
  assert.equal(resolveRuntimeHealthPath("openclaw"), "/healthz");

  assert.equal(getRuntimeConnector("zeroclaw").healthMode, "http");
  assert.equal(resolveRuntimeHealthPath("zeroclaw"), "/health");

  assert.equal(getRuntimeConnector("hermes").healthMode, "http");
  assert.equal(resolveRuntimeHealthPath("hermes"), "/health");
  assert.equal(getRuntimeConnector("openclaw").chatTransport, "openclaw-gateway");
  assert.equal(getRuntimeConnector("zeroclaw").chatTransport, "http-message");
  assert.equal(getRuntimeConnector("zeroclaw").chatEndpoint, "/webhook");
  assert.equal(getRuntimeConnector("hermes").chatTransport, "openai-chat-completions");
  assert.equal(getRuntimeConnector("hermes").chatEndpoint, "/v1/chat/completions");
});

test("runtime connectors use env image keys (no hardcoded image defaults)", () => {
  assert.equal(getRuntimeConnector("openclaw").imageEnvVar, "RUNTIME_OPENCLAW_IMAGE");
  assert.equal(getRuntimeConnector("zeroclaw").imageEnvVar, "RUNTIME_ZEROCLAW_IMAGE");
  assert.equal(getRuntimeConnector("hermes").imageEnvVar, "RUNTIME_HERMES_IMAGE");
  assert.equal(getRuntimeConnector("openclaw").defaultImage, undefined);
  assert.equal(getRuntimeConnector("zeroclaw").defaultImage, undefined);
  assert.equal(getRuntimeConnector("hermes").defaultImage, undefined);
});

test("runtime registry exposes all supported managed runtime types", () => {
  assert.deepEqual(getRuntimeTypes(), ["openclaw", "zeroclaw", "hermes"]);
});

test("runtime normalization preserves supported types and falls back safely", () => {
  assert.equal(normalizeRuntimeType("hermes"), "hermes");
  assert.equal(normalizeRuntimeType("unknown"), "openclaw");
  assert.equal(normalizeRuntimeType("unknown", "hermes"), "hermes");
});

test("runtime capabilities are connector-driven for slack and discord support", () => {
  const openclaw = getRuntimeConnector("openclaw");
  const zeroclaw = getRuntimeConnector("zeroclaw");
  const hermes = getRuntimeConnector("hermes");

  assert.equal(openclaw.capabilities.slackBotToken, true);
  assert.equal(openclaw.capabilities.slackAppToken, true);
  assert.equal(openclaw.capabilities.discordBotToken, true);
  assert.equal(openclaw.capabilities.discordAllowedGuildIds, true);
  assert.equal(openclaw.capabilities.discordAllowedChannelIds, true);

  assert.equal(zeroclaw.capabilities.slackBotToken, false);
  assert.equal(zeroclaw.capabilities.slackAppToken, false);
  assert.equal(zeroclaw.capabilities.discordBotToken, false);

  assert.equal(hermes.capabilities.slackBotToken, true);
  assert.equal(hermes.capabilities.slackAppToken, true);
  assert.equal(hermes.capabilities.slackAllowedChannelIds, false);
  assert.equal(hermes.capabilities.slackAllowedUserIds, true);
  assert.equal(hermes.capabilities.telegramReplyInPrivate, false);
  assert.equal(hermes.capabilities.discordBotToken, true);
  assert.equal(hermes.capabilities.discordAllowedGuildIds, false);
  assert.equal(hermes.capabilities.discordAllowedChannelIds, true);
  assert.equal(hermes.capabilities.discordReplyInThread, true);
  assert.equal(hermes.capabilities.discordRequireMention, true);
});

test("runtime catalog exposes shared GUI sidecar config fields without duplicates", () => {
  const openclaw = getRuntimeConnector("openclaw");
  const zeroclaw = getRuntimeConnector("zeroclaw");
  const hermes = getRuntimeConnector("hermes");

  const catalog = buildRuntimeCatalog({
    runtimeTypes: ["openclaw", "zeroclaw", "hermes"],
    runtimeImages: {
      openclaw: "openclaw:test",
      zeroclaw: "zeroclaw:test",
      hermes: "hermes:test"
    },
    runtimeGatewayPort: 42617,
    runtimeRequirePairing: false,
    runtimeAllowPublicBind: true
  });

  const expectedGuiFieldKeys = ["gui.enabled", "gui.enableVnc", "gui.noVncPort"];
  for (const runtimeType of ["openclaw", "zeroclaw", "hermes"] as const) {
    const item = catalog.find((entry) => entry.id === runtimeType);
    assert.ok(item);
    const keys = (item.runtimeConfigFields ?? []).map((field) => field.key);
    for (const expectedKey of expectedGuiFieldKeys) {
      assert.equal(keys.includes(expectedKey), true);
    }
    assert.equal(keys.length, new Set(keys).size);
  }

  assert.deepEqual((openclaw.runtimeConfigFields ?? []).map((field) => field.key), []);
  assert.deepEqual((zeroclaw.runtimeConfigFields ?? []).map((field) => field.key), []);
  assert.deepEqual((hermes.runtimeConfigFields ?? []).map((field) => field.key), []);
});

test("buildHermes config output maps shared discord settings into native hermes config", () => {
  const configYaml = buildHermesConfigYaml({
    llm: {
      provider: "openrouter",
      model: "openai/gpt-5.3-chat",
      apiKey: "test-api-key"
    },
    telegram: {
      enabled: false,
      allowFrom: [],
      replyInPrivate: true
    },
    slack: {
      enabled: false,
      allowedChannelIds: [],
      allowedUserIds: [],
      replyInThread: true
    },
    discord: {
      enabled: true,
      botToken: "discord-token",
      allowedGuildIds: [],
      allowedChannelIds: ["D123", "D456"],
      allowedUserIds: ["284102345871466496", "198765432109876543"],
      replyInThread: false,
      requireMention: false
    },
    gatewayPort: 42617,
    gatewayAuthToken: "bearer-token"
  });
  const envFile = buildHermesEnvFile({
    llm: {
      provider: "openrouter",
      model: "openai/gpt-5.3-chat",
      apiKey: "test-api-key"
    },
    telegram: {
      enabled: false,
      allowFrom: [],
      replyInPrivate: true
    },
    slack: {
      enabled: false,
      allowedChannelIds: [],
      allowedUserIds: [],
      replyInThread: true
    },
    discord: {
      enabled: true,
      botToken: "discord-token",
      allowedGuildIds: [],
      allowedChannelIds: ["D123", "D456"],
      allowedUserIds: ["284102345871466496", "198765432109876543"],
      replyInThread: false,
      requireMention: false
    },
    gatewayPort: 42617,
    gatewayAuthToken: "bearer-token"
  });

  assert.match(configYaml, /discord:\n\s+require_mention:\s*false/u);
  assert.match(configYaml, /auto_thread:\s*false/u);
  assert.match(configYaml, /allowed_channels:\n\s+-\s*"D123"\n\s+-\s*"D456"/u);
  assert.match(envFile, /^DISCORD_BOT_TOKEN=discord-token/mu);
  assert.match(envFile, /^DISCORD_ALLOWED_USERS=284102345871466496,198765432109876543/mu);
});

test("parseCreateRuntimeInstanceInput accepts shared discord allowed users for hermes", () => {
  const parsed = parseCreateRuntimeInstanceInput(
    {
      tenantId: "tenant-1",
      agentId: "agent-1",
      runtimeType: "hermes",
      llmProvider: "openrouter",
      llmModel: "openai/gpt-5.3-chat",
      llmApiKey: "test-api-key",
      discordEnabled: true,
      discordBotToken: "discord-token",
      discordAllowedUserIds: ["284102345871466496", "198765432109876543"],
      discordAllowedChannelIds: ["D123"],
      discordReplyInThread: false,
      discordRequireMention: false
    },
    {
      runtimeProvider: "openrouter",
      runtimeModel: "openai/gpt-5.3-chat",
      runtimeApiKey: "test-api-key",
      supportedRuntimeTypes: ["openclaw", "zeroclaw", "hermes"],
      runtimeCatalog: buildRuntimeCatalog({
        runtimeTypes: ["openclaw", "zeroclaw", "hermes"],
        runtimeImages: {
          openclaw: "",
          zeroclaw: "",
          hermes: ""
        },
        runtimeGatewayPort: 42617,
        runtimeRequirePairing: false,
        runtimeAllowPublicBind: true
      }),
      runtimeGatewayPort: 42617,
      runtimeRequirePairing: false,
      runtimeAllowPublicBind: true
    }
  );

  assert.deepEqual(parsed.discordAllowedUserIds, [
    "284102345871466496",
    "198765432109876543"
  ]);
  assert.deepEqual(parsed.discordAllowedGuildIds, []);
});

test("parseRuntimeDiscordSettingsInput preserves shared discord allowed users for hermes", () => {
  const runtimeInstance: RuntimeInstance = {
    id: "runtime-1",
    tenantId: "tenant-1",
    agentId: "agent-1",
    runtimeType: "hermes",
    containerName: "container-1",
    volumeName: "volume-1",
    networkName: "network-1",
    gatewayPort: 42617,
    requirePairing: false,
    allowPublicBind: true,
    llmProvider: "openrouter",
    llmModel: "openai/gpt-5.3-chat",
    telegramEnabled: false,
    telegramAllowFrom: [],
    telegramReplyInPrivate: false,
    slackEnabled: false,
    slackAllowedChannelIds: [],
    slackAllowedUserIds: [],
    slackReplyInThread: true,
    discordEnabled: false,
    discordAllowedGuildIds: [],
    discordAllowedChannelIds: [],
    discordAllowedUserIds: [],
    discordReplyInThread: true,
    discordRequireMention: true,
    runtimeOptions: {},
    status: "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const parsed = parseRuntimeDiscordSettingsInput(
    {
      enabled: true,
      discordBotToken: "discord-token",
      discordAllowedUserIds: ["284102345871466496"],
      discordAllowedChannelIds: ["D123"],
      discordReplyInThread: false,
      discordRequireMention: false
    },
    runtimeInstance
  );

  assert.deepEqual(parsed.allowedUserIds, ["284102345871466496"]);
  assert.deepEqual(parsed.allowedGuildIds, []);
  assert.equal(parsed.replyInThread, false);
  assert.equal(parsed.requireMention, false);
});

test("runtime catalog includes hermes and resolves runtime-specific image overrides", () => {
  const catalog = buildRuntimeCatalog({
    runtimeTypes: ["openclaw", "zeroclaw", "hermes"],
    runtimeImages: {
      openclaw: "",
      zeroclaw: "",
      hermes: "hermes:custom"
    },
    runtimeGatewayPort: 42617,
    runtimeRequirePairing: true,
    runtimeAllowPublicBind: false
  });

  const hermes = catalog.find((item) => item.id === "hermes");
  assert.ok(hermes);
  assert.equal(hermes.resolvedImage, "hermes:custom");
  assert.equal(hermes.defaultGatewayPort, 42617);
  assert.equal(hermes.capabilities.chatAction, true);
  assert.equal(hermes.capabilities.slackBotToken, true);
});

test("parseRuntimeSharedFilesUploadInput accepts nested relative paths", () => {
  const parsed = parseRuntimeSharedFilesUploadInput({
    files: [
      {
        name: "guide.txt",
        relativePath: "docs/setup/guide.txt",
        contentBase64: Buffer.from("hello", "utf8").toString("base64")
      }
    ]
  });

  assert.equal(parsed.files.length, 1);
  assert.equal(parsed.files[0]?.relativePath, "docs/setup/guide.txt");
});

test("parseRuntimeSharedFilesUploadInput rejects unsafe relative paths", () => {
  assert.throws(
    () =>
      parseRuntimeSharedFilesUploadInput({
        files: [
          {
            name: "guide.txt",
            relativePath: "../guide.txt",
            contentBase64: Buffer.from("hello", "utf8").toString("base64")
          }
        ]
      }),
    /invalid relativePath/u
  );
  assert.throws(
    () =>
      parseRuntimeSharedFilesUploadInput({
        files: [
          {
            name: "guide.txt",
            relativePath: "/root/guide.txt",
            contentBase64: Buffer.from("hello", "utf8").toString("base64")
          }
        ]
      }),
    /invalid relativePath/u
  );
});

test("parseRuntimeSharedFilesUploadInput falls back to the file name when relativePath is omitted", () => {
  const parsed = parseRuntimeSharedFilesUploadInput({
    files: [
      {
        name: "archive.zip",
        contentBase64: Buffer.from("zip", "utf8").toString("base64")
      }
    ]
  });

  assert.equal(parsed.files[0]?.relativePath, "archive.zip");
});

test("parseRuntimeSharedFilesUploadInput keeps existing upload limits", () => {
  const elevenFiles = Array.from({ length: 11 }, (_, index) => ({
    name: `file-${index + 1}.txt`,
    contentBase64: Buffer.from("x", "utf8").toString("base64")
  }));
  assert.throws(
    () =>
      parseRuntimeSharedFilesUploadInput({
        files: elevenFiles
      }),
    /no more than 10 files/u
  );

  assert.throws(
    () =>
      parseRuntimeSharedFilesUploadInput({
        files: [
          {
            name: "large.bin",
            contentBase64: Buffer.alloc(5 * 1024 * 1024 + 1, 1).toString("base64")
          }
        ]
      }),
    /exceeds the 5 MB upload limit/u
  );
});

test("sanitizeRuntimeSharedRelativePath allows nested paths and rejects traversal", () => {
  assert.equal(sanitizeRuntimeSharedRelativePath("nested/folder/file.txt"), "nested/folder/file.txt");
  assert.equal(sanitizeRuntimeSharedRelativePath("nested\\folder\\file.txt"), "nested/folder/file.txt");
  assert.throws(() => sanitizeRuntimeSharedRelativePath("../file.txt"), /Invalid shared file path/u);
  assert.throws(() => sanitizeRuntimeSharedRelativePath("/file.txt"), /Invalid shared file path/u);
});
