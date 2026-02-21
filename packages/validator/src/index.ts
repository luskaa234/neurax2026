export interface ValidationIssue {
  code: "missing_file" | "invalid_import" | "missing_dependency" | "duplicate_route" | "blocked_write";
  message: string;
  file?: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
}

const REQUIRED_FILES = [
  "package.json",
  ".env.example",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/middleware.ts",
  "tailwind.config.ts",
];

export function validateRequiredFiles(files: Record<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const required of REQUIRED_FILES) {
    if (!files[required]) {
      issues.push({ code: "missing_file", file: required, message: `Required file is missing: ${required}` });
    }
  }
  return issues;
}

export function validateImports(files: Record<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
    if (content.includes("from ''") || content.includes('from ""')) {
      issues.push({ code: "invalid_import", file: path, message: "Import source is empty" });
    }
  }
  return issues;
}

export function validateDependencies(files: Record<string, string>, requiredDeps: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let deps: Record<string, string> = {};
  try {
    const packageJson = JSON.parse(files["package.json"] || "{}") as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };
  } catch {
    return [{ code: "missing_dependency", message: "Invalid package.json" }];
  }

  for (const dep of requiredDeps) {
    if (!deps[dep]) {
      issues.push({ code: "missing_dependency", message: `Dependency missing: ${dep}` });
    }
  }

  return issues;
}

export function validateRoutes(routes: Array<{ path: string; file: string }>): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];

  for (const route of routes) {
    if (seen.has(route.path)) {
      issues.push({ code: "duplicate_route", file: route.file, message: `Duplicate route path: ${route.path}` });
      continue;
    }
    seen.add(route.path);
  }

  return issues;
}

export function validateBuildPlan(input: {
  files: Record<string, string>;
  routes: Array<{ path: string; file: string }>;
  requiredDeps: string[];
}): ValidationReport {
  const issues = [
    ...validateRequiredFiles(input.files),
    ...validateImports(input.files),
    ...validateDependencies(input.files, input.requiredDeps),
    ...validateRoutes(input.routes),
  ];

  return {
    ok: issues.length === 0,
    issues,
  };
}
