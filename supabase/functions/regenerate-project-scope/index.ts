import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geminiGenerate } from "../_shared/gemini.ts";
import { parsePossiblyWrappedJson } from "../_shared/json.ts";
import { getAccountStatus, getBillingBlockedReason, isBillingBlocked } from "../_shared/account-status.ts";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../../lib/config.ts";

interface ScopeRequest {
  project_id?: string;
  scope_type?: "file" | "folder" | "module";
  scope_value?: string;
  instruction?: string;
}

interface OutFile {
  path: string;
  content: string;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  console.log("CORS ORIGIN:", req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
  const supabaseUser = createClient(getSupabaseUrl(), getSupabaseAnonKey(), { global: { headers: { Authorization: authHeader } } });

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const accountStatus = await getAccountStatus(supabaseAdmin, userId);
    if (isBillingBlocked(accountStatus)) {
      return new Response(JSON.stringify({ error: getBillingBlockedReason(accountStatus), code: "billing_blocked" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ScopeRequest;
    const projectId = body.project_id;
    const scopeType = body.scope_type;
    const scopeValue = body.scope_value?.trim() || "";

    if (!projectId || !scopeType || !scopeValue) {
      return new Response(JSON.stringify({ error: "project_id, scope_type e scope_value são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, user_id, name, stack")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (project.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabaseAdmin
      .from("project_files")
      .select("id, path, content")
      .eq("project_id", projectId)
      .order("path");

    if (scopeType === "file") {
      query = query.eq("path", scopeValue);
    } else {
      query = query.ilike("path", `${scopeValue.replace(/\/$/, "")}/%`);
    }

    const { data: files, error: filesError } = await query;
    if (filesError) {
      return new Response(JSON.stringify({ error: filesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!files?.length) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo encontrado para escopo" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const compact = files.map((f) => ({ path: f.path, content: f.content }));
    const prompt = `Você é um engenheiro de software sênior. Regere apenas o escopo solicitado e retorne JSON válido no formato:\n{"files":[{"path":"...","content":"..."}]}\n\nProjeto: ${project.name}\nStack: ${Array.isArray(project.stack) ? project.stack.join(", ") : ""}\nEscopo: ${scopeType} = ${scopeValue}\nInstrução: ${body.instruction || "Melhore o código mantendo compatibilidade"}\n\nArquivos atuais:\n${JSON.stringify(compact)}\n\nRegras:\n- Retorne SOMENTE arquivos do escopo\n- Preserve nomes de path\n- Não inclua texto fora do JSON`;

    const { text, model } = await geminiGenerate({
      prompt,
      temperature: 0.2,
      maxOutputTokens: 8192,
    });

    const parsed = parsePossiblyWrappedJson(text);
    if (!parsed || !Array.isArray(parsed.files)) {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const outputFiles: OutFile[] = [];
    for (const entry of parsed.files as Array<Record<string, unknown>>) {
      if (typeof entry.path !== "string" || typeof entry.content !== "string") continue;
      outputFiles.push({ path: entry.path, content: entry.content });
    }

    if (!outputFiles.length) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo válido retornado" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ files: outputFiles, model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
