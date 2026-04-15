import { describe, expect, it } from "vitest";

import type { RuntimeSharedFile } from "@/lib/api";
import { buildRuntimeSharedFileTree, listRuntimeSharedFilesInFolder } from "@/lib/runtime-shared-files-tree";

function createSharedFile(relativePath: string): RuntimeSharedFile {
  const parts = relativePath.split("/");
  return {
    id: relativePath,
    name: parts[parts.length - 1] ?? relativePath,
    relativePath,
    sizeBytes: 100,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("runtime shared files tree", () => {
  it("groups files by folder path for IDE-style rendering", () => {
    const tree = buildRuntimeSharedFileTree([
      createSharedFile("archive/docs/setup.md"),
      createSharedFile("archive/notes.txt"),
    ]);

    expect(tree.files).toEqual([]);
    expect(tree.folders).toHaveLength(1);
    expect(tree.folders[0]?.name).toBe("archive");
    expect(tree.folders[0]?.files.map((file) => file.relativePath)).toEqual(["archive/notes.txt"]);
    expect(tree.folders[0]?.folders[0]?.path).toBe("archive/docs");
    expect(tree.folders[0]?.folders[0]?.files.map((file) => file.relativePath)).toEqual(["archive/docs/setup.md"]);
  });

  it("keeps archives as files and does not expand their contents", () => {
    const tree = buildRuntimeSharedFileTree([createSharedFile("incoming/archive.zip")]);

    expect(tree.folders[0]?.name).toBe("incoming");
    expect(tree.folders[0]?.files.map((file) => file.name)).toEqual(["archive.zip"]);
    expect(tree.folders[0]?.folders).toEqual([]);
  });

  it("sorts folders and files by relative path", () => {
    const tree = buildRuntimeSharedFileTree([
      createSharedFile("z-folder/file-b.txt"),
      createSharedFile("a-folder/file-c.txt"),
      createSharedFile("root-b.txt"),
      createSharedFile("root-a.txt"),
    ]);

    expect(tree.folders.map((folder) => folder.name)).toEqual(["a-folder", "z-folder"]);
    expect(tree.files.map((file) => file.name)).toEqual(["root-a.txt", "root-b.txt"]);
  });

  it("lists files in a folder recursively with boundary-safe prefix matching", () => {
    const files = [
      createSharedFile("archive/docs/a.txt"),
      createSharedFile("archive/docs/sub/b.txt"),
      createSharedFile("archive/docs-2/c.txt"),
      createSharedFile("archive/notes.txt"),
    ];

    const selected = listRuntimeSharedFilesInFolder(files, "archive/docs");
    expect(selected.map((file) => file.relativePath)).toEqual([
      "archive/docs/a.txt",
      "archive/docs/sub/b.txt",
    ]);
  });
});
