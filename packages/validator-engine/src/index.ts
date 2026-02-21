export interface ValidationIssue {
  type: "import" | "dependency" | "type" | "route" | "build";
  message: string;
  file?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateImports(files: Record<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
    if (content.includes("from ''") || content.includes('from ""')) {
      issues.push({ type: "import", file: path, message: "Empty import source" });
    }
  }
  return issues;
}

export function validateDependencies(packageJson: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  try {
    const parsed = JSON.parse(packageJson) as { dependencies?: Record<string, string> };
    if (!parsed.dependencies || Object.keys(parsed.dependencies).length === 0) {
      issues.push({ type: "dependency", message: "No dependencies declared" });
    }
  } catch {
    issues.push({ type: "dependency", message: "Invalid package.json" });
  }
  return issues;
}

export function validateTypes(files: Record<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [path, content] of Object.entries(files)) {
    if ((path.endsWith(".ts") || path.endsWith(".tsx")) && content.includes(": any")) {
      issues.push({ type: "type", file: path, message: "Avoid any type" });
    }
  }
  return issues;
}

export function validateRoutes(routes: Array<{ path: string; file: string }>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const route of routes) {
    if (seen.has(route.path)) {
      issues.push({ type: "route", file: route.file, message: `Duplicate route ${route.path}` });
    }
    seen.add(route.path);
  }
  return issues;
}

export function attemptBuild(files: Record<string, string>): ValidationIssue[] {
  if (!files["package.json"]) {
    return [{ type: "build", message: "Missing package.json" }];
  }
  return [];
}

export function errorScanner(issues: ValidationIssue[]): string[] {
  return issues.map((issue) => `${issue.type}:${issue.file || "global"}:${issue.message}`);
}

export function autoFixAttempt(files: Record<string, string>): Record<string, string> {
  const fixed = { ...files };
  for (const [path, content] of Object.entries(fixed)) {
    fixed[path] = content.replace(/: any/g, ": unknown");
  }
  return fixed;
}

export function runValidation(files: Record<string, string>, routes: Array<{ path: string; file: string }>): ValidationResult {
  const packageJson = files["package.json"] || "{}";
  const issues = [
    ...validateImports(files),
    ...validateDependencies(packageJson),
    ...validateTypes(files),
    ...validateRoutes(routes),
    ...attemptBuild(files),
  ];
  return { valid: issues.length === 0, issues };
}
