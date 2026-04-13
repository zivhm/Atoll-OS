import { execFile, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";

import {
  getRuntimeConnector,
  getRuntimeDescriptor,
  normalizeRuntimeType,
  resolveRuntimeEnvironment,
  resolveRuntimeHealthcheckArgs,
  resolveRuntimeLaunchArgs,
  type RuntimeDescriptor,
  type RuntimeProcessMode
} from "./runtime-kind.js";
import type { RuntimeType, WorkspaceKind, WorkspaceResourceMode } from "./store.js";
import { createRuntimeVolumeIo } from "./runtime-volume-io.js";

const execFileAsync = promisify(execFile);

const DEFAULT_GATEWAY_PORT = 42617;
const CONFIG_SEED_IMAGE = "alpine:3.20";
const GUI_SIDECAR_IMAGE_ENV = "RUNTIME_GUI_SIDECAR_IMAGE";
const GUI_SIDECAR_CONTAINER_PREFIX = "atoll-gui-";
const GUI_SIDECAR_CONTAINER_ENV = "ATOLL_GUI_SIDECAR_CONTAINER";
const GUI_SIDECAR_PLAYWRIGHT_WS_ENDPOINT_ENV = "ATOLL_GUI_PLAYWRIGHT_WS_ENDPOINT";
const GUI_SIDECAR_PLAYWRIGHT_PORT = 3000;
const GUI_SIDECAR_PLAYWRIGHT_PATH = "/playwright";
const GUI_SIDECAR_NOVNC_CONTAINER_PORT = 6080;
const DEFAULT_CONTAINER_CLI = "docker";
const DEFAULT_RUNTIME_PROCESS_MODE: RuntimeProcessMode = "daemon";
const LOOPBACK_PUBLISH_HOST = "127.0.0.1";
export const SHARED_WORKSPACE_MOUNT_PATH = "/atoll-shared-workspace";
export const RUNTIME_SHARED_FILES_DIRNAME = "shared-files";
const runtimeVolumeIo = createRuntimeVolumeIo(runDockerBuffer);

export type RuntimeLlmConfig = {
  provider: string;
  model: string;
  apiKey: string;
};

export type RuntimeTelegramConfig = {
  enabled: boolean;
  botToken?: string;
  allowFrom: string[];
  replyInPrivate: boolean;
};

export type RuntimeSlackConfig = {
  enabled: boolean;
  botToken?: string;
  appToken?: string;
  allowedChannelIds: string[];
  allowedUserIds: string[];
  replyInThread: boolean;
};

export type RuntimeDiscordConfig = {
  enabled: boolean;
  botToken?: string;
  allowedUserIds?: string[];
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  replyInThread: boolean;
  requireMention?: boolean;
};

export type RuntimeWorkspaceProfile = {
  workspaceName: string;
  workspaceKind?: WorkspaceKind;
  workspaceResourceMode?: WorkspaceResourceMode;
  helperName: string;
  helperStyle?: string;
  agentType?: string;
  agentTypeName?: string;
  skills?: string[];
  sharedWorkspacePath?: string;
  presetId?: string;
  presetName?: string;
  presetSummary?: string;
  presetSourcePath?: string;
  presetIdentityMarkdown?: string;
  presetSoulMarkdown?: string;
  presetToolsMarkdown?: string;
  presetSoulTemplateMarkdown?: string;
};

export type RuntimeSharedWorkspaceMount = {
  volumeName: string;
  mountPath: string;
};

export type ProvisionRuntimeContainerInput = {
  runtimeType?: RuntimeType;
  containerName: string;
  volumeName: string;
  networkName: string;
  instanceId?: string;
  tenantId?: string;
  agentId?: string;
  identityOrgId?: string;
  createNetworkIfMissing?: boolean;
  sharedWorkspaceMount?: RuntimeSharedWorkspaceMount;
  llm: RuntimeLlmConfig;
  telegram: RuntimeTelegramConfig;
  slack: RuntimeSlackConfig;
  discord?: RuntimeDiscordConfig;
  workspaceProfile?: RuntimeWorkspaceProfile;
  image?: string;
  gatewayPort?: number;
  requirePairing?: boolean;
  allowPublicBind?: boolean;
  bearerToken?: string;
  runtimeOptions?: Record<string, unknown>;
  runtimeSecrets?: Record<string, string>;
};

export type WriteRuntimeConfigInput = {
  runtimeType?: RuntimeType;
  volumeName: string;
  llm: RuntimeLlmConfig;
  telegram: RuntimeTelegramConfig;
  slack: RuntimeSlackConfig;
  discord?: RuntimeDiscordConfig;
  workspaceProfile?: RuntimeWorkspaceProfile;
  gatewayPort?: number;
  requirePairing?: boolean;
  allowPublicBind?: boolean;
  bearerToken?: string;
  runtimeOptions?: Record<string, unknown>;
  runtimeSecrets?: Record<string, string>;
};

export type RuntimeOps = {
  provisionRuntimeContainer: (input: ProvisionRuntimeContainerInput) => Promise<void>;
  writeRuntimeConfig: (input: WriteRuntimeConfigInput) => Promise<void>;
  restartRuntimeContainer: (containerName: string) => Promise<void>;
  startRuntimeContainer: (containerName: string) => Promise<void>;
  stopRuntimeContainer: (containerName: string) => Promise<void>;
  readRuntimeContainerLogs: (containerName: string, tail?: number) => Promise<string>;
  getRuntimePairingInfo: (containerName: string) => Promise<RuntimePairingInfo>;
  getRuntimeEnvironmentDiagnostics: (
    input: RuntimeEnvironmentDiagnosticsInput
  ) => Promise<RuntimeEnvironmentDiagnostics>;
  destroyRuntimeContainer: (input: {
    containerName: string;
    volumeName: string;
    destroyVolume?: boolean;
  }) => Promise<void>;
  reconcileRuntimeGuiSidecar?: (input: {
    runtimeType?: RuntimeType;
    containerName: string;
    volumeName: string;
    networkName: string;
    sharedWorkspaceMount?: RuntimeSharedWorkspaceMount;
    runtimeOptions?: Record<string, unknown>;
  }) => Promise<void>;
  listManagedRuntimeContainers?: () => Promise<ManagedRuntimeContainer[]>;
  readRuntimeBearerToken?: (input: {
    runtimeType?: RuntimeType;
    volumeName: string;
  }) => Promise<string | undefined>;
  readRuntimeIdentity?: (input: {
    runtimeType?: RuntimeType;
    volumeName: string;
  }) => Promise<RuntimeRecoveredIdentity | undefined>;
  listRuntimeSharedFiles?: (input: {
    runtimeType?: RuntimeType;
    volumeName: string;
  }) => Promise<RuntimeSharedFile[]>;
  readRuntimeSharedFile?: (input: {
    runtimeType?: RuntimeType;
    volumeName: string;
    relativePath: string;
  }) => Promise<{ fileName: string; content: Buffer }>;
  writeRuntimeSharedFile?: (input: {
    runtimeType?: RuntimeType;
    volumeName: string;
    fileName: string;
    content: Buffer;
  }) => Promise<RuntimeSharedFile>;
  deleteRuntimeSharedFile?: (input: {
    runtimeType?: RuntimeType;
    volumeName: string;
    relativePath: string;
  }) => Promise<void>;
};

export type RuntimePairingInfo = {
  pairingCode?: string;
  message: string;
  logExcerpt?: string;
};

export type RuntimeEnvironmentDiagnosticsInput = {
  image: string;
  network: string;
  containerName?: string;
};

export type RuntimeEnvironmentDiagnostics = {
  containerCli: string;
  processMode: "daemon" | "gateway";
  image: {
    name: string;
    status: "present" | "missing";
    message: string;
  };
  network: {
    name: string;
    status: "present" | "missing";
    message: string;
  };
  container?: {
    name: string;
    status: "reachable" | "unreachable";
    running: boolean;
    message: string;
  };
};

export type ManagedRuntimeContainer = {
  id: string;
  name: string;
  image: string;
  status: string;
  running: boolean;
  command: string[];
  labels: Record<string, string>;
  mounts: Array<{
    type: string;
    name?: string;
    destination: string;
  }>;
  networkNames: string[];
  networkIps?: Record<string, string>;
  hostPorts: number[];
  exposedPorts: number[];
};

export type RuntimeRecoveredIdentity = {
  helperName?: string;
  workspaceName?: string;
  roleTitle?: string;
  presetName?: string;
};

export type RuntimeSharedFile = {
  id: string;
  name: string;
  relativePath: string;
  sizeBytes: number;
  uploadedAt: string;
};

export const runtimeOps: RuntimeOps = {
  provisionRuntimeContainer,
  writeRuntimeConfig,
  restartRuntimeContainer,
  startRuntimeContainer,
  stopRuntimeContainer,
  readRuntimeContainerLogs,
  getRuntimePairingInfo,
  getRuntimeEnvironmentDiagnostics,
  destroyRuntimeContainer,
  listManagedRuntimeContainers,
  readRuntimeBearerToken,
  readRuntimeIdentity,
  listRuntimeSharedFiles,
  readRuntimeSharedFile,
  writeRuntimeSharedFile,
  deleteRuntimeSharedFile,
  reconcileRuntimeGuiSidecar
};

export async function provisionRuntimeContainer(input: ProvisionRuntimeContainerInput): Promise<void> {
  const runtimeType = normalizeRuntimeType(input.runtimeType);
  const connector = getRuntimeConnector(runtimeType);
  const descriptor = getRuntimeDescriptor(runtimeType);
  const createNetworkIfMissing = input.createNetworkIfMissing ?? true;
  const image =
    input.image?.trim() ||
    connector.defaultImage ||
    resolveDefaultRuntimeImage(runtimeType);
  const gatewayPort = input.gatewayPort ?? connector.defaultGatewayPort ?? DEFAULT_GATEWAY_PORT;
  const allowPublicBind = input.allowPublicBind ?? true;
  const runtimeProcessMode = getRuntimeProcessMode();
  const sidecarContainerName = resolveRuntimeGuiSidecarContainerName(input.containerName);
  const sidecarPlaywrightWsEndpoint = resolveRuntimeGuiPlaywrightWsEndpoint(sidecarContainerName);

  if (createNetworkIfMissing) {
    await ensureRuntimeNetwork(input.networkName);
  } else {
    await runDocker(["network", "inspect", input.networkName], `inspect network ${input.networkName}`);
  }
  await runDocker(["volume", "create", input.volumeName], `create volume ${input.volumeName}`);
  if (input.sharedWorkspaceMount?.volumeName) {
    await runDocker(
      ["volume", "create", input.sharedWorkspaceMount.volumeName],
      `create volume ${input.sharedWorkspaceMount.volumeName}`
    );
  }

  await writeRuntimeConfig({
    runtimeType,
    volumeName: input.volumeName,
    llm: input.llm,
    telegram: input.telegram,
    slack: input.slack,
    workspaceProfile: input.workspaceProfile,
    gatewayPort,
    requirePairing: input.requirePairing,
    allowPublicBind: input.allowPublicBind,
    bearerToken: input.bearerToken,
    runtimeOptions: input.runtimeOptions,
    runtimeSecrets: input.runtimeSecrets
  });

  await runDocker(
    ["rm", "-f", input.containerName],
    `remove stale container ${input.containerName}`,
    true
  );

  const runArgs = [
    "run",
    "-d",
    "--name",
    input.containerName,
    "--network",
    input.networkName,
    "--restart",
    "unless-stopped"
  ];

  runArgs.push("-v", `${input.volumeName}:${descriptor.mountPath}`);
  if (input.sharedWorkspaceMount?.volumeName) {
    runArgs.push(
      "-v",
      `${input.sharedWorkspaceMount.volumeName}:${input.sharedWorkspaceMount.mountPath}`
    );
  }

  if (allowPublicBind) {
    runArgs.push("-p", `${LOOPBACK_PUBLISH_HOST}:${gatewayPort}:${gatewayPort}`);
  }

  runArgs.push(...resolveRuntimeHealthcheckArgs(runtimeType, gatewayPort));

  const labels = buildAtollRuntimeLabels(input, runtimeType, gatewayPort);
  for (const [key, value] of Object.entries(labels)) {
    runArgs.push("--label", `${key}=${value}`);
  }

  const runtimeEnvironment = resolveRuntimeEnvironment(runtimeType);
  for (const [key, value] of Object.entries(runtimeEnvironment)) {
    runArgs.push("-e", `${key}=${value}`);
  }
  runArgs.push("-e", `${GUI_SIDECAR_CONTAINER_ENV}=${sidecarContainerName}`);
  runArgs.push("-e", `${GUI_SIDECAR_PLAYWRIGHT_WS_ENDPOINT_ENV}=${sidecarPlaywrightWsEndpoint}`);

  runArgs.push(
    ...resolveRuntimeLaunchArgs(runtimeType, {
      image,
      gatewayPort,
      processMode: runtimeProcessMode
    })
  );

  await runDocker(runArgs, `start runtime container ${input.containerName}`);
  await reconcileRuntimeGuiSidecar({
    runtimeType,
    containerName: input.containerName,
    volumeName: input.volumeName,
    networkName: input.networkName,
    sharedWorkspaceMount: input.sharedWorkspaceMount,
    runtimeOptions: input.runtimeOptions
  });
}

export async function writeRuntimeConfig(input: WriteRuntimeConfigInput): Promise<void> {
  const runtimeType = normalizeRuntimeType(input.runtimeType);
  const connector = getRuntimeConnector(runtimeType);
  const descriptor = getRuntimeDescriptor(runtimeType);
  const gatewayPort = input.gatewayPort ?? connector.defaultGatewayPort ?? DEFAULT_GATEWAY_PORT;
  const requirePairing = input.requirePairing ?? true;
  const allowPublicBind = input.allowPublicBind ?? true;
  const workspaceSeed = resolveWorkspaceSeedFiles(runtimeType, input.workspaceProfile);
  const identityMarkdown = workspaceSeed.identityMarkdown;
  const soulMarkdown = workspaceSeed.soulMarkdown;
  const userMarkdown = workspaceSeed.userMarkdown;
  const toolsMarkdown = workspaceSeed.toolsMarkdown;
  const identityMarkdownB64 = Buffer.from(identityMarkdown, "utf8").toString("base64");
  const soulMarkdownB64 = Buffer.from(soulMarkdown, "utf8").toString("base64");
  const userMarkdownB64 = Buffer.from(userMarkdown, "utf8").toString("base64");
  const toolsMarkdownB64 = Buffer.from(toolsMarkdown, "utf8").toString("base64");
  const soulOnboardingAddonMarkdownB64 = Buffer.from(
    buildSoulOnboardingAddonMarkdown(),
    "utf8"
  ).toString("base64");
  const userOnboardingAddonMarkdownB64 = Buffer.from(
    buildUserOnboardingAddonMarkdown(),
    "utf8"
  ).toString("base64");
  const integrationsJsonB64 = Buffer.from(
    buildRuntimeIntegrationsSnapshotJson({
      llm: input.llm,
      telegram: input.telegram,
      slack: input.slack,
      discord: input.discord
    }),
    "utf8"
  ).toString("base64");

  validateRuntimeConfigInput(input.llm, input.telegram, input.slack, input.discord);

  if (runtimeType === "openclaw") {
    const runtimeConfigJson = buildOpenClawConfigJson({
      llm: input.llm,
      telegram: input.telegram,
      slack: input.slack,
      discord: input.discord,
      gatewayPort,
      gatewayAuthToken: input.bearerToken
    });
    const runtimeConfigB64 = Buffer.from(runtimeConfigJson, "utf8").toString("base64");
    const openClawSeedCommands = buildRuntimeSeedCommands({
      descriptor,
      appendSoulOnboarding: workspaceSeed.appendSoulOnboarding
    }).join(" && ");

    await runDocker(
      [
        "run",
        "--rm",
        "--entrypoint",
        "sh",
        "-v",
        `${input.volumeName}:${descriptor.dataRoot}`,
        "-e",
        `ATOLL_RUNTIME_CONFIG_B64=${runtimeConfigB64}`,
        "-e",
        `ATOLL_RUNTIME_IDENTITY_B64=${identityMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_SOUL_B64=${soulMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_USER_B64=${userMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_TOOLS_B64=${toolsMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_SOUL_ONBOARDING_B64=${soulOnboardingAddonMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_USER_ONBOARDING_B64=${userOnboardingAddonMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_INTEGRATIONS_B64=${integrationsJsonB64}`,
        CONFIG_SEED_IMAGE,
        "-c",
        openClawSeedCommands
      ],
      `seed runtime config for volume ${input.volumeName}`
    );
    return;
  }

  if (runtimeType === "hermes") {
    const runtimeConfigYaml = buildHermesConfigYaml({
      llm: input.llm,
      telegram: input.telegram,
      slack: input.slack,
      discord: input.discord,
      gatewayPort,
      gatewayAuthToken: input.bearerToken,
      runtimeOptions: input.runtimeOptions,
      runtimeSecrets: input.runtimeSecrets
    });
    const runtimeEnvFile = buildHermesEnvFile({
      llm: input.llm,
      telegram: input.telegram,
      slack: input.slack,
      discord: input.discord,
      gatewayPort,
      gatewayAuthToken: input.bearerToken,
      runtimeOptions: input.runtimeOptions,
      runtimeSecrets: input.runtimeSecrets
    });
    const runtimeConfigB64 = Buffer.from(runtimeConfigYaml, "utf8").toString("base64");
    const runtimeEnvB64 = Buffer.from(runtimeEnvFile, "utf8").toString("base64");
    const hermesSeedCommands = buildRuntimeSeedCommands({
      descriptor,
      appendSoulOnboarding: workspaceSeed.appendSoulOnboarding,
      extraFiles: [
        {
          envVar: "ATOLL_RUNTIME_ENV_B64",
          filePath: `${descriptor.dataRoot}/.env`
        }
      ]
    }).join(" && ");

    await runDocker(
      [
        "run",
        "--rm",
        "--entrypoint",
        "sh",
        "-v",
        `${input.volumeName}:${descriptor.dataRoot}`,
        "-e",
        `ATOLL_RUNTIME_CONFIG_B64=${runtimeConfigB64}`,
        "-e",
        `ATOLL_RUNTIME_ENV_B64=${runtimeEnvB64}`,
        "-e",
        `ATOLL_RUNTIME_IDENTITY_B64=${identityMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_SOUL_B64=${soulMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_USER_B64=${userMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_TOOLS_B64=${toolsMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_SOUL_ONBOARDING_B64=${soulOnboardingAddonMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_USER_ONBOARDING_B64=${userOnboardingAddonMarkdownB64}`,
        "-e",
        `ATOLL_RUNTIME_INTEGRATIONS_B64=${integrationsJsonB64}`,
        CONFIG_SEED_IMAGE,
        "-c",
        hermesSeedCommands
      ],
      `seed runtime config for volume ${input.volumeName}`
    );
    return;
  }

  const runtimeConfigToml = buildRuntimeConfigToml({
    llm: input.llm,
    telegram: input.telegram,
    gatewayPort,
    requirePairing,
    allowPublicBind,
    bearerToken: input.bearerToken
  });
  const runtimeConfigB64 = Buffer.from(runtimeConfigToml, "utf8").toString("base64");
  const zeroclawSeedCommands = buildRuntimeSeedCommands({
    descriptor,
    appendSoulOnboarding: workspaceSeed.appendSoulOnboarding
  }).join(" && ");

  await runDocker(
    [
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      "-v",
      `${input.volumeName}:${descriptor.dataRoot}`,
      "-e",
      `ATOLL_RUNTIME_CONFIG_B64=${runtimeConfigB64}`,
      "-e",
      `ATOLL_RUNTIME_IDENTITY_B64=${identityMarkdownB64}`,
      "-e",
      `ATOLL_RUNTIME_SOUL_B64=${soulMarkdownB64}`,
      "-e",
      `ATOLL_RUNTIME_USER_B64=${userMarkdownB64}`,
      "-e",
      `ATOLL_RUNTIME_TOOLS_B64=${toolsMarkdownB64}`,
      "-e",
      `ATOLL_RUNTIME_SOUL_ONBOARDING_B64=${soulOnboardingAddonMarkdownB64}`,
      "-e",
      `ATOLL_RUNTIME_USER_ONBOARDING_B64=${userOnboardingAddonMarkdownB64}`,
      "-e",
      `ATOLL_RUNTIME_INTEGRATIONS_B64=${integrationsJsonB64}`,
      CONFIG_SEED_IMAGE,
      "-c",
      zeroclawSeedCommands
    ],
    `seed runtime config for volume ${input.volumeName}`
  );
}

export async function restartRuntimeContainer(containerName: string): Promise<void> {
  await runDocker(["restart", containerName], `restart container ${containerName}`);
  const sidecarContainerName = resolveRuntimeGuiSidecarContainerName(containerName);
  await runDocker(["restart", sidecarContainerName], `restart GUI sidecar ${sidecarContainerName}`, true);
}

export async function startRuntimeContainer(containerName: string): Promise<void> {
  await runDocker(["start", containerName], `start container ${containerName}`);
  const sidecarContainerName = resolveRuntimeGuiSidecarContainerName(containerName);
  await runDocker(["start", sidecarContainerName], `start GUI sidecar ${sidecarContainerName}`, true);
}

export async function stopRuntimeContainer(containerName: string): Promise<void> {
  await runDocker(["stop", containerName], `stop container ${containerName}`);
  const sidecarContainerName = resolveRuntimeGuiSidecarContainerName(containerName);
  await runDocker(["stop", sidecarContainerName], `stop GUI sidecar ${sidecarContainerName}`, true);
}

export async function readRuntimeContainerLogs(containerName: string, tail = 250): Promise<string> {
  const cli = getContainerCli();
  const safeTail = Number.isFinite(tail) ? Math.max(1, Math.min(Math.floor(tail), 1000)) : 250;

  try {
    const { stdout, stderr } = await execFileAsync(cli, ["logs", "--tail", String(safeTail), containerName], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    });
    return `${stdout ?? ""}\n${stderr ?? ""}`.trim();
  } catch (error) {
    const message = formatExecError(error);
    throw new Error(`Failed to read runtime container logs: ${message}`);
  }
}

export async function getRuntimePairingInfo(containerName: string): Promise<RuntimePairingInfo> {
  const cli = getContainerCli();
  try {
    const { stdout, stderr } = await execFileAsync(cli, ["logs", "--tail", "250", containerName], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    });
    const combined = `${stdout ?? ""}\n${stderr ?? ""}`.trim();
    const pairingCode = extractPairingCode(combined);

    if (pairingCode) {
      return {
        pairingCode,
        message: `Use pairing code ${pairingCode} and click Pair.`,
        logExcerpt: clipText(combined, 1200)
      };
    }

    return {
      message: "Pairing code not found in recent runtime logs yet. Wait a few seconds and retry.",
      logExcerpt: clipText(combined, 1200)
    };
  } catch (error) {
    const message = formatExecError(error);
    throw new Error(`Failed to read runtime logs for pairing: ${message}`);
  }
}

export async function destroyRuntimeContainer(input: {
  containerName: string;
  volumeName: string;
  destroyVolume?: boolean;
}): Promise<void> {
  const sidecarContainerName = resolveRuntimeGuiSidecarContainerName(input.containerName);
  await runDocker(["rm", "-f", sidecarContainerName], `remove GUI sidecar ${sidecarContainerName}`, true);
  await runDocker(["rm", "-f", input.containerName], `remove container ${input.containerName}`, true);
  if (input.destroyVolume ?? true) {
    await runDocker(["volume", "rm", input.volumeName], `remove volume ${input.volumeName}`, true);
  }
}

export async function reconcileRuntimeGuiSidecar(input: {
  runtimeType?: RuntimeType;
  containerName: string;
  volumeName: string;
  networkName: string;
  sharedWorkspaceMount?: RuntimeSharedWorkspaceMount;
  runtimeOptions?: Record<string, unknown>;
}): Promise<void> {
  const settings = resolveRuntimeGuiSidecarSettings(input.runtimeOptions);
  const sidecarContainerName = resolveRuntimeGuiSidecarContainerName(input.containerName);

  await runDocker(["rm", "-f", sidecarContainerName], `remove stale GUI sidecar ${sidecarContainerName}`, true);
  if (!settings.enabled) {
    return;
  }

  const runtimeType = normalizeRuntimeType(input.runtimeType);
  const descriptor = getRuntimeDescriptor(runtimeType);
  const sidecarImage = resolveRuntimeGuiSidecarImage();
  const runArgs = [
    "run",
    "-d",
    "--name",
    sidecarContainerName,
    "--network",
    input.networkName,
    "--restart",
    "unless-stopped",
    "--label",
    "atoll.managed=true",
    "--label",
    "atoll.role=runtime-gui-sidecar",
    "--label",
    `atoll.runtimeType=${runtimeType}`,
    "--label",
    `atoll.runtimeContainer=${input.containerName}`,
    "-v",
    `${input.volumeName}:${descriptor.dataRoot}`,
    "-e",
    `ATOLL_GUI_RUNTIME_TYPE=${runtimeType}`,
    "-e",
    `ATOLL_GUI_RUNTIME_WORKSPACE=${descriptor.workspaceDir}`,
    "-e",
    `ATOLL_GUI_SIDECAR_PLAYWRIGHT_PORT=${GUI_SIDECAR_PLAYWRIGHT_PORT}`,
    "-e",
    `ATOLL_GUI_SIDECAR_PLAYWRIGHT_PATH=${GUI_SIDECAR_PLAYWRIGHT_PATH}`
  ];

  if (input.sharedWorkspaceMount?.volumeName) {
    runArgs.push(
      "-v",
      `${input.sharedWorkspaceMount.volumeName}:${input.sharedWorkspaceMount.mountPath}`
    );
  }

  if (settings.enableVnc) {
    runArgs.push("-e", "ATOLL_GUI_SIDECAR_ENABLE_VNC=1");
    if (settings.noVncPort !== undefined) {
      runArgs.push(
        "-p",
        `${LOOPBACK_PUBLISH_HOST}:${settings.noVncPort}:${GUI_SIDECAR_NOVNC_CONTAINER_PORT}`
      );
    }
  }

  runArgs.push(sidecarImage);
  await runDocker(runArgs, `start GUI sidecar ${sidecarContainerName}`);
}

export async function listRuntimeSharedFiles(input: {
  runtimeType?: RuntimeType;
  volumeName: string;
}): Promise<RuntimeSharedFile[]> {
  const runtimeType = normalizeRuntimeType(input.runtimeType);
  const items = await readRuntimeSharedFilesManifest({
    runtimeType,
    volumeName: input.volumeName
  });
  return items.sort((left, right) => left.name.localeCompare(right.name));
}

export async function readRuntimeSharedFile(input: {
  runtimeType?: RuntimeType;
  volumeName: string;
  relativePath: string;
}): Promise<{ fileName: string; content: Buffer }> {
  const runtimeType = normalizeRuntimeType(input.runtimeType);
  const descriptor = getRuntimeDescriptor(runtimeType);
  const relativePath = sanitizeRuntimeSharedRelativePath(input.relativePath);
  const sharedFilesDir = getRuntimeSharedFilesDir(runtimeType);
  const result = await runtimeVolumeIo.readFile({
    volumeName: input.volumeName,
    mountPath: descriptor.dataRoot,
    filePath: `${sharedFilesDir}/${relativePath}`,
    label: `read runtime shared file ${input.volumeName}/${relativePath}`
  });

  if (!result.found) {
    throw new Error(`Shared file ${relativePath} not found`);
  }

  return {
    fileName: relativePath,
    content: result.content
  };
}

export async function writeRuntimeSharedFile(input: {
  runtimeType?: RuntimeType;
  volumeName: string;
  fileName: string;
  content: Buffer;
}): Promise<RuntimeSharedFile> {
  const runtimeType = normalizeRuntimeType(input.runtimeType);
  const descriptor = getRuntimeDescriptor(runtimeType);
  const fileName = sanitizeRuntimeSharedFileName(input.fileName);
  const sharedFilesDir = getRuntimeSharedFilesDir(runtimeType);
  const uploadedAt = new Date().toISOString();

  await runtimeVolumeIo.writeFile({
    volumeName: input.volumeName,
    mountPath: descriptor.dataRoot,
    filePath: `${sharedFilesDir}/${fileName}`,
    content: input.content,
    label: `write runtime shared file ${input.volumeName}/${fileName}`
  });

  const nextItem: RuntimeSharedFile = {
    id: fileName,
    name: fileName,
    relativePath: fileName,
    sizeBytes: input.content.byteLength,
    uploadedAt
  };
  const currentItems = await readRuntimeSharedFilesManifest({
    runtimeType,
    volumeName: input.volumeName
  });
  const nextItems = [...currentItems.filter((item) => item.relativePath !== fileName), nextItem];
  await writeRuntimeSharedFilesManifest({
    runtimeType,
    volumeName: input.volumeName,
    items: nextItems
  });
  return nextItem;
}

export async function deleteRuntimeSharedFile(input: {
  runtimeType?: RuntimeType;
  volumeName: string;
  relativePath: string;
}): Promise<void> {
  const runtimeType = normalizeRuntimeType(input.runtimeType);
  const descriptor = getRuntimeDescriptor(runtimeType);
  const relativePath = sanitizeRuntimeSharedRelativePath(input.relativePath);
  const sharedFilesDir = getRuntimeSharedFilesDir(runtimeType);

  await runtimeVolumeIo.deleteFile({
    volumeName: input.volumeName,
    mountPath: descriptor.dataRoot,
    filePath: `${sharedFilesDir}/${relativePath}`,
    label: `delete runtime shared file ${input.volumeName}/${relativePath}`
  });

  const currentItems = await readRuntimeSharedFilesManifest({
    runtimeType,
    volumeName: input.volumeName
  });
  await writeRuntimeSharedFilesManifest({
    runtimeType,
    volumeName: input.volumeName,
    items: currentItems.filter((item) => item.relativePath !== relativePath)
  });
}

export async function getRuntimeEnvironmentDiagnostics(
  input: RuntimeEnvironmentDiagnosticsInput
): Promise<RuntimeEnvironmentDiagnostics> {
  const imageName = input.image.trim();
  if (!imageName) {
    throw new Error("Runtime diagnostics requires a non-empty image name.");
  }
  const networkName = input.network.trim();
  const containerName = input.containerName?.trim();

  const imageProbe = await probeDocker(["image", "inspect", imageName], `inspect image ${imageName}`);
  let networkProbe = await probeDocker(["network", "inspect", networkName], `inspect network ${networkName}`);
  if (!networkProbe.ok && networkName) {
    try {
      await ensureRuntimeNetwork(networkName);
      networkProbe = await probeDocker(["network", "inspect", networkName], `inspect network ${networkName}`);
    } catch (error) {
      networkProbe = {
        ok: false,
        output: "",
        message: `${networkProbe.message}; auto-create failed: ${formatExecError(error)}`
      };
    }
  }

  const diagnostics: RuntimeEnvironmentDiagnostics = {
    containerCli: getContainerCli(),
    processMode: getRuntimeProcessMode(),
    image: {
      name: imageName,
      status: imageProbe.ok ? "present" : "missing",
      message: imageProbe.ok ? "image is present" : imageProbe.message
    },
    network: {
      name: networkName,
      status: networkProbe.ok ? "present" : "missing",
      message: networkProbe.ok ? "network is present" : networkProbe.message
    }
  };

  if (!containerName) {
    return diagnostics;
  }

  const containerProbe = await probeDocker(
    ["inspect", "-f", "{{.State.Running}}", containerName],
    `inspect container ${containerName}`
  );
  const running = containerProbe.ok && containerProbe.output.trim().toLowerCase() === "true";

  diagnostics.container = {
    name: containerName,
    status: running ? "reachable" : "unreachable",
    running,
    message: containerProbe.ok
      ? running
        ? "container is running"
        : "container exists but is not running"
      : containerProbe.message
  };

  return diagnostics;
}

export async function listManagedRuntimeContainers(): Promise<ManagedRuntimeContainer[]> {
  const listProbe = await probeDocker(
    ["ps", "-a", "--filter", "name=^atoll-rt-", "--format", "{{.ID}}"],
    "list runtime containers"
  );
  if (!listProbe.ok) {
    throw new Error(`Container CLI command failed (list runtime containers): ${listProbe.message}`);
  }

  const ids = listProbe.output
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return [];
  }

  const inspectProbe = await probeDocker(["inspect", ...ids], "inspect runtime containers");
  if (!inspectProbe.ok) {
    throw new Error(`Container CLI command failed (inspect runtime containers): ${inspectProbe.message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(inspectProbe.output) as unknown;
  } catch (error) {
    const message = formatExecError(error);
    throw new Error(`Failed to parse runtime container inspection payload: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((value) => parseManagedContainerInspection(value))
    .filter((value): value is ManagedRuntimeContainer => Boolean(value));
}

export async function readRuntimeIdentity(input: {
  runtimeType?: RuntimeType;
  volumeName: string;
}): Promise<RuntimeRecoveredIdentity | undefined> {
  const runtimeType = normalizeRuntimeType(input.runtimeType);
  const descriptor = getRuntimeDescriptor(runtimeType);
  const workspaceIdentityPath = resolveMountedRuntimePath(
    descriptor,
    `${descriptor.workspaceDir}/IDENTITY.md`
  );
  const output = await runDocker(
    [
      "run",
      "--rm",
      "-v",
      `${input.volumeName}:${descriptor.mountPath}:ro`,
      "--entrypoint",
      "sh",
      CONFIG_SEED_IMAGE,
      "-lc",
      `if [ -f ${toShellSingleQuoted(workspaceIdentityPath)} ]; then cat ${toShellSingleQuoted(workspaceIdentityPath)}; fi`
    ],
    `read runtime identity ${input.volumeName}`,
    true
  );
  return parseRuntimeIdentityMarkdown(output);
}

export function buildOpenClawConfigJson(input: {
  llm: RuntimeLlmConfig;
  telegram: RuntimeTelegramConfig;
  slack: RuntimeSlackConfig;
  discord?: RuntimeDiscordConfig;
  gatewayPort: number;
  gatewayAuthToken?: string;
}): string {
  const providerApiKeyEnv = resolveProviderApiKeyEnvName(input.llm.provider);
  const config: Record<string, unknown> = {
    gateway: {
      mode: "local",
      bind: "lan",
      port: input.gatewayPort,
      auth: input.gatewayAuthToken?.trim()
        ? {
            mode: "token",
            token: input.gatewayAuthToken.trim()
          }
        : undefined
    },
    agents: {
      defaults: {
        workspace: "~/.openclaw/workspace",
        model: {
          primary: resolveOpenClawModelReference(input.llm.provider, input.llm.model)
        }
      }
    }
  };

  if (providerApiKeyEnv) {
    config.env = {
      vars: {
        [providerApiKeyEnv]: input.llm.apiKey
      }
    };
  }

  const channels: Record<string, unknown> = {};

  if (input.telegram.enabled && input.telegram.botToken?.trim()) {
    const allowFrom = input.telegram.allowFrom.length > 0 ? input.telegram.allowFrom : ["*"];
    channels.telegram = {
      enabled: true,
      botToken: input.telegram.botToken.trim(),
      allowFrom,
      dmPolicy: allowFrom.includes("*") ? "open" : "allowlist"
    };
  }

  if (input.slack.enabled && input.slack.botToken?.trim() && input.slack.appToken?.trim()) {
    const allowedChannelIds = input.slack.allowedChannelIds
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const allowedUserIds = input.slack.allowedUserIds
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const channelsPolicy =
      allowedChannelIds.length > 0
        ? Object.fromEntries(
            allowedChannelIds.map((channelId) => [
              channelId,
              {
                allow: true,
                requireMention: true
              }
            ])
          )
        : {};

    channels.slack = {
      enabled: true,
      mode: "socket",
      appToken: input.slack.appToken.trim(),
      botToken: input.slack.botToken.trim(),
      dmPolicy: "pairing",
      ...(allowedUserIds.length > 0 ? { allowFrom: allowedUserIds } : {}),
      groupPolicy: "allowlist",
      channels: channelsPolicy,
      replyToMode: input.slack.replyInThread ? "first" : "off",
      ...(input.slack.replyInThread
        ? {
            replyToModeByChatType: {
              direct: "all",
              group: "first",
              channel: "first"
            }
          }
        : {})
    };
  }

  const discord = resolveRuntimeDiscordConfig(input.discord);
  if (discord.enabled && discord.botToken?.trim()) {
    const allowedGuildIds = discord.allowedGuildIds
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const allowedChannelIds = discord.allowedChannelIds
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const hasGuildAllowlist = allowedGuildIds.length > 0;
    const hasChannelAllowlist = allowedChannelIds.length > 0;
    const shouldAllowAllGroups = !hasGuildAllowlist && !hasChannelAllowlist;
    const guilds =
      allowedGuildIds.length > 0
        ? Object.fromEntries(
            allowedGuildIds.map((guildId) => [
              guildId,
              {
                requireMention: discord.requireMention,
                ...(allowedChannelIds.length > 0
                  ? {
                      channels: Object.fromEntries(
                        allowedChannelIds.map((channelId) => [
                          channelId,
                          {
                            allow: true,
                            requireMention: discord.requireMention
                          }
                        ])
                      )
                    }
                  : {})
              }
            ])
          )
        : {};
    channels.discord = {
      enabled: true,
      token: discord.botToken.trim(),
      dmPolicy: "pairing",
      allowBots: false,
      groupPolicy: shouldAllowAllGroups ? "open" : "allowlist",
      ...(Object.keys(guilds).length > 0 ? { guilds } : {}),
      replyToMode: discord.replyInThread ? "first" : "off"
    };
  }

  if (Object.keys(channels).length > 0) {
    config.channels = channels;
  }

  return `${JSON.stringify(config, null, 2)}\n`;
}

export function buildHermesConfigYaml(input: {
  llm: RuntimeLlmConfig;
  telegram: RuntimeTelegramConfig;
  slack: RuntimeSlackConfig;
  discord?: RuntimeDiscordConfig;
  gatewayPort: number;
  gatewayAuthToken?: string;
  runtimeOptions?: Record<string, unknown>;
  runtimeSecrets?: Record<string, string>;
}): string {
  const hermesDiscord = resolveHermesDiscordConfig(resolveRuntimeDiscordConfig(input.discord));
  const modelReference = resolveHermesModelReference(input.llm.provider, input.llm.model);
  const modelProvider = resolveHermesProviderName(input.llm.provider);
  const lines = [
    "model:",
    `  default: ${toYamlString(modelReference)}`,
    `  provider: ${toYamlString(modelProvider)}`,
    ...resolveHermesBaseUrlLine(input.llm.provider),
    "terminal:",
    `  backend: ${toYamlString("local")}`,
    `  cwd: ${toYamlString("/opt/data/atoll/workspace")}`,
    "  timeout: 180",
    `  docker_mount_cwd_to_workspace: ${toYamlBoolean(false)}`,
    "  lifetime_seconds: 300"
  ];

  if (input.slack.enabled) {
    lines.push(
      "platforms:",
      "  slack:",
      `    reply_to_mode: ${toYamlString(input.slack.replyInThread ? "first" : "off")}`,
      "    extra:",
      `      reply_in_thread: ${toYamlBoolean(input.slack.replyInThread)}`
    );
  }

  if (hermesDiscord.enabled) {
    if (!input.slack.enabled) {
      lines.push("platforms:");
    }
    lines.push(
      "  discord:",
      `    reply_to_mode: ${toYamlString(hermesDiscord.autoThread ? "first" : "off")}`,
      "discord:",
      `  require_mention: ${toYamlBoolean(hermesDiscord.requireMention)}`,
      `  auto_thread: ${toYamlBoolean(hermesDiscord.autoThread)}`
    );
    if (hermesDiscord.allowedChannels.length > 0) {
      lines.push("  allowed_channels:");
      for (const channelId of hermesDiscord.allowedChannels) {
        lines.push(`    - ${toYamlString(channelId)}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

export function buildHermesEnvFile(input: {
  llm: RuntimeLlmConfig;
  telegram: RuntimeTelegramConfig;
  slack: RuntimeSlackConfig;
  discord?: RuntimeDiscordConfig;
  gatewayPort: number;
  gatewayAuthToken?: string;
  runtimeOptions?: Record<string, unknown>;
  runtimeSecrets?: Record<string, string>;
}): string {
  const providerApiKeyEnv = resolveProviderApiKeyEnvName(input.llm.provider);
  const hermesDiscord = resolveHermesDiscordConfig(resolveRuntimeDiscordConfig(input.discord));
  const modelReference = resolveHermesModelReference(input.llm.provider, input.llm.model);
  const lines = [
    "API_SERVER_ENABLED=true",
    "API_SERVER_HOST=0.0.0.0",
    `API_SERVER_PORT=${input.gatewayPort}`,
    `API_SERVER_KEY=${(input.gatewayAuthToken?.trim() || "atoll-hermes-token").replaceAll("\n", "")}`,
    `API_SERVER_MODEL_NAME=${modelReference}`,
    "MESSAGING_CWD=/opt/data/atoll/workspace"
  ];

  if (providerApiKeyEnv) {
    lines.push(`${providerApiKeyEnv}=${input.llm.apiKey}`);
  }

  if (input.telegram.enabled && input.telegram.botToken?.trim()) {
    lines.push(`TELEGRAM_BOT_TOKEN=${input.telegram.botToken.trim()}`);
    lines.push(`TELEGRAM_ALLOWED_USERS=${(input.telegram.allowFrom.length > 0 ? input.telegram.allowFrom : ["*"]).join(",")}`);
  }

  if (input.slack.enabled && input.slack.botToken?.trim()) {
    lines.push(`SLACK_BOT_TOKEN=${input.slack.botToken.trim()}`);
    if (input.slack.appToken?.trim()) {
      lines.push(`SLACK_APP_TOKEN=${input.slack.appToken.trim()}`);
    }
    if (input.slack.allowedUserIds.length > 0) {
      lines.push(`SLACK_ALLOWED_USERS=${input.slack.allowedUserIds.join(",")}`);
    }
  }

  if (hermesDiscord.botToken) {
    lines.push(`DISCORD_BOT_TOKEN=${hermesDiscord.botToken}`);
    if (hermesDiscord.allowedUsers.length > 0) {
      lines.push(`DISCORD_ALLOWED_USERS=${hermesDiscord.allowedUsers.join(",")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export async function readRuntimeBearerToken(input: {
  runtimeType?: RuntimeType;
  volumeName: string;
}): Promise<string | undefined> {
  const runtimeType = normalizeRuntimeType(input.runtimeType);
  if (
    runtimeType !== "openclaw" &&
    runtimeType !== "zeroclaw" &&
    runtimeType !== "hermes"
  ) {
    return undefined;
  }

  const descriptor = getRuntimeDescriptor(runtimeType);
  const filePath =
    runtimeType === "hermes" ? `${descriptor.dataRoot}/.env` : descriptor.configPath;
  const output = await runDocker(
    [
      "run",
      "--rm",
      "-v",
      `${input.volumeName}:${descriptor.dataRoot}:ro`,
      "--entrypoint",
      "sh",
      CONFIG_SEED_IMAGE,
      "-lc",
      `if [ -f ${toShellSingleQuoted(filePath)} ]; then cat ${toShellSingleQuoted(filePath)}; fi`
    ],
    `read runtime bearer token ${input.volumeName}`,
    true
  );

  return parseRuntimeBearerToken(output);
}

function buildRuntimeSeedCommands(input: {
  descriptor: RuntimeDescriptor;
  appendSoulOnboarding: boolean;
  extraFiles?: Array<{
    envVar: string;
    filePath: string;
  }>;
}): string[] {
  const { descriptor } = input;
  const identityPath = `${descriptor.workspaceDir}/IDENTITY.md`;
  const soulPath = `${descriptor.workspaceDir}/SOUL.md`;
  const userPath = `${descriptor.workspaceDir}/USER.md`;
  const toolsPath = `${descriptor.workspaceDir}/TOOLS.md`;
  const integrationsPath = `${descriptor.workspaceDir}/ATOLL_INTEGRATIONS.json`;
  const directories = [descriptor.workspaceDir, ...(descriptor.extraSeedDirectories ?? [])];
  const commands = [
    `mkdir -p ${directories.join(" ")}`,
    `echo "$ATOLL_RUNTIME_CONFIG_B64" | base64 -d > ${descriptor.configPath}`,
    `echo "$ATOLL_RUNTIME_INTEGRATIONS_B64" | base64 -d > ${integrationsPath}`,
    `[ -f ${identityPath} ] || echo "$ATOLL_RUNTIME_IDENTITY_B64" | base64 -d > ${identityPath}`,
    `[ -f ${soulPath} ] || echo "$ATOLL_RUNTIME_SOUL_B64" | base64 -d > ${soulPath}`,
    `[ -f ${userPath} ] || echo "$ATOLL_RUNTIME_USER_B64" | base64 -d > ${userPath}`,
    `[ -f ${toolsPath} ] || echo "$ATOLL_RUNTIME_TOOLS_B64" | base64 -d > ${toolsPath}`
  ];

  for (const extraFile of input.extraFiles ?? []) {
    commands.push(`echo "$${extraFile.envVar}" | base64 -d > ${extraFile.filePath}`);
  }

  if (input.appendSoulOnboarding) {
    commands.push(
      `if [ -f ${soulPath} ] && ! grep -Fq "First-Contact Onboarding (Required)" ${soulPath}; then echo "$ATOLL_RUNTIME_SOUL_ONBOARDING_B64" | base64 -d >> ${soulPath}; fi`
    );
  }

  commands.push(
    `if [ -f ${userPath} ] && ! grep -Fq "## Onboarding Status" ${userPath}; then echo "$ATOLL_RUNTIME_USER_ONBOARDING_B64" | base64 -d >> ${userPath}; fi`
  );

  if (descriptor.seedOwner) {
    commands.push(`chown -R ${descriptor.seedOwner} ${descriptor.dataRoot}`);
  }

  if (descriptor.seedPermissions?.dataRootMode) {
    commands.push(`chmod ${descriptor.seedPermissions.dataRootMode} ${descriptor.dataRoot}`);
  }

  const configDirMode = descriptor.seedPermissions?.configDirMode;
  if (configDirMode) {
    const configDir = dirnamePosix(descriptor.configPath);
    commands.push(`chmod ${configDirMode} ${configDir}`);
  }

  if (descriptor.seedPermissions?.configFileMode) {
    commands.push(`chmod ${descriptor.seedPermissions.configFileMode} ${descriptor.configPath}`);
    for (const extraFile of input.extraFiles ?? []) {
      commands.push(`chmod ${descriptor.seedPermissions.configFileMode} ${extraFile.filePath}`);
    }
  }

  if (descriptor.seedPermissions?.workspaceFileMode) {
    commands.push(
      `chmod ${descriptor.seedPermissions.workspaceFileMode} ${identityPath} ${soulPath} ${userPath} ${toolsPath} ${integrationsPath} 2>/dev/null || true`
    );
  }

  return commands;
}

function buildWorkspaceIdentityMarkdown(profile?: RuntimeWorkspaceProfile): string {
  const helperName = normalizeProfileValue(profile?.helperName, "Atoll Helper");
  const helperStyle = normalizeProfileValue(profile?.helperStyle, "Helpful, pragmatic, concise");
  const workspaceName = normalizeProfileValue(profile?.workspaceName, "Default Workspace");
  const presetName = normalizeProfileValue(profile?.presetName, "");
  const workspaceMode = formatWorkspaceModeLabel(profile);

  const roleLine = presetName
    ? `You are ${helperName}, the dedicated ${presetName} preset for ${workspaceName}.`
    : `You are ${helperName}, the dedicated assistant for ${workspaceName}.`;
  const behaviorLine = presetName
    ? "Stay faithful to the preset's core mission and working style while adapting to confirmed workspace needs."
    : "Stay aligned with the requested vibe while prioritizing clear and useful help.";

  return [
    "# IDENTITY.md - Agent Identity",
    "",
    `- Name: ${helperName}`,
    `- Vibe: ${helperStyle}`,
    "- Emoji: :robot:",
    `- Workspace: ${workspaceName}`,
    `- Workspace mode: ${workspaceMode}`,
    ...(profile?.sharedWorkspacePath ? [`- Shared workspace path: ${profile.sharedWorkspacePath}`] : []),
    ...(presetName ? [`- Preset: ${presetName}`] : []),
    "",
    "## Role",
    "",
    roleLine,
    behaviorLine,
    ""
  ].join("\n");
}

function dirnamePosix(path: string): string {
  const lastSlashIndex = path.lastIndexOf("/");
  if (lastSlashIndex <= 0) {
    return "/";
  }
  return path.slice(0, lastSlashIndex);
}

function resolveMountedRuntimePath(descriptor: RuntimeDescriptor, path: string): string {
  if (!path.startsWith(descriptor.dataRoot)) {
    return path;
  }
  return `${descriptor.mountPath}${path.slice(descriptor.dataRoot.length)}`;
}

function buildWorkspaceSoulMarkdown(profile?: RuntimeWorkspaceProfile): string {
  const helperName = normalizeProfileValue(profile?.helperName, "Atoll Helper");
  const helperStyle = normalizeProfileValue(profile?.helperStyle, "Helpful, pragmatic, concise");
  const presetTemplate = profile?.presetSoulTemplateMarkdown?.trim();

  if (presetTemplate) {
    return [
      interpolatePresetTemplate(presetTemplate, profile),
      "",
      ...buildSoulOnboardingAddonMarkdown().trimEnd().split("\n"),
      ""
    ].join("\n");
  }

  return [
    "# SOUL.md - Behavior",
    "",
    `- Preferred style: ${helperStyle}`,
    "",
    "## Operating Rules",
    "",
    `1. Keep responses consistent with ${helperName}'s style.`,
    "2. Be direct, technically accurate, and action-oriented.",
    "3. Ask concise follow-up questions when key context is missing.",
    "4. Prefer practical next steps over abstract explanations.",
    "",
    ...buildSoulOnboardingAddonMarkdown().trimEnd().split("\n"),
    ""
  ].join("\n");
}

function buildWorkspaceUserMarkdown(profile?: RuntimeWorkspaceProfile): string {
  const workspaceName = normalizeProfileValue(profile?.workspaceName, "Default Workspace");
  const helperName = normalizeProfileValue(profile?.helperName, "Atoll Helper");
  const helperStyle = normalizeProfileValue(profile?.helperStyle, "Helpful, pragmatic, concise");
  const workspaceMode = formatWorkspaceModeLabel(profile);
  const presetName = normalizeProfileValue(profile?.presetName, "");
  const presetSourcePath = normalizeProfileValue(profile?.presetSourcePath, "");
  const presetSummary = normalizeProfileValue(profile?.presetSummary, "");
  const agentTypeName = normalizeProfileValue(profile?.agentTypeName, "");
  const skills = (profile?.skills ?? [])
    .map((skill) => normalizeProfileValue(skill, ""))
    .filter(Boolean);

  return [
    "# USER.md - Workspace Context",
    "",
    `- Workspace: ${workspaceName}`,
    `- Workspace mode: ${workspaceMode}`,
    `- Helper: ${helperName}`,
    `- Requested style: ${helperStyle}`,
    ...(profile?.sharedWorkspacePath
      ? [
          `- Shared workspace path: ${profile.sharedWorkspacePath}`,
          "- Dedicated-workspace helpers can collaborate through this shared mount."
        ]
      : []),
    ...(presetName
      ? [
          "",
          "## Preset Profile",
          "",
          `- Preset: ${presetName}`,
          ...(presetSourcePath ? [`- Source: ${presetSourcePath}`] : []),
          ...(presetSummary ? [`- Summary: ${presetSummary}`] : [])
        ]
      : []),
    ...(skills.length > 0
      ? [
          "",
          "## Skill Profile",
          "",
          ...(agentTypeName ? [`- Agent type: ${agentTypeName}`] : []),
          "- Enabled skills:",
          ...skills.map((skill) => `  - ${skill}`)
        ]
      : []),
    "",
    ...buildUserOnboardingAddonMarkdown().trimEnd().split("\n"),
    "",
    "This file is seeded by Atoll during helper provisioning.",
    "After first-contact onboarding, update this file with confirmed preferences.",
    ""
  ].join("\n");
}

function buildSoulOnboardingAddonMarkdown(): string {
  return [
    "## First-Contact Onboarding (Required)",
    "",
    "On the first user message in a new workspace, run onboarding before normal task mode.",
    "Ask for:",
    "1. How the user wants to be addressed and what they are building.",
    "2. Response preferences (tone, depth, structure, language).",
    "3. Heartbeat preference (off, per-step, daily summary) and timezone.",
    "4. Any hard constraints (security, compliance, forbidden actions).",
    "",
    "After collecting answers, summarize them and ask for confirmation.",
    "Once confirmed, treat onboarding as complete and avoid repeating it unless the user asks to reset it.",
    ""
  ].join("\n");
}

function buildUserOnboardingAddonMarkdown(): string {
  return [
    "## Onboarding Status",
    "",
    "- Status: pending",
    "- Preferred name for user: unknown",
    "- Primary goals: unknown",
    "- Preferred response style: unknown",
    "- Heartbeat preference: unknown",
    "- Timezone: unknown",
    "- Constraints: unknown",
    "- Last confirmed at: not set",
    "",
    "## Integration State",
    "- Read `ATOLL_INTEGRATIONS.json` in your workspace directory for the latest Atoll-managed integration status.",
    ""
  ].join("\n");
}

function buildWorkspaceToolsMarkdown(profile?: RuntimeWorkspaceProfile): string {
  const presetName = normalizeProfileValue(profile?.presetName, "");
  const presetSourcePath = normalizeProfileValue(profile?.presetSourcePath, "");
  const skills = (profile?.skills ?? [])
    .map((skill) => normalizeProfileValue(skill, ""))
    .filter(Boolean);

  return [
    "# TOOLS.md - Skill Profile",
    "",
    ...(presetName
      ? [
          `- Preset: ${presetName}`,
          ...(presetSourcePath ? [`- Source: ${presetSourcePath}`] : []),
          ""
        ]
      : []),
    "## Effective Skills",
    "",
    ...(skills.length > 0
      ? skills.map((skill) => `- ${skill}`)
      : ["- No explicit skills were stored for this helper at creation time."]),
    ""
  ].join("\n");
}

export function buildWorkspaceSeedFiles(profile?: RuntimeWorkspaceProfile): {
  identityMarkdown: string;
  soulMarkdown: string;
  userMarkdown: string;
  toolsMarkdown: string;
} {
  return {
    identityMarkdown: buildWorkspaceIdentityMarkdown(profile),
    soulMarkdown: buildWorkspaceSoulMarkdown(profile),
    userMarkdown: buildWorkspaceUserMarkdown(profile),
    toolsMarkdown: buildWorkspaceToolsMarkdown(profile)
  };
}

function resolveWorkspaceSeedFiles(
  runtimeType: RuntimeType,
  profile?: RuntimeWorkspaceProfile
): {
  identityMarkdown: string;
  soulMarkdown: string;
  userMarkdown: string;
  toolsMarkdown: string;
  appendSoulOnboarding: boolean;
} {
  const generic = buildWorkspaceSeedFiles(profile);
  const presetIdentityMarkdown = profile?.presetIdentityMarkdown?.trim();
  const presetSoulMarkdown = profile?.presetSoulMarkdown?.trim();
  const presetToolsMarkdown = profile?.presetToolsMarkdown?.trim();

  if (
    (runtimeType === "openclaw" || runtimeType === "zeroclaw") &&
    presetIdentityMarkdown &&
    presetSoulMarkdown
  ) {
    return {
      identityMarkdown: presetIdentityMarkdown,
      soulMarkdown: presetSoulMarkdown,
      userMarkdown: generic.userMarkdown,
      toolsMarkdown: presetToolsMarkdown || generic.toolsMarkdown,
      appendSoulOnboarding: false
    };
  }

  return {
    ...generic,
    appendSoulOnboarding: true
  };
}

function normalizeProfileValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.replaceAll("\n", " ").slice(0, 240);
}

function formatWorkspaceModeLabel(profile?: RuntimeWorkspaceProfile): string {
  return profile?.workspaceKind === "dedicated" || profile?.workspaceResourceMode === "shared"
    ? "Dedicated shared workspace"
    : "Default individual workspace";
}

function interpolatePresetTemplate(
  template: string,
  profile?: RuntimeWorkspaceProfile
): string {
  const helperName = normalizeProfileValue(profile?.helperName, "Atoll Helper");
  const workspaceName = normalizeProfileValue(profile?.workspaceName, "Default Workspace");

  return template
    .replaceAll("{{helperName}}", helperName)
    .replaceAll("{{workspaceName}}", workspaceName)
    .trimEnd();
}

function resolveOpenClawModelReference(provider: string, model: string): string {
  const cleanModel = model.trim();
  if (!cleanModel) {
    return model;
  }
  const cleanProvider = provider.trim();
  if (cleanProvider.toLowerCase() === "openrouter") {
    if (cleanModel.toLowerCase().startsWith("openrouter/")) {
      return cleanModel;
    }
    if (cleanModel.includes("/")) {
      return `openrouter/${cleanModel}`;
    }
  }
  if (cleanModel.includes("/")) {
    return cleanModel;
  }
  if (!cleanProvider) {
    return cleanModel;
  }
  return `${cleanProvider}/${cleanModel}`;
}

function resolveHermesProviderName(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  if (!normalized) {
    return "auto";
  }
  if (normalized === "openai") {
    return "openrouter";
  }
  return normalized;
}

function resolveHermesModelReference(provider: string, model: string): string {
  const cleanModel = model.trim();
  if (!cleanModel) {
    return model;
  }
  const providerPrefix = `${resolveHermesProviderName(provider)}/`;
  if (cleanModel.toLowerCase().startsWith(providerPrefix.toLowerCase())) {
    return cleanModel.slice(providerPrefix.length);
  }
  if (cleanModel.toLowerCase().startsWith("openrouter/")) {
    return cleanModel.slice("openrouter/".length);
  }
  return cleanModel;
}

function resolveHermesBaseUrlLine(provider: string): string[] {
  if (resolveHermesProviderName(provider) === "openrouter") {
    return [`  base_url: ${toYamlString("https://openrouter.ai/api/v1")}`];
  }
  return [];
}

function resolveHermesDiscordConfig(
  discord: RuntimeDiscordConfig
): {
  enabled: boolean;
  botToken?: string;
  allowedUsers: string[];
  allowedChannels: string[];
  requireMention: boolean;
  autoThread: boolean;
} {
  const botToken = discord.botToken?.trim() || undefined;

  return {
    enabled: Boolean(botToken),
    botToken,
    allowedUsers: discord.allowedUserIds ?? [],
    allowedChannels: discord.allowedChannelIds,
    requireMention: discord.requireMention ?? true,
    autoThread: discord.replyInThread
  };
}

function resolveProviderApiKeyEnvName(provider: string): string | undefined {
  const normalized = provider.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "openrouter") return "OPENROUTER_API_KEY";
  if (normalized === "openai") return "OPENAI_API_KEY";
  if (normalized === "anthropic") return "ANTHROPIC_API_KEY";
  return undefined;
}

function buildRuntimeIntegrationsSnapshotJson(input: {
  llm: RuntimeLlmConfig;
  telegram: RuntimeTelegramConfig;
  slack: RuntimeSlackConfig;
  discord?: RuntimeDiscordConfig;
}): string {
  const discord = resolveRuntimeDiscordConfig(input.discord);
  const payload = {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: "atoll-state",
    llm: {
      provider: input.llm.provider.trim(),
      model: input.llm.model.trim()
    },
    integrations: {
      telegram: {
        enabled: input.telegram.enabled,
        hasBotToken: Boolean(input.telegram.botToken?.trim()),
        allowFrom: input.telegram.allowFrom,
        replyInPrivate: input.telegram.replyInPrivate
      },
      slack: {
        enabled: input.slack.enabled,
        transport: "native-socket",
        hasBotToken: Boolean(input.slack.botToken?.trim()),
        hasAppToken: Boolean(input.slack.appToken?.trim()),
        allowedChannelIds: input.slack.allowedChannelIds,
        allowedUserIds: input.slack.allowedUserIds,
        replyInThread: input.slack.replyInThread,
        note:
          "Atoll configures native OpenClaw socket mode through channels.slack in openclaw.json."
      },
      discord: {
        enabled: discord.enabled,
        transport: "native-gateway",
        hasBotToken: Boolean(discord.botToken?.trim()),
        allowedUserIds: discord.allowedUserIds ?? [],
        allowedGuildIds: discord.allowedGuildIds,
        allowedChannelIds: discord.allowedChannelIds,
        replyInThread: discord.replyInThread,
        requireMention: discord.requireMention,
        note:
          "Atoll configures native OpenClaw Discord through channels.discord in openclaw.json."
      }
    }
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

function validateRuntimeConfigInput(
  llm: RuntimeLlmConfig,
  telegram: RuntimeTelegramConfig,
  slack: RuntimeSlackConfig,
  discordInput?: RuntimeDiscordConfig
): void {
  const discord = resolveRuntimeDiscordConfig(discordInput);
  if (!llm.provider.trim()) {
    throw new Error("LLM provider is required");
  }

  if (!llm.model.trim()) {
    throw new Error("LLM model is required");
  }

  if (!llm.apiKey.trim()) {
    throw new Error("Missing runtime API key");
  }

  if (telegram.enabled && !telegram.botToken?.trim()) {
    throw new Error("Telegram bot token is required when telegram is enabled");
  }

  if (slack.enabled) {
    if (!slack.botToken?.trim()) {
      throw new Error("Slack bot token is required when slack is enabled");
    }
    if (!slack.appToken?.trim()) {
      throw new Error("Slack app token is required when slack is enabled");
    }
  }

  if (discord.enabled && !discord.botToken?.trim()) {
    throw new Error("Discord bot token is required when discord is enabled");
  }
}

function resolveRuntimeDiscordConfig(input?: RuntimeDiscordConfig): RuntimeDiscordConfig {
  return {
    enabled: input?.enabled ?? false,
    botToken: input?.botToken,
    allowedUserIds: input?.allowedUserIds ?? [],
    allowedGuildIds: input?.allowedGuildIds ?? [],
    allowedChannelIds: input?.allowedChannelIds ?? [],
    replyInThread: input?.replyInThread ?? true,
    requireMention: input?.requireMention ?? true
  };
}

function buildAtollRuntimeLabels(
  input: ProvisionRuntimeContainerInput,
  runtimeType: RuntimeType,
  gatewayPort: number
): Record<string, string> {
  const entries: Array<[string, string | undefined]> = [
    ["atoll.managed", "true"],
    ["atoll.runtimeType", runtimeType],
    ["atoll.containerName", input.containerName],
    ["atoll.volumeName", input.volumeName],
    ["atoll.networkName", input.networkName],
    ["atoll.gatewayPort", String(gatewayPort)],
    ["atoll.instanceId", input.instanceId],
    ["atoll.tenantId", input.tenantId],
    ["atoll.agentId", input.agentId],
    ["atoll.orgId", input.identityOrgId],
    ["atoll.helperName", input.workspaceProfile?.helperName],
    ["atoll.workspaceName", input.workspaceProfile?.workspaceName]
  ];

  const labels: Record<string, string> = {};
  for (const [key, rawValue] of entries) {
    const normalized = normalizeLabelValue(rawValue);
    if (!normalized) {
      continue;
    }
    labels[key] = normalized;
  }
  return labels;
}

function normalizeLabelValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replaceAll("\n", " ").slice(0, 240);
}

function parseRuntimeIdentityMarkdown(markdown: string): RuntimeRecoveredIdentity | undefined {
  const helperName = extractIdentityField(markdown, "Name");
  const workspaceName = extractIdentityField(markdown, "Workspace");
  const vibe = extractIdentityField(markdown, "Vibe");
  const presetName = extractIdentityField(markdown, "Preset");
  const roleTitle = vibe || presetName;
  if (!helperName && !workspaceName && !roleTitle && !presetName) {
    return undefined;
  }
  return {
    helperName,
    workspaceName,
    roleTitle,
    presetName
  };
}

function parseRuntimeBearerToken(configContents: string): string | undefined {
  if (!configContents.trim()) {
    return undefined;
  }

  if (/^\s*API_SERVER_KEY=/mu.test(configContents)) {
    return parseHermesApiServerKey(configContents);
  }

  if (configContents.trimStart().startsWith("{")) {
    return parseOpenClawBearerToken(configContents);
  }

  return parseZeroClawWebhookSecret(configContents);
}

function parseOpenClawBearerToken(configContents: string): string | undefined {
  try {
    const parsed = JSON.parse(configContents) as {
      gateway?: {
        auth?: {
          token?: unknown;
        };
      };
    };
    const token = parsed?.gateway?.auth?.token;
    return typeof token === "string" && token.trim() ? token.trim() : undefined;
  } catch {
    return undefined;
  }
}

function parseZeroClawWebhookSecret(configContents: string): string | undefined {
  const sectionMatch = /(?:^|\n)\[channels_config\.webhook\]\s*(?<body>[\s\S]*?)(?=\n\[|$)/mu.exec(
    configContents
  );
  const sectionBody = sectionMatch?.groups?.body;
  if (!sectionBody) {
    return undefined;
  }

  const secretMatch = /^\s*secret\s*=\s*"((?:\\.|[^"])*)"/mu.exec(sectionBody);
  const rawSecret = secretMatch?.[1];
  if (!rawSecret) {
    return undefined;
  }

  try {
    const secret = JSON.parse(`"${rawSecret}"`) as unknown;
    return typeof secret === "string" && secret.trim() ? secret.trim() : undefined;
  } catch {
    return undefined;
  }
}

function parseHermesApiServerKey(configContents: string): string | undefined {
  const match = /^\s*API_SERVER_KEY\s*=\s*(.+)\s*$/mu.exec(configContents);
  const rawValue = match?.[1]?.trim();
  if (!rawValue) {
    return undefined;
  }

  const normalized = rawValue.replace(/^['"]|['"]$/g, "").trim();
  return normalized || undefined;
}

function extractIdentityField(markdown: string, label: string): string | undefined {
  if (!markdown.trim()) {
    return undefined;
  }
  const pattern = new RegExp(`^\\s*[-*]\\s*${escapeRegExp(label)}\\s*:\\s*(.+)$`, "imu");
  const match = pattern.exec(markdown);
  if (!match || !match[1]) {
    return undefined;
  }
  const raw = match[1].trim();
  if (!raw) {
    return undefined;
  }
  return raw.slice(0, 120);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function toShellSingleQuoted(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function parseManagedContainerInspection(value: unknown): ManagedRuntimeContainer | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const id = toNonEmptyString(raw.Id);
  const rawName = toNonEmptyString(raw.Name);
  const name = rawName?.startsWith("/") ? rawName.slice(1) : rawName;
  const config = asRecord(raw.Config);
  const state = asRecord(raw.State);
  const networkSettings = asRecord(raw.NetworkSettings);
  const image = toNonEmptyString(config?.Image);

  if (!id || !name || !image) {
    return undefined;
  }

  const command = Array.isArray(config?.Cmd)
    ? config.Cmd.filter((item): item is string => typeof item === "string")
    : [];
  const labelsRaw = asRecord(config?.Labels);
  const labels: Record<string, string> = {};
  if (labelsRaw) {
    for (const [key, rawLabelValue] of Object.entries(labelsRaw)) {
      if (typeof rawLabelValue !== "string") {
        continue;
      }
      labels[key] = rawLabelValue;
    }
  }

  const mountsRaw = Array.isArray(raw.Mounts) ? raw.Mounts : [];
  const mounts: ManagedRuntimeContainer["mounts"] = mountsRaw.flatMap((mountValue) => {
    const mount = asRecord(mountValue);
    const destination = toNonEmptyString(mount?.Destination);
    const type = toNonEmptyString(mount?.Type);
    if (!destination || !type) {
      return [];
    }
    const name = toNonEmptyString(mount?.Name);
    return [
      {
        type,
        ...(name ? { name } : {}),
        destination
      }
    ];
  });

  const networks = asRecord(networkSettings?.Networks);
  const networkNames = networks ? Object.keys(networks).filter(Boolean) : [];
  const networkIps = collectNetworkIps(networks);
  const hostPorts = collectPortValues(networkSettings?.Ports);
  const exposedPorts = collectPortValues(config?.ExposedPorts);

  return {
    id,
    name,
    image,
    status: toNonEmptyString(state?.Status) || "unknown",
    running: Boolean(state?.Running),
    command,
    labels,
    mounts,
    networkNames,
    ...(networkIps ? { networkIps } : {}),
    hostPorts,
    exposedPorts
  };
}

function collectPortValues(rawPorts: unknown): number[] {
  const records = asRecord(rawPorts);
  if (!records) {
    return [];
  }

  const ports = new Set<number>();
  for (const [key, rawValue] of Object.entries(records)) {
    const keyPort = parsePortNumber(key);
    if (keyPort > 0) {
      ports.add(keyPort);
    }

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        const binding = asRecord(item);
        const hostPort = parsePortNumber(toNonEmptyString(binding?.HostPort));
        if (hostPort > 0) {
          ports.add(hostPort);
        }
      }
    }
  }

  return [...ports.values()].sort((left, right) => left - right);
}

function collectNetworkIps(networks: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!networks) {
    return undefined;
  }

  const entries: Array<[string, string]> = [];
  for (const [networkName, rawNetwork] of Object.entries(networks)) {
    const normalizedNetworkName = networkName.trim();
    if (!normalizedNetworkName) {
      continue;
    }
    const network = asRecord(rawNetwork);
    const ipAddress = toNonEmptyString(network?.IPAddress);
    if (!ipAddress) {
      continue;
    }
    entries.push([normalizedNetworkName, ipAddress]);
  }

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function parsePortNumber(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const normalized = value.includes("/") ? (value.split("/", 1)[0] ?? "") : value;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function resolveDefaultRuntimeImage(runtimeType: RuntimeType): string {
  const envKey =
    runtimeType === "openclaw"
      ? "RUNTIME_OPENCLAW_IMAGE"
      : runtimeType === "zeroclaw"
          ? "RUNTIME_ZEROCLAW_IMAGE"
          : "RUNTIME_HERMES_IMAGE";
  const value = process.env[envKey]?.trim() || "";
  if (!value) {
    throw new Error(`${envKey} is required when runtime image is not explicitly provided.`);
  }
  return value;
}

function resolveRuntimeGuiSidecarImage(): string {
  const image = process.env[GUI_SIDECAR_IMAGE_ENV]?.trim() || "";
  if (!image) {
    throw new Error(`${GUI_SIDECAR_IMAGE_ENV} is required when GUI sidecar is enabled.`);
  }
  return image;
}

function resolveRuntimeGuiSidecarContainerName(containerName: string): string {
  const normalized = containerName.trim().replace(/^atoll-rt-/u, "").replace(/[^a-zA-Z0-9_.-]/gu, "-");
  return `${GUI_SIDECAR_CONTAINER_PREFIX}${normalized || "runtime"}`;
}

function resolveRuntimeGuiPlaywrightWsEndpoint(sidecarContainerName: string): string {
  return `ws://${sidecarContainerName}:${GUI_SIDECAR_PLAYWRIGHT_PORT}${GUI_SIDECAR_PLAYWRIGHT_PATH}`;
}

function resolveRuntimeGuiSidecarSettings(runtimeOptions?: Record<string, unknown>): {
  enabled: boolean;
  enableVnc: boolean;
  noVncPort?: number;
} {
  const options = runtimeOptions ?? {};
  const guiOptions = asRecord(options.gui);
  const enabled = parseBooleanRuntimeOption(
    options["gui.enabled"] ?? options.guiEnabled ?? guiOptions?.enabled,
    false
  );
  const enableVnc = parseBooleanRuntimeOption(
    options["gui.enableVnc"] ?? guiOptions?.enableVnc,
    false
  );
  const noVncPort = parseOptionalPositiveIntegerRuntimeOption(
    options["gui.noVncPort"] ?? guiOptions?.noVncPort
  );
  return {
    enabled,
    enableVnc,
    ...(noVncPort ? { noVncPort } : {})
  };
}

function parseBooleanRuntimeOption(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value !== 0 : fallback;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
      return false;
    }
  }
  return fallback;
}

function parseOptionalPositiveIntegerRuntimeOption(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function buildRuntimeConfigToml(input: {
  llm: RuntimeLlmConfig;
  telegram: RuntimeTelegramConfig;
  gatewayPort: number;
  requirePairing: boolean;
  allowPublicBind: boolean;
  bearerToken?: string;
}): string {
  const bearerToken = input.bearerToken?.trim();
  const lines = [
    `api_key = ${toTomlString(input.llm.apiKey)}`,
    `default_provider = ${toTomlString(input.llm.provider)}`,
    `default_model = ${toTomlString(input.llm.model)}`,
    "default_temperature = 0.7",
    "",
    "[gateway]",
    `port = ${input.gatewayPort}`,
    'host = "0.0.0.0"',
    `require_pairing = ${toTomlBoolean(input.requirePairing)}`,
    `allow_public_bind = ${toTomlBoolean(input.allowPublicBind)}`,
    "",
    "[channels_config]",
    "cli = true"
  ];

  if (bearerToken && !input.requirePairing) {
    lines.push(
      "",
      "[channels_config.webhook]",
      `port = ${input.gatewayPort}`,
      `secret = ${toTomlString(bearerToken)}`
    );
  }

  const telegramConfigBlock = buildTelegramConfigBlock(input.telegram);
  if (telegramConfigBlock.length > 0) {
    lines.push("");
    lines.push(...telegramConfigBlock);
  }

  return `${lines.join("\n")}\n`;
}

function toYamlString(value: string): string {
  const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escaped}"`;
}

function toYamlBoolean(value: boolean): string {
  return value ? "true" : "false";
}

function buildTelegramConfigBlock(telegram: RuntimeTelegramConfig): string[] {
  if (!telegram.enabled) {
    return [];
  }

  const allowedUsers = telegram.allowFrom.length > 0 ? telegram.allowFrom : ["*"];
  const lines = [
    "[channels_config.telegram]",
    `bot_token = ${toTomlString(telegram.botToken?.trim() ?? "")}`,
    `allowed_users = [${allowedUsers.map((item) => toTomlString(item)).join(", ")}]`,
    `reply_in_private = ${toTomlBoolean(telegram.replyInPrivate)}`
  ];

  const configuredStreamMode = process.env.RUNTIME_TELEGRAM_STREAM_MODE?.trim();
  if (configuredStreamMode) {
    lines.push(`stream_mode = ${toTomlString(configuredStreamMode)}`);
  }

  return lines;
}

function toTomlString(value: string): string {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\t", "\\t");
  return `"${escaped}"`;
}

function toTomlBoolean(value: boolean): string {
  return value ? "true" : "false";
}

function getRuntimeSharedFilesDir(runtimeType: RuntimeType): string {
  const descriptor = getRuntimeDescriptor(runtimeType);
  return `${descriptor.workspaceDir}/${RUNTIME_SHARED_FILES_DIRNAME}`;
}

function getRuntimeSharedFilesManifestPath(runtimeType: RuntimeType): string {
  return `${getRuntimeSharedFilesDir(runtimeType)}/.atoll-shared-files.json`;
}

async function readRuntimeSharedFilesManifest(input: {
  runtimeType: RuntimeType;
  volumeName: string;
}): Promise<RuntimeSharedFile[]> {
  const descriptor = getRuntimeDescriptor(input.runtimeType);
  const manifestPath = getRuntimeSharedFilesManifestPath(input.runtimeType);
  const result = await runtimeVolumeIo.readFile({
    volumeName: input.volumeName,
    mountPath: descriptor.dataRoot,
    filePath: manifestPath,
    label: `read runtime shared files manifest ${input.volumeName}`
  });

  return parseRuntimeSharedFilesManifest(result.found ? result.content.toString("utf8") : "");
}

async function writeRuntimeSharedFilesManifest(input: {
  runtimeType: RuntimeType;
  volumeName: string;
  items: RuntimeSharedFile[];
}): Promise<void> {
  const descriptor = getRuntimeDescriptor(input.runtimeType);
  const manifestPath = getRuntimeSharedFilesManifestPath(input.runtimeType);
  await runtimeVolumeIo.writeFile({
    volumeName: input.volumeName,
    mountPath: descriptor.dataRoot,
    filePath: manifestPath,
    content: Buffer.from(`${JSON.stringify(input.items, null, 2)}\n`, "utf8"),
    label: `write runtime shared files manifest ${input.volumeName}`
  });
}

function parseRuntimeSharedFilesManifest(raw: string): RuntimeSharedFile[] {
  if (!raw.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => {
      const candidate = item as Partial<RuntimeSharedFile>;
      if (
        typeof candidate?.id !== "string" ||
        typeof candidate?.name !== "string" ||
        typeof candidate?.relativePath !== "string" ||
        typeof candidate?.sizeBytes !== "number" ||
        typeof candidate?.uploadedAt !== "string"
      ) {
        return undefined;
      }

      return {
        id: candidate.id,
        name: candidate.name,
        relativePath: candidate.relativePath,
        sizeBytes: candidate.sizeBytes,
        uploadedAt: candidate.uploadedAt
      };
    })
    .filter((item): item is RuntimeSharedFile => Boolean(item));
}

function sanitizeRuntimeSharedFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || /[\\/]/u.test(trimmed)) {
    throw new Error("Invalid shared file name");
  }
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/iu.test(trimmed)) {
    throw new Error("Invalid shared file name");
  }
  return trimmed;
}

function sanitizeRuntimeSharedRelativePath(relativePath: string): string {
  const normalized = relativePath.trim().replaceAll("\\", "/");
  if (!normalized || normalized.includes("/")) {
    throw new Error("Invalid shared file path");
  }
  return sanitizeRuntimeSharedFileName(normalized);
}

async function ensureRuntimeNetwork(networkName: string): Promise<void> {
  const inspected = await probeDocker(["network", "inspect", networkName], `inspect network ${networkName}`);
  if (inspected.ok) {
    return;
  }

  await runDocker(["network", "create", networkName], `create network ${networkName}`);
}

async function runDocker(
  args: string[],
  label: string,
  ignoreMissingResourceErrors = false
): Promise<string> {
  const result = await probeDocker(args, label);
  if (result.ok) {
    return result.output;
  }

  const isMissingResourceError = /No such (container|volume|network)/i.test(result.message);
  if (ignoreMissingResourceErrors && isMissingResourceError) {
    return "";
  }
  throw new Error(`Container CLI command failed (${label}): ${result.message}`);
}

async function probeDocker(
  args: string[],
  label: string
): Promise<{ ok: true; output: string; message: string } | { ok: false; output: string; message: string }> {
  const cli = getContainerCli();
  try {
    const { stdout, stderr } = await execFileAsync(cli, args, {
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    });
    const output = (stdout ?? "").trim();
    const stderrText = (stderr ?? "").trim();
    return {
      ok: true,
      output,
      message: output || stderrText || `Container CLI command succeeded (${label})`
    };
  } catch (error) {
    return {
      ok: false,
      output: "",
      message: formatExecError(error)
    };
  }
}

async function runDockerBuffer(
  args: string[],
  label: string,
  options: {
    input?: Buffer;
    ignoreExitCodes?: number[];
  } = {}
): Promise<{ ok: boolean; output: Buffer; message: string }> {
  const cli = getContainerCli();
  const ignoreExitCodes = new Set(options.ignoreExitCodes ?? []);

  return await new Promise((resolve, reject) => {
    const child = spawn(cli, args, {
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, 120_000);

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Container CLI command failed (${label}): ${formatExecError(error)}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      const message = stderr || output.toString("utf8").trim() || `Container CLI command succeeded (${label})`;

      if (code === 0) {
        resolve({
          ok: true,
          output,
          message
        });
        return;
      }

      if (code !== null && ignoreExitCodes.has(code)) {
        resolve({
          ok: false,
          output: Buffer.alloc(0),
          message
        });
        return;
      }

      reject(new Error(`Container CLI command failed (${label}): ${message}`));
    });

    if (options.input?.byteLength) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });
}

function formatExecError(error: unknown): string {
  const execError = error as {
    message?: string;
    stdout?: string;
    stderr?: string;
  };

  const raw = [execError.stderr, execError.stdout, execError.message]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" | ");
  return raw || "Unknown container CLI error";
}

function getContainerCli(): string {
  const configured = process.env.CONTAINER_CLI?.trim();
  return configured || DEFAULT_CONTAINER_CLI;
}

function getRuntimeProcessMode(): "daemon" | "gateway" {
  const configured = process.env.RUNTIME_PROCESS_MODE?.trim().toLowerCase();
  if (configured === "gateway" || configured === "daemon") {
    return configured;
  }
  return DEFAULT_RUNTIME_PROCESS_MODE;
}

function extractPairingCode(logOutput: string): string | undefined {
  const patterns = [
    /X-Pairing-Code:\s*(\d{4,8})/i,
    /pairing code[:\s]+(\d{4,8})/i,
    /│\s*(\d{4,8})\s*│/u
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(logOutput);
    const code = match?.[1]?.trim();
    if (code) {
      return code;
    }
  }

  return undefined;
}

function clipText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(value.length - maxChars);
}
