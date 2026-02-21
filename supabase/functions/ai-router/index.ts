import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AIProviderHttpError, geminiGenerate } from "../_shared/gemini.ts";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../../lib/config.ts";

interface RouterBody {
  task?: string;
  complexityLevel?: "low" | "medium" | "high";
  prompt?: string;
  projectId?: string;
  provider?: "gemini" | "openai";
}

function jsonResponse(req: Request, status: number, body: Record<string, unknown>): Response {
  const corsHeaders = buildCorsHeaders(req);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  console.log("CORS ORIGIN:", req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse(req, 401, { status: "error", code: "unauthorized", message: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return jsonResponse(req, 401, { status: "error", code: "unauthorized", message: "Invalid token" });
    }

    let body: RouterBody;
    try {
      body = (await req.json()) as RouterBody;
    } catch {
      return jsonResponse(req, 400, { status: "error", code: "invalid_json", message: "Request body must be valid JSON." });
    }

    if (!body.prompt || !body.task) {
      return jsonResponse(req, 400, {
        status: "error",
        code: "invalid_input",
        message: "task and prompt are required",
      });
    }

    const provider = body.provider === "gemini" || body.provider === "openai" ? body.provider : undefined;

    const supabaseAdmin = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
    const supabaseUser = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return jsonResponse(req, 401, { status: "error", code: "unauthorized", message: "Unauthorized" });
    }

    const startedAt = Date.now();
    const generation = await geminiGenerate({
      prompt: body.prompt,
      temperature: body.complexityLevel === "high" ? 0.4 : 0.2,
      maxOutputTokens: body.complexityLevel === "high" ? 8192 : 4096,
      provider,
    });

    const { error: usageError } = await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: userData.user.id,
      project_id: body.projectId ?? null,
      provider: generation.provider,
      model: generation.model,
      task: body.task,
      total_tokens: 0,
      latency_ms: Date.now() - startedAt,
      success: true,
    });

    if (usageError) {
      console.error({
        scope: "ai-router",
        provider: "supabase",
        status: 500,
        message: usageError.message,
      });
    }

    return jsonResponse(req, 200, {
      status: "success",
      provider: generation.provider,
      model: generation.model,
      text: generation.text,
    });
  } catch (error) {
    if (error instanceof AIProviderHttpError) {
      console.error({
        scope: "ai-router",
        provider: error.provider,
        status: error.status,
        message: error.bodySnippet,
      });
      return jsonResponse(req, 502, {
        status: "error",
        code: "ai_provider_error",
        provider: error.provider,
        providerStatus: error.status,
        message: error.bodySnippet,
      });
    }

    const message = error instanceof Error ? error.message : "internal_error";
    console.error({
      scope: "ai-router",
      provider: "system",
      status: 500,
      message,
    });

    return jsonResponse(req, 500, {
      status: "error",
      code: "internal_error",
      message,
    });
  }
});
