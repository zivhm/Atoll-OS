import assert from "node:assert/strict";
import test from "node:test";

import { getAgentPresetById } from "../src/agent-presets.js";
import {
  buildHermesConfigYaml,
  buildHermesEnvFile,
  buildOpenClawConfigJson,
  buildWorkspaceSeedFiles
} from "../src/runtime.js";
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

test("buildHermes config output preserves Atoll workspace and API server settings", () => {
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

  assert.match(configYaml, /model:\s*"openrouter\/openai\/gpt-5\.3-chat"/u);
  assert.match(configYaml, /workspace:\s*"\/home\/hermes\/\.hermes\/atoll\/workspace"/u);
  assert.match(configYaml, /api_server:/u);
  assert.match(configYaml, /enabled:\s*true/u);
  assert.match(configYaml, /port:\s*42617/u);
  assert.match(configYaml, /telegram:/u);
  assert.match(configYaml, /slack:/u);
  assert.match(configYaml, /discord:/u);

  assert.match(envFile, /^OPENROUTER_API_KEY=test-api-key/mu);
  assert.match(envFile, /^API_SERVER_KEY=bearer-token/mu);
  assert.match(envFile, /^TELEGRAM_BOT_TOKEN=telegram-token/mu);
  assert.match(envFile, /^SLACK_BOT_TOKEN=xoxb-bot/mu);
  assert.match(envFile, /^SLACK_APP_TOKEN=xapp-app/mu);
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
  assert.match(seeded.toolsMarkdown, /No explicit skills were stored for this helper at creation time/u);
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

  assert.equal(hermes.mountPath, "/home/hermes/.hermes");
  assert.equal(hermes.configPath, "/hermes-data/config.yaml");
  assert.equal(hermes.workspaceDir, "/hermes-data/atoll/workspace");
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
    ["hermes:test", "hermes", "gateway", "--host", "0.0.0.0", "--port", "42617"]
  );
});

test("runtime environment adds deprecation suppression only for openclaw", () => {
  assert.deepEqual(resolveRuntimeEnvironment("openclaw"), {
    NODE_OPTIONS: "--no-deprecation"
  });
  assert.deepEqual(resolveRuntimeEnvironment("zeroclaw"), {});
  assert.deepEqual(resolveRuntimeEnvironment("hermes"), {
    HERMES_CONFIG_DIR: "/home/hermes/.hermes"
  });
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

test("runtime connectors default to the configured published images", () => {
  assert.equal(getRuntimeConnector("openclaw").defaultImage, "zivhm/openclaw");
  assert.equal(
    getRuntimeConnector("zeroclaw").defaultImage,
    "zivhm/zeroclaw-runtime"
  );
  assert.equal(getRuntimeConnector("hermes").defaultImage, "nousresearch/hermes-agent");
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
  assert.equal(hermes.capabilities.slackAppToken, false);
  assert.equal(hermes.capabilities.discordBotToken, true);
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
