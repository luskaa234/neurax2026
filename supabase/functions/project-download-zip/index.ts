import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../../lib/config.ts";

const MIN_FILE_COUNT = 1;
const MIN_ZIP_SIZE_BYTES = 128;

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
    const body = (await req.json()) as { project_id?: string };
    const projectId = body.project_id;

    if (!projectId) {
      return new Response(JSON.stringify({ error: "project_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, user_id, name")
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

    const { data: files, error: filesError } = await supabaseAdmin
      .from("project_files")
      .select("path, content")
      .eq("project_id", projectId)
      .order("path");

    if (filesError) {
      return new Response(JSON.stringify({ error: filesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!files || files.length < MIN_FILE_COUNT) {
      return new Response(JSON.stringify({ error: "Projeto sem arquivos para zip" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blobWriter = new zip.BlobWriter("application/zip");
    const zipWriter = new zip.ZipWriter(blobWriter);

    for (const file of files) {
      if (!file.path.trim()) continue;
      await zipWriter.add(`${project.name}/${file.path}`, new zip.TextReader(file.content || ""));
    }

    await zipWriter.close();
    const zipBlob = await blobWriter.getData();

    if (zipBlob.size <= MIN_ZIP_SIZE_BYTES) {
      return new Response(JSON.stringify({ error: "ZIP inválido: tamanho mínimo não atingido" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zipBytes = new Uint8Array(await zipBlob.arrayBuffer());
    const key = `${userId}/${projectId}.zip`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("project-artifacts")
      .upload(key, zipBytes, {
        upsert: true,
        contentType: "application/zip",
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("project-artifacts")
      .createSignedUrl(key, 60 * 60);

    if (signedError || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: signedError?.message || "Falha ao gerar URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: signed.signedUrl }), {
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