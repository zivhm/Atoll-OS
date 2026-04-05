import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";

const preservedEnvNames = new Set(Object.keys(process.env));
const loadedEnvFiles = new Set<string>();

export function loadEnvFileIfPresent(cwd = process.cwd()): void {
  const envPaths = findAncestorFiles(cwd, ".env");
  if (envPaths.length === 0) {
    return;
  }

  // Load parent .env files first so nearer directories can override ancestor defaults.
  for (const envPath of envPaths) {
    if (loadedEnvFiles.has(envPath)) {
      continue;
    }

    const envEntries = parseEnv(readFileSync(envPath, "utf8"));
    for (const [name, value] of Object.entries(envEntries)) {
      if (preservedEnvNames.has(name)) {
        continue;
      }
      process.env[name] = value;
    }

    loadedEnvFiles.add(envPath);
  }
}

export function getEnvValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function findAncestorFiles(startPath: string, fileName: string): string[] {
  let current = resolve(startPath);
  const matches: string[] = [];

  while (true) {
    const candidate = resolve(current, fileName);
    if (existsSync(candidate)) {
      matches.push(candidate);
    }

    const parent = dirname(current);
    if (parent === current) {
      return matches.reverse();
    }
    current = parent;
  }
}
