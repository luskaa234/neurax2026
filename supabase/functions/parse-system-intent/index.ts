import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { geminiGenerate } from "../_shared/gemini.ts";
import { parsePossiblyWrappedJson } from "../_shared/json.ts";

const PARSER_PROMPT = `Analise a descrição do sistema fornecida pelo usuário e retorne JSON estruturado:

Campos:

system_type
goal
target_users[]
modules[]
roles[]
needs_auth (boolean)
needs_payment (boolean)
multi_tenant (boolean)
suggested_stack
production_level
admin_panel (boolean)
preview_required (boolean)

Regras:
- Inferir quando não especificado
- Assumir boas práticas
- Nunca retornar texto fora do JSON
- Não explicar
- Não comentar
- Apenas JSON válido`;

const FALLBACK = {
  system_type: "SaaS web",
  goal: "Resolver um fluxo principal de negócio",
  target_users: ["usuarios", "admin"],
  modules: ["autenticacao", "dashboard", "modulo principal"],
  roles: ["admin", "user"],
  needs_auth: true,
  needs_payment: false,
  multi_tenant: false,
  suggested_stack: "Next.js + TypeScript + Tailwind + Supabase",
  production_level: "producao",
  admin_panel: true,
  preview_required: true,
};

function normalizeArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeParsed(input: Record<string, unknown>) {
  return {
    system_type: normalizeString(input.system_type, FALLBACK.system_type),
    goal: normalizeString(input.goal, FALLBACK.goal),
    target_users: normalizeArray(input.target_users, FALLBACK.target_users),
    modules: normalizeArray(input.modules, FALLBACK.modules),
    roles: normalizeArray(input.roles, FALLBACK.roles),
    needs_auth: normalizeBoolean(input.needs_auth, FALLBACK.needs_auth),
    needs_payment: normalizeBoolean(input.needs_payment, FALLBACK.needs_payment),
    multi_tenant: normalizeBoolean(input.multi_tenant, FALLBACK.multi_tenant),
    suggested_stack: normalizeString(input.suggested_stack, FALLBACK.suggested_stack),
    production_level: normalizeString(input.production_level, FALLBACK.production_level),
    admin_panel: normalizeBoolean(input.admin_panel, FALLBACK.admin_panel),
    preview_required: normalizeBoolean(input.preview_required, FALLBACK.preview_required),
  };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  console.log("CORS ORIGIN:", req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { description } = await req.json() as { description?: string };

    if (!description || !description.trim()) {
      return new Response(JSON.stringify({ error: "description is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `${PARSER_PROMPT}\n\nDescrição do usuário:\n${description.trim()}`;

    const { text, model } = await geminiGenerate({
      prompt,
      temperature: 0.1,
      maxOutputTokens: 1200,
    });

    const parsed = parsePossiblyWrappedJson(text);
    if (!parsed) {
      return new Response(JSON.stringify({ parsed: FALLBACK, model, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizeParsed(parsed);

    return new Response(JSON.stringify({ parsed: normalized, model, fallback: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
   console.error("function error:", error);
    console.error("parse-system-intent error:", error);

    return new Response(JSON.stringify({ parsed: FALLBACK, fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});