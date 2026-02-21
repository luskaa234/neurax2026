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

    const body = (await req.json()) as { images?: Array<{ name: string; type: string; size: number }>; projectId?: string };
    const images = body.images || [];

    if (images.length === 0 || images.length > 5) {
      return new Response(JSON.stringify({ error: "Provide between 1 and 5 images" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    for (const image of images) {
      if (image.size > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: `Image too large: ${image.name}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: userData.user.id,
      project_id: body.projectId ?? null,
      provider: "gemini",
      model: "multimodal",
      task: "image_ingestion",
      success: true,
    });

    return new Response(JSON.stringify({
      summary: "Image set accepted",
      components: images.map((img, index) => ({ id: index + 1, name: img.name, type: "component-reference" })),
      layout: ["header", "content", "footer"],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});