import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../../lib/config.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  console.log("CORS ORIGIN:", req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
    const supabaseUser = createClient(getSupabaseUrl(), getSupabaseAnonKey(), { global: { headers: { Authorization: authHeader } } });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = (await req.json()) as { transcript?: string; language?: string; projectId?: string };
    const transcript = String(body.transcript || "").trim();
    if (!transcript) {
      return new Response(JSON.stringify({ error: "transcript is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: userData.user.id,
      project_id: body.projectId ?? null,
      provider: "openai",
      model: "whisper",
      task: "audio_ingestion",
      success: true,
    });

    return new Response(JSON.stringify({ transcript, language: body.language || "pt-BR" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});