import type { RuntimeSharedFile } from "@/lib/api";

export type RuntimeSharedFileTreeNode = {
  name: string;
  path: string;
  folders: RuntimeSharedFileTreeNode[];
  files: RuntimeSharedFile[];
};

type MutableTreeNode = {
  name: string;
  path: string;
  folders: Map<string, MutableTreeNode>;
  files: RuntimeSharedFile[];
};

const PATH_SEPARATOR = "/";

export function buildRuntimeSharedFileTree(files: RuntimeSharedFile[]): RuntimeSharedFileTreeNode {
  const root: MutableTreeNode = {
    name: "",
    path: "",
    folders: new Map(),
    files: [],
  };

  for (const file of files) {
    const segments = splitRuntimeSharedPath(file.relativePath);
    if (segments.length === 0) {
      root.files.push(file);
      continue;
    }

    const fileName = segments[segments.length - 1];
    if (segments.length === 1 || fileName !== file.name) {
      root.files.push(file);
      continue;
    }

    let cursor = root;
    const folderSegments = segments.slice(0, -1);
    for (const segment of folderSegments) {
      const nextPath = cursor.path ? `${cursor.path}${PATH_SEPARATOR}${segment}` : segment;
      const existingNode = cursor.folders.get(segment);
      if (existingNode) {
        cursor = existingNode;
        continue;
      }

      const nextNode: MutableTreeNode = {
        name: segment,
        path: nextPath,
        folders: new Map(),
        files: [],
      };
      cursor.folders.set(segment, nextNode);
      cursor = nextNode;
    }

    cursor.files.push(file);
  }

  return toRuntimeSharedFileTreeNode(root);
}

export function listRuntimeSharedFilesInFolder(
  files: RuntimeSharedFile[],
  folderPath: string
): RuntimeSharedFile[] {
  const normalizedFolderPath = splitRuntimeSharedPath(folderPath).join(PATH_SEPARATOR);
  if (!normalizedFolderPath) {
    return [];
  }

  const folderPrefix = `${normalizedFolderPath}${PATH_SEPARATOR}`;
  return files
    .filter((file) => {
      const normalizedPath = splitRuntimeSharedPath(file.relativePath).join(PATH_SEPARATOR);
      return normalizedPath.startsWith(folderPrefix);
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: "base" }));
}

function toRuntimeSharedFileTreeNode(node: MutableTreeNode): RuntimeSharedFileTreeNode {
  const folders = Array.from(node.folders.values())
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))
    .map((entry) => toRuntimeSharedFileTreeNode(entry));
  const files = [...node.files].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: "base" })
  );

  return {
    name: node.name,
    path: node.path,
    folders,
    files,
  };
}

function splitRuntimeSharedPath(path: string): string[] {
  return path
    .split(PATH_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment));
}
