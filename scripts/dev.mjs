import { execFile } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import concurrently from "concurrently";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const localDevEnv = {
  ...process.env,
  // Keep production strict, but allow local UI/API work without pre-pulled runtime images.
  RUNTIME_STARTUP_VALIDATION: process.env.RUNTIME_STARTUP_VALIDATION || "warn",
};

async function canReachDocker(cli) {
  try {
    await execFileAsync(cli, ["info"], {
      timeout: 10_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function canListenOnPort(host, port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      server.close(() => reject(error));
    });
    server.listen(port, host, () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve();
      });
    });
  });
}

async function resolveDevApiPort() {
  const host = localDevEnv.HOST || "127.0.0.1";
  const explicitPort = Number.parseInt(localDevEnv.PORT || "", 10);
  const hasExplicitPort = Number.isFinite(explicitPort) && explicitPort > 0;
  const preferredPort = hasExplicitPort ? explicitPort : 8450;

  try {
    await canListenOnPort(host, preferredPort);
    if (!hasExplicitPort) {
      console.warn("[dev] Using API port 8450 for local development.");
    }
    return preferredPort;
  } catch {
    const portLabel = hasExplicitPort ? `requested API port ${preferredPort}` : "default API port 8450";
    throw new Error(
      `[dev] The ${portLabel} is unavailable on ${host}. Free that port or set PORT to a different fixed value.`,
    );
  }
}

async function waitForDocker(cli, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canReachDocker(cli)) {
      return true;
    }
    await sleep(2_000);
  }
  return await canReachDocker(cli);
}

function resolveDockerDesktopExe() {
  const candidates = [
    "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
    "C:\\Program Files (x86)\\Docker\\Docker\\Docker Desktop.exe",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function tryLaunchDockerOnWindows() {
  const dockerDesktopExe = resolveDockerDesktopExe();
  if (!dockerDesktopExe) {
    console.warn("[dev] Docker is not reachable and Docker Desktop was not found in the default install path.");
    console.warn("[dev] Start Docker manually, or install Docker Desktop if you need runtime features.");
    return;
  }

  try {
    console.warn("[dev] Docker is not reachable. Starting Docker Desktop...");
    await execFileAsync("cmd.exe", ["/c", "start", "", dockerDesktopExe], {
      windowsHide: true,
    });
    console.warn("[dev] Docker Desktop launch requested. Wait for Docker to finish starting if you need runtime features.");
  } catch {
    console.warn("[dev] Docker is not reachable. Start Docker Desktop manually, then retry runtime actions if needed.");
  }
}

async function tryLaunchDockerOnMac() {
  try {
    console.warn("[dev] Docker is not reachable. Starting Docker.app...");
    await execFileAsync("open", ["-a", "Docker"], {
      timeout: 10_000,
      windowsHide: true,
    });
    console.warn("[dev] Docker.app launch requested. Wait for Docker to finish starting if you need runtime features.");
  } catch {
    console.warn("[dev] Docker is not reachable. Start Docker.app manually, then retry runtime actions if needed.");
  }
}

async function tryLaunchDockerOnLinux(cli) {
  try {
    console.warn("[dev] Docker is not reachable. Trying `docker desktop start`...");
    await execFileAsync(cli, ["desktop", "start"], {
      timeout: 20_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    console.warn("[dev] Docker Desktop launch requested. Wait for Docker to finish starting if you need runtime features.");
    return;
  } catch {
    console.warn("[dev] Docker is not reachable. No safe automatic Linux start hook succeeded.");
    console.warn("[dev] Start Docker manually, for example with Docker Desktop or your system service manager, then retry runtime actions if needed.");
  }
}

async function ensureDockerForDev() {
  const cli = localDevEnv.CONTAINER_CLI || "docker";
  if (cli !== "docker") {
    return;
  }

  const dockerWasReachable = await canReachDocker(cli);
  if (dockerWasReachable) {
    return;
  }

  if (process.platform === "win32") {
    await tryLaunchDockerOnWindows();
    return;
  }

  if (process.platform === "darwin") {
    await tryLaunchDockerOnMac();
    return;
  }

  if (process.platform === "linux") {
    await tryLaunchDockerOnLinux(cli);
  } else if (process.platform !== "win32" && process.platform !== "darwin") {
    console.warn("[dev] Docker is not reachable. Start Docker manually and retry if you need runtime features.");
  }

  console.warn("[dev] Waiting up to 30 seconds for Docker to become available...");
  const dockerBecameReachable = await waitForDocker(cli, 30_000);
  if (dockerBecameReachable) {
    console.warn("[dev] Docker is now reachable.");
    return;
  }

  console.warn("[dev] Docker is still not reachable after 30 seconds. Continuing in local UI mode.");
}

const apiPort = await resolveDevApiPort();
const apiHost = localDevEnv.HOST || "127.0.0.1";
localDevEnv.PORT = String(apiPort);
localDevEnv.ATOLL_API_ORIGIN = `http://${apiHost}:${apiPort}`;

await ensureDockerForDev();

const { result } = concurrently(
  [
    {
      command: "npm run dev:api",
      name: "api",
      cwd: repoRoot,
      env: localDevEnv,
    },
    {
      command: "npm run dev:web",
      name: "web",
      cwd: repoRoot,
      env: localDevEnv,
    },
  ],
  {
    prefix: "name",
    prefixColors: ["cyan", "magenta"],
    killOthersOn: ["failure"],
  },
);

try {
  await result;
} catch (error) {
  process.exitCode = 1;
}
