import { generateAI } from "../../ai-router/src";
import { applyMergePlan, type MergePlan, type MergeResult } from "../../merge-engine/src";
import {
  defaultModulesForTemplate,
  resolveModuleDependencies,
  type ModuleDefinition,
  type TemplateKind,
} from "../../module-registry/src";
import { getTemplate, pickTemplate } from "../../template-engine/src";
import { validateBuildPlan } from "../../validator/src";
import { startPreview } from "../../preview-engine/src";

export interface IntentPayload {
  description: string;
  userId: string;
  projectId?: string;
  forceTemplate?: TemplateKind;
  requestedModules?: string[];
  preview?: boolean;
}

export interface ArchitectureDecision {
  template: TemplateKind;
  modules: string[];
  migrations: string[];
  dependencies: string[];
}

export interface OrchestrationOutput {
  files: Record<string, string>;
  routes: Array<{ path: string; file: string }>;
  dependencies: string[];
  validation: { valid: boolean; issues: string[] };
  versionTag: string;
  architecture: ArchitectureDecision;
  steps: string[];
  preview?: {
    status: "queued" | "installing" | "running" | "error" | "stopped";
    url?: string;
    logs: string[];
  };
}

interface ParsedIntent {
  systemType: "saas" | "dashboard" | "crud" | "marketplace";
  modules: string[];
  keywords: string[];
}

function detectSystemType(text: string): ParsedIntent["systemType"] {
  const normalized = text.toLowerCase();
  if (normalized.includes("marketplace") || normalized.includes("catalogo") || normalized.includes("catálogo")) {
    return "marketplace";
  }
  if (normalized.includes("crud")) return "crud";
  if (normalized.includes("analytics") || normalized.includes("dashboard")) return "dashboard";
  return "saas";
}

function extractModules(text: string): string[] {
  const normalized = text.toLowerCase();
  const modules: string[] = [];

  const map: Array<{ keyword: string; module: string }> = [
    { keyword: "auth", module: "auth" },
    { keyword: "login", module: "auth" },
    { keyword: "tenant", module: "multi-tenant" },
    { keyword: "multi", module: "multi-tenant" },
    { keyword: "pagamento", module: "payments" },
    { keyword: "payment", module: "payments" },
    { keyword: "booking", module: "booking" },
    { keyword: "agenda", module: "booking" },
    { keyword: "admin", module: "admin" },
    { keyword: "analytics", module: "analytics" },
    { keyword: "relatorio", module: "analytics" },
    { keyword: "notificacao", module: "notifications" },
    { keyword: "upload", module: "file-upload" },
    { keyword: "arquivo", module: "file-upload" },
  ];

  for (const item of map) {
    if (normalized.includes(item.keyword)) {
      modules.push(item.module);
    }
  }

  return [...new Set(modules)];
}

function parseIntent(description: string): ParsedIntent {
  const systemType = detectSystemType(description);
  const modules = extractModules(description);

  return {
    systemType,
    modules,
    keywords: description.toLowerCase().split(/\s+/).filter((token) => token.length > 2),
  };
}

async function aiModuleAssist(description: string): Promise<string[]> {
  try {
    const response = await Promise.race([
      generateAI({
        task: "module_suggestion",
        complexity: "low",
        prompt:
          "Return strict JSON {\"modules\":[...]} using only: auth,multi-tenant,payments,booking,admin,analytics,notifications,file-upload. Input: " +
          description,
        retries: 1,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("ai_module_assist_timeout")), 2500);
      }),
    ]);

    const match = response.text.match(/\{[\s\S]*\}/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]) as { modules?: unknown };
    if (!Array.isArray(parsed.modules)) return [];

    return parsed.modules
      .map((value) => String(value).trim())
      .filter((value) =>
        ["auth", "multi-tenant", "payments", "booking", "admin", "analytics", "notifications", "file-upload"].includes(
          value,
        ),
      );
  } catch {
    return [];
  }
}

function templateFromSystemType(systemType: ParsedIntent["systemType"]): TemplateKind {
  if (systemType === "marketplace") return "marketplace-base";
  if (systemType === "dashboard") return "dashboard-base";
  if (systemType === "crud") return "crud-base";
  return "saas-base";
}

function buildModulePlan(modules: ModuleDefinition[]): MergePlan {
  const create = modules.flatMap((moduleDef) => moduleDef.create);
  const update = modules.flatMap((moduleDef) => moduleDef.update);
  const dependencies = modules.flatMap((moduleDef) => moduleDef.dependencies);
  const routes = modules.flatMap((moduleDef) => moduleDef.routes);

  return { create, update, dependencies, routes };
}

function mergePackageDependencies(files: Record<string, string>, deps: string[]): Record<string, string> {
  if (!files["package.json"]) return files;

  const parsed = JSON.parse(files["package.json"]) as {
    dependencies?: Record<string, string>;
  };

  const base = {
    ...(parsed.dependencies || {}),
  };

  for (const dep of deps) {
    if (!base[dep]) {
      base[dep] = "latest";
    }
  }

  parsed.dependencies = base;

  return {
    ...files,
    "package.json": JSON.stringify(parsed, null, 2),
  };
}

function writeSidebarFromModules(files: Record<string, string>, modules: ModuleDefinition[]): Record<string, string> {
  const items = modules.flatMap((moduleDef) => moduleDef.sidebarItems);
  const deduped = items.filter((item, index) => items.findIndex((candidate) => candidate.href === item.href) === index);
  const entries = deduped.map((item) => `  { label: \"${item.label}\", href: \"${item.href}\" },`).join("\n");
  const content = `export const sidebarItems = [\n${entries}\n  /* neurax:sidebar-items */\n];\n`;

  return {
    ...files,
    "src/config/sidebar.ts": content,
  };
}

function aggregateDecision(template: TemplateKind, modules: ModuleDefinition[]): ArchitectureDecision {
  return {
    template,
    modules: modules.map((moduleDef) => moduleDef.name),
    migrations: modules.flatMap((moduleDef) => moduleDef.dbMigrations),
    dependencies: [...new Set(modules.flatMap((moduleDef) => moduleDef.dependencies))],
  };
}

export async function runOrchestration(payload: IntentPayload): Promise<OrchestrationOutput> {
  const steps: string[] = [];

  steps.push("1_parse_intent");
  const parsed = parseIntent(payload.description);
  const assistedModules = await aiModuleAssist(payload.description);

  steps.push("2_identify_system_type");
  const preferredTemplate = payload.forceTemplate || templateFromSystemType(parsed.systemType);

  steps.push("3_select_base_template");
  const template = getTemplate(payload.forceTemplate || pickTemplate([preferredTemplate, ...parsed.modules, ...assistedModules]));

  steps.push("4_select_modules");
  const selectedModules = [
    ...defaultModulesForTemplate(template.name),
    ...parsed.modules,
    ...assistedModules,
    ...(payload.requestedModules || []),
  ];

  steps.push("5_resolve_dependencies");
  const resolvedModules = resolveModuleDependencies([...new Set(selectedModules)]);

  steps.push("6_apply_modules_merge_controlled");
  const modulePlan = buildModulePlan(resolvedModules);
  const merged: MergeResult = applyMergePlan(template.files, modulePlan);

  const withSidebar = writeSidebarFromModules(merged.files, resolvedModules);
  const withDeps = mergePackageDependencies(withSidebar, [...template.requiredDependencies, ...merged.dependencies]);

  steps.push("7_validate_imports");
  steps.push("8_validate_dependencies");
  steps.push("9_attempt_build");
  const validation = validateBuildPlan({
    files: withDeps,
    routes: merged.routes,
    requiredDeps: [...template.requiredDependencies, ...merged.dependencies],
  });

  steps.push("10_version");
  const versionTag = `v-${Date.now()}`;

  let previewResult: OrchestrationOutput["preview"];

  if (payload.preview) {
    steps.push("11_execute_preview");
    try {
      const runnerUrl = process.env.PREVIEW_RUNNER_URL || "http://127.0.0.1:4310";
      const preview = await startPreview(
        {
          projectId: payload.projectId || payload.userId,
          files: withDeps,
        },
        runnerUrl,
      );
      previewResult = {
        status: preview.status,
        url: preview.url,
        logs: preview.logs,
      };
    } catch (error) {
      previewResult = {
        status: "error",
        logs: [error instanceof Error ? error.message : "preview_failed"],
      };
    }
  }

  return {
    files: withDeps,
    routes: merged.routes,
    dependencies: [...template.requiredDependencies, ...merged.dependencies],
    validation: {
      valid: validation.ok,
      issues: validation.issues.map((issue) => `${issue.code}:${issue.file || "global"}:${issue.message}`),
    },
    versionTag,
    architecture: aggregateDecision(template.name, resolvedModules),
    steps,
    preview: previewResult,
  };
}
