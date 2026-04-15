import { describe, expect, it } from "vitest";

import {
  chunkRuntimeSharedUploadItems,
  extractRuntimeSharedUploadItemsFromDataTransfer,
  normalizeRuntimeSharedUploadItemsFromFileList,
  type RuntimeSharedUploadItem
} from "@/lib/runtime-shared-upload";

type MockFileSystemFileEntry = {
  isFile: true;
  isDirectory: false;
  name: string;
  file: (
    success: (file: File) => void,
    error?: (error: unknown) => void
  ) => void;
};

type MockFileSystemDirectoryEntry = {
  isFile: false;
  isDirectory: true;
  name: string;
  createReader: () => {
    readEntries: (
      success: (entries: MockFileSystemEntry[]) => void,
      error?: (error: unknown) => void
    ) => void;
  };
};

type MockFileSystemEntry = MockFileSystemFileEntry | MockFileSystemDirectoryEntry;

function createFile(name: string, content = "x"): File {
  return new File([content], name, { type: "text/plain" });
}

function createDirectoryEntry(name: string, entries: MockFileSystemEntry[]): MockFileSystemDirectoryEntry {
  let hasRead = false;
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => ({
      readEntries: (success) => {
        if (hasRead) {
          success([]);
          return;
        }
        hasRead = true;
        success(entries);
      }
    })
  };
}

function createFileEntry(file: File): MockFileSystemFileEntry {
  return {
    isFile: true,
    isDirectory: false,
    name: file.name,
    file: (success) => {
      success(file);
    }
  };
}

describe("runtime shared upload helpers", () => {
  it("uses webkitRelativePath when normalizing FileList items", () => {
    const file = createFile("guide.txt");
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: "docs/setup/guide.txt"
    });

    const normalized = normalizeRuntimeSharedUploadItemsFromFileList([file]);
    expect(normalized).toEqual<RuntimeSharedUploadItem[]>([
      {
        file,
        relativePath: "docs/setup/guide.txt"
      }
    ]);
  });

  it("chunks uploads into groups of 10 files", () => {
    const items = Array.from({ length: 23 }, (_, index) => ({
      file: createFile(`file-${index + 1}.txt`)
    }));

    const chunks = chunkRuntimeSharedUploadItems(items);
    expect(chunks.map((chunk) => chunk.length)).toEqual([10, 10, 3]);
  });

  it("extracts folder drops recursively when webkit entries are available", async () => {
    const nestedFile = createFile("guide.txt");
    const folderEntry = createDirectoryEntry("docs", [
      createDirectoryEntry("setup", [createFileEntry(nestedFile)])
    ]);
    const payload = {
      items: [
        {
          webkitGetAsEntry: () => folderEntry as unknown as FileSystemEntry
        }
      ],
      files: []
    };

    const normalized = await extractRuntimeSharedUploadItemsFromDataTransfer(payload);
    expect(normalized).toEqual<RuntimeSharedUploadItem[]>([
      {
        file: nestedFile,
        relativePath: "docs/setup/guide.txt"
      }
    ]);
  });

  it("falls back to plain files when entry APIs are unavailable", async () => {
    const fallbackFile = createFile("archive.zip", "zip");
    const payload = {
      items: [],
      files: [fallbackFile]
    };

    const normalized = await extractRuntimeSharedUploadItemsFromDataTransfer(payload);
    expect(normalized).toEqual<RuntimeSharedUploadItem[]>([{ file: fallbackFile }]);
  });
});
