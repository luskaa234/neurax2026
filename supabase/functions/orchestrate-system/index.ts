import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../../lib/config.ts";

type TemplateName = "saas-base" | "marketplace-base" | "dashboard-base" | "crud-base";

const MODULE_DEPENDENCIES: Record<string, string[]> = {
  auth: [],
  "multi-tenant": ["auth"],
  payments: ["auth", "multi-tenant"],
  booking: ["auth"],
  admin: ["auth"],
  analytics: ["auth"],
  notifications: ["auth"],
  "file-upload": ["auth"],
};

function detectTemplate(description: string): TemplateName {
  const normalized = description.toLowerCase();
  if (normalized.includes("marketplace") || normalized.includes("catálogo") || normalized.includes("catalogo")) {
    return "marketplace-base";
  }
  if (normalized.includes("analytics") || normalized.includes("dashboard")) {
    return "dashboard-base";
  }
  if (normalized.includes("crud")) {
    return "crud-base";
  }
  return "saas-base";
}

function detectModules(description: string): string[] {
  const normalized = description.toLowerCase();
  const detected: string[] = [];
  const rules: Array<{ keyword: string; module: string }> = [
    { keyword: "login", module: "auth" },
    { keyword: "auth", module: "auth" },
    { keyword: "tenant", module: "multi-tenant" },
    { keyword: "pagamento", module: "payments" },
    { keyword: "booking", module: "booking" },
    { keyword: "agenda", module: "booking" },
    { keyword: "admin", module: "admin" },
    { keyword: "analytics", module: "analytics" },
    { keyword: "notificacao", module: "notifications" },
    { keyword: "upload", module: "file-upload" },
  ];

  for (const rule of rules) {
    if (normalized.includes(rule.keyword)) {
      detected.push(rule.module);
    }
  }

  if (!detected.includes("auth")) {
    detected.push("auth");
  }

  return [...new Set(detected)];
}

function resolveDependencies(input: string[]): string[] {
  const resolved = new Set<string>();
  const queue = [...input];

  while (queue.length > 0) {
    const moduleName = queue.shift() as string;
    if (resolved.has(moduleName)) continue;
    resolved.add(moduleName);

    for (const dep of MODULE_DEPENDENCIES[moduleName] || []) {
      if (!resolved.has(dep)) queue.push(dep);
    }
  }

  return [...resolved];
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  console.log("CORS ORIGIN:", req.headers.get("origin"));
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ code: "unauthorized", message: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const supabaseAdmin = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
    const supabaseUser = createClient(getSupabaseUrl(), getSupabaseAnonKey(), { global: { headers: { Authorization: authHeader } } });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ code: "unauthorized", message: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const body = (await req.json()) as {
      projectId: string;
      description: string;
      mode?: "intent" | "manual";
      selectedModules?: string[];
      selectedTemplate?: TemplateName;
      prompt?: string;
    };

    if (!body.projectId || !body.description) {
      return new Response(JSON.stringify({ code: "invalid_input", message: "projectId and description are required" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const template = body.selectedTemplate || detectTemplate(body.description);
    const requestedModules = Array.isArray(body.selectedModules) ? body.selectedModules : detectModules(body.description);
    const modules = resolveDependencies(requestedModules);

    await supabaseAdmin
      .from("projects")
      .update({
        status: "orchestrating",
        creation_mode: body.mode || "intent",
        parsed_prompt: { template, modules },
        original_prompt: body.prompt || body.description,
      })
      .eq("id", body.projectId)
      .eq("user_id", userData.user.id);

    await supabaseAdmin.from("project_logs").insert({
      project_id: body.projectId,
      action: `orchestrator_template_${template}`,
      user_id: userData.user.id,
    });

    await supabaseAdmin.from("project_logs").insert({
      project_id: body.projectId,
      action: "orchestrator_pipeline_ready",
      user_id: userData.user.id,
    });

    await supabaseAdmin.from("projects").update({ status: "ready" }).eq("id", body.projectId);

    await supabaseAdmin.from("project_versions").insert({
      project_id: body.projectId,
      version: 1,
      ai_provider: "router",
      build_notes: `template=${template};modules=${modules.join(",")}`,
    });

    return new Response(JSON.stringify({ ok: true, template, modules, status: "ready" }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("orchestrate-system error:", error instanceof Error ? { message: error.message, stack: error.stack } : error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ code: "internal_error", message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
