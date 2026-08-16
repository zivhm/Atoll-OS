import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testsDirectory = fileURLToPath(new URL("../tests/", import.meta.url));

function collectTestFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectTestFiles(path) : [path];
    })
    .filter((path) => path.endsWith(`.test${extname(path)}`))
    .sort();
}

const testFiles = collectTestFiles(testsDirectory);
if (testFiles.length === 0) {
  throw new Error(`No API test files found in ${testsDirectory}`);
}

const result = spawnSync(
  process.execPath,
  ["--test", "--import", "tsx", ...testFiles],
  { stdio: "inherit" }
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
