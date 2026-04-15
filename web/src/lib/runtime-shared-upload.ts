export type RuntimeSharedUploadItem = {
  file: File;
  relativePath?: string;
};

type FileWithWebkitRelativePath = File & {
  webkitRelativePath?: string;
};

type RuntimeSharedDataTransferItem = {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

export type RuntimeSharedUploadDataTransfer = {
  files?: ArrayLike<File>;
  items?: ArrayLike<RuntimeSharedDataTransferItem>;
};

export function normalizeRuntimeSharedUploadItemsFromFileList(files: ArrayLike<File>): RuntimeSharedUploadItem[] {
  return Array.from(files).map((file) => {
    const relativePath = normalizeRelativePath((file as FileWithWebkitRelativePath).webkitRelativePath);
    if (relativePath) {
      return {
        file,
        relativePath
      };
    }
    return { file };
  });
}

export function chunkRuntimeSharedUploadItems(
  items: RuntimeSharedUploadItem[],
  chunkSize = 10
): RuntimeSharedUploadItem[][] {
  const safeChunkSize = Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : 10;
  const chunks: RuntimeSharedUploadItem[][] = [];
  for (let index = 0; index < items.length; index += safeChunkSize) {
    chunks.push(items.slice(index, index + safeChunkSize));
  }
  return chunks;
}

export async function extractRuntimeSharedUploadItemsFromDataTransfer(
  dataTransfer: RuntimeSharedUploadDataTransfer
): Promise<RuntimeSharedUploadItem[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (entries.length === 0) {
    return normalizeRuntimeSharedUploadItemsFromFileList(dataTransfer.files ?? []);
  }

  const output: RuntimeSharedUploadItem[] = [];
  for (const entry of entries) {
    await collectEntryUploadItems(entry, "", output);
  }
  return dedupeRuntimeSharedUploadItems(output);
}

async function collectEntryUploadItems(
  entry: FileSystemEntry,
  basePath: string,
  output: RuntimeSharedUploadItem[]
): Promise<void> {
  const nextPath = joinPath(basePath, entry.name);
  if (isFileSystemFileEntry(entry)) {
    const file = await readEntryFile(entry);
    if (!file) return;
    output.push({
      file,
      relativePath: normalizeRelativePath(nextPath) ?? file.name
    });
    return;
  }
  if (!isFileSystemDirectoryEntry(entry)) {
    return;
  }

  const children = await readDirectoryEntries(entry.createReader());
  for (const child of children) {
    await collectEntryUploadItems(child, nextPath, output);
  }
}

function readEntryFile(entry: FileSystemFileEntry): Promise<File | undefined> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(undefined)
    );
  });
}

async function readDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries(
        (nextEntries) => resolve(nextEntries),
        () => resolve([])
      );
    });
    if (batch.length === 0) {
      return entries;
    }
    entries.push(...batch);
  }
}

function dedupeRuntimeSharedUploadItems(items: RuntimeSharedUploadItem[]): RuntimeSharedUploadItem[] {
  const seen = new Set<string>();
  const deduped: RuntimeSharedUploadItem[] = [];
  for (const item of items) {
    const key = item.relativePath ?? item.file.name;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function joinPath(prefix: string, segment: string): string {
  if (!prefix) return segment;
  return `${prefix}/${segment}`;
}

function normalizeRelativePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment))
    .join("/");
  return normalized || undefined;
}

function isFileSystemFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

function isFileSystemDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}
