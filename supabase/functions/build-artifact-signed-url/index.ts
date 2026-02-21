import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../../lib/config.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  console.log("CORS ORIGIN:", req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
  );

  const supabaseUser = createClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;

  try {
    const body = (await req.json()) as { build_id?: string };
    const buildId = body.build_id ?? "";

    if (!buildId) {
      return new Response(JSON.stringify({ error: "build_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: build, error: buildError } = await supabaseAdmin
      .from("builds")
      .select("id, user_id, build_json")
      .eq("id", buildId)
      .single();

    if (buildError || !build) {
      return new Response(JSON.stringify({ error: "Build não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (build.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: buildFiles, error: filesError } = await supabaseAdmin
      .from("build_files")
      .select("path, content_text")
      .eq("build_id", buildId)
      .order("path");

    if (filesError || !buildFiles || buildFiles.length === 0) {
      return new Response(JSON.stringify({ error: "Build sem arquivos para exportação" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectName = typeof (build.build_json as { project_name?: string })?.project_name === "string"
      ? (build.build_json as { project_name?: string }).project_name as string
      : "project";

    const zipFileName = `${userId}/${buildId}.zip`;

    const blobWriter = new zip.BlobWriter("application/zip");
    const zipWriter = new zip.ZipWriter(blobWriter);

    for (const file of buildFiles) {
      if (!file.path?.trim()) continue;
      await zipWriter.add(
        `${projectName}/${file.path}`,
        new zip.TextReader(file.content_text || ""),
      );
    }

    await zipWriter.close();
    const zipBlob = await blobWriter.getData();
    const zipArrayBuffer = await zipBlob.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("build-artifacts")
      .upload(zipFileName, new Uint8Array(zipArrayBuffer), {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Falha ao atualizar artefato" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from("build-artifacts")
      .createSignedUrl(zipFileName, 60 * 60 * 24 * 7);

    if (signedError || !signedData?.signedUrl) {
      console.error("Signed URL generation failed", signedError);
      return new Response(JSON.stringify({ error: "Não foi possível regenerar o link do artefato" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin
      .from("builds")
      .update({ artifact_url: signedData.signedUrl })
      .eq("id", buildId);

    return new Response(JSON.stringify({ artifact_url: signedData.signedUrl }), {
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