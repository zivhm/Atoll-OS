import assert from "node:assert/strict";
import test from "node:test";

import { getAgentPresetById } from "../src/agent-presets.js";
import { buildOpenClawConfigJson, buildWorkspaceSeedFiles } from "../src/runtime.js";
import {
  getRuntimeConnector,
  getRuntimeDescriptor,
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

  assert.equal(openclaw.mountPath, "/home/node/.openclaw");
  assert.equal(openclaw.configPath, "/openclaw-data/openclaw.json");
  assert.equal(openclaw.workspaceDir, "/openclaw-data/workspace");

  assert.equal(zeroclaw.mountPath, "/zeroclaw-data");
  assert.equal(zeroclaw.configPath, "/zeroclaw-data/.zeroclaw/config.toml");
  assert.equal(zeroclaw.workspaceDir, "/zeroclaw-data/workspace");
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
});

test("runtime environment adds deprecation suppression only for openclaw", () => {
  assert.deepEqual(resolveRuntimeEnvironment("openclaw"), {
    NODE_OPTIONS: "--no-deprecation"
  });
  assert.deepEqual(resolveRuntimeEnvironment("zeroclaw"), {});
});

test("runtime health metadata stays connector-driven", () => {
  assert.equal(getRuntimeConnector("openclaw").healthMode, "http");
  assert.equal(resolveRuntimeHealthPath("openclaw"), "/healthz");

  assert.equal(getRuntimeConnector("zeroclaw").healthMode, "http");
  assert.equal(resolveRuntimeHealthPath("zeroclaw"), "/health");
});

test("runtime connectors default to the configured published images", () => {
  assert.equal(getRuntimeConnector("openclaw").defaultImage, "zivhm/openclaw");
  assert.equal(
    getRuntimeConnector("zeroclaw").defaultImage,
    "zivhm/zeroclaw-runtime"
  );
});
