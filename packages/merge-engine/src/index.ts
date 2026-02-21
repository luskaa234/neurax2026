export interface MergeFile {
  path: string;
  content: string;
}

export interface MergeRoute {
  path: string;
  file: string;
}

export interface MergePlan {
  create: MergeFile[];
  update: MergeFile[];
  dependencies: string[];
  routes: MergeRoute[];
}

export interface FileMap {
  [path: string]: string;
}

export interface MergeResult {
  files: FileMap;
  routes: MergeRoute[];
  dependencies: string[];
  warnings: string[];
}

const CRITICAL_PATHS = new Set([
  "package.json",
  "next.config.mjs",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/middleware.ts",
  ".env.example",
]);

function isCritical(path: string): boolean {
  return CRITICAL_PATHS.has(path);
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

function safeCreate(files: FileMap, item: MergeFile, warnings: string[]): void {
  const path = normalizePath(item.path);
  if (files[path] !== undefined) {
    warnings.push(`create_skipped_exists:${path}`);
    return;
  }
  files[path] = item.content;
}

function safeUpdate(files: FileMap, item: MergeFile, warnings: string[]): void {
  const path = normalizePath(item.path);
  if (isCritical(path)) {
    warnings.push(`update_blocked_critical:${path}`);
    return;
  }
  if (files[path] === undefined) {
    warnings.push(`update_skipped_missing:${path}`);
    return;
  }
  files[path] = item.content;
}

function uniqueDependencies(input: string[]): string[] {
  return [...new Set(input.map((dep) => dep.trim()).filter(Boolean))];
}

function uniqueRoutes(input: MergeRoute[]): MergeRoute[] {
  const seen = new Set<string>();
  const routes: MergeRoute[] = [];
  for (const route of input) {
    if (!route.path || !route.file) continue;
    if (seen.has(route.path)) continue;
    seen.add(route.path);
    routes.push({ path: route.path, file: normalizePath(route.file) });
  }
  return routes;
}

export function applyMergePlan(initialFiles: FileMap, plan: MergePlan): MergeResult {
  const files = { ...initialFiles };
  const warnings: string[] = [];

  for (const item of plan.create) {
    safeCreate(files, item, warnings);
  }

  for (const item of plan.update) {
    safeUpdate(files, item, warnings);
  }

  return {
    files,
    routes: uniqueRoutes(plan.routes),
    dependencies: uniqueDependencies(plan.dependencies),
    warnings,
  };
}

export function appendRoute(routes: MergeRoute[], next: MergeRoute): MergeRoute[] {
  if (routes.some((route) => route.path === next.path)) return routes;
  return [...routes, next];
}
