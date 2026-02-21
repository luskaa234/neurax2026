export interface FileNode {
  id: string;
  path: string;
  name: string;
  type: "file";
}

export interface FolderNode {
  id: string;
  path: string;
  name: string;
  type: "folder";
  children: FolderNode[];
  files: FileNode[];
}

export interface FileTreeInput {
  id: string;
  path: string;
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+/g, "/");
}

function folderId(path: string): string {
  return `folder:${path || "."}`;
}

export function buildFileTree(items: FileTreeInput[]): FolderNode {
  const root: FolderNode = {
    id: folderId("."),
    path: ".",
    name: ".",
    type: "folder",
    children: [],
    files: [],
  };

  const folderMap = new Map<string, FolderNode>();
  folderMap.set(".", root);

  const ensureFolder = (folderPath: string): FolderNode => {
    const normalized = folderPath || ".";
    const existing = folderMap.get(normalized);
    if (existing) return existing;

    const parts = normalized.split("/").filter(Boolean);
    const name = parts[parts.length - 1] || ".";
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    const parent = ensureFolder(parentPath);

    const folder: FolderNode = {
      id: folderId(normalized),
      path: normalized,
      name,
      type: "folder",
      children: [],
      files: [],
    };

    parent.children.push(folder);
    parent.children.sort((a, b) => a.name.localeCompare(b.name));
    folderMap.set(normalized, folder);

    return folder;
  };

  for (const item of items) {
    const normalizedPath = normalizePath(item.path);
    if (!normalizedPath) continue;

    const parts = normalizedPath.split("/");
    const fileName = parts[parts.length - 1];
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";

    const parent = ensureFolder(parentPath);
    parent.files.push({
      id: item.id,
      path: normalizedPath,
      name: fileName,
      type: "file",
    });
    parent.files.sort((a, b) => a.name.localeCompare(b.name));
  }

  return root;
}

export function flattenFolderPaths(folder: FolderNode): string[] {
  const output: string[] = [];

  const walk = (node: FolderNode) => {
    if (node.path !== ".") output.push(node.path);
    for (const child of node.children) walk(child);
  };

  walk(folder);
  return output;
}
