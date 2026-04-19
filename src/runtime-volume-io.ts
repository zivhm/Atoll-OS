import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix as pathPosix } from "node:path";

const DEFAULT_RUNTIME_VOLUME_IO_IMAGE = "alpine:3.20";
const MISSING_FILE_EXIT_CODE = 44;

export type RuntimeVolumeIoRunnerResult = {
  ok: boolean;
  output: Buffer;
  message: string;
};

export type RuntimeVolumeIoRunner = (
  args: string[],
  label: string,
  options?: {
    input?: Buffer;
    ignoreExitCodes?: number[];
  }
) => Promise<RuntimeVolumeIoRunnerResult>;

export function createRuntimeVolumeIo(
  runDocker: RuntimeVolumeIoRunner,
  image = DEFAULT_RUNTIME_VOLUME_IO_IMAGE
) {
  return {
    async readFile(input: {
      volumeName: string;
      mountPath: string;
      filePath: string;
      label: string;
    }): Promise<{ found: boolean; content: Buffer }> {
      const result = await runDocker(
        [
          "run",
          "--rm",
          "--entrypoint",
          "sh",
          "-v",
          `${input.volumeName}:${input.mountPath}:ro`,
          image,
          "-lc",
          `if [ -f ${toShellSingleQuoted(input.filePath)} ]; then cat ${toShellSingleQuoted(input.filePath)}; else exit ${MISSING_FILE_EXIT_CODE}; fi`,
        ],
        input.label,
        {
          ignoreExitCodes: [MISSING_FILE_EXIT_CODE],
        }
      );

      if (!result.ok) {
        return {
          found: false,
          content: Buffer.alloc(0),
        };
      }

      return {
        found: true,
        content: result.output,
      };
    },

    async writeFile(input: {
      volumeName: string;
      mountPath: string;
      filePath: string;
      content: Buffer;
      label: string;
    }): Promise<void> {
      const tempDir = await mkdtemp(join(tmpdir(), "atoll-runtime-volume-io-"));
      const tempFilePath = join(tempDir, "payload");

      try {
        await writeFile(tempFilePath, input.content);

        const result = await runDocker(
          [
            "run",
            "--rm",
            "--entrypoint",
            "sh",
            "-v",
            `${input.volumeName}:${input.mountPath}`,
            "--mount",
            `type=bind,src=${tempDir},dst=/atoll-runtime-volume-io,readonly`,
            image,
            "-lc",
            `mkdir -p ${toShellSingleQuoted(pathPosix.dirname(input.filePath))} && cp /atoll-runtime-volume-io/payload ${toShellSingleQuoted(input.filePath)}`,
          ],
          input.label
        );

        if (!result.ok) {
          throw new Error(`Container CLI command failed (${input.label}): ${result.message}`);
        }
      } finally {
        await rm(tempDir, {
          recursive: true,
          force: true,
        });
      }
    },

    async deleteFile(input: {
      volumeName: string;
      mountPath: string;
      filePath: string;
      label: string;
    }): Promise<void> {
      const result = await runDocker(
        [
          "run",
          "--rm",
          "--entrypoint",
          "sh",
          "-v",
          `${input.volumeName}:${input.mountPath}`,
          image,
          "-lc",
          `rm -f ${toShellSingleQuoted(input.filePath)}`,
        ],
        input.label
      );

      if (!result.ok) {
        throw new Error(`Container CLI command failed (${input.label}): ${result.message}`);
      }
    },
  };
}

function toShellSingleQuoted(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}
