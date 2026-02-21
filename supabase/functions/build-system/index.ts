import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";
import { AIProviderHttpError, openaiGenerate } from "../_shared/openai.ts";
import { parsePossiblyWrappedJson } from "../_shared/json.ts";
import { getAccountStatus, getBillingBlockedReason, isBillingBlocked } from "../_shared/account-status.ts";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../../lib/config.ts";
import { assertRequiredEnv } from "../_shared/env.ts";

const REQUIRED_FILES = ["package.json", "tsconfig.json", "src/app/layout.tsx", "src/app/page.tsx"];
const MIN_ZIP_SIZE_BYTES = 1024;
const MIN_FILE_COUNT = 5;

interface BuildFile {
  path: string;
  content: string;
}

interface BuildOutput {
  project_name: string;
  files: BuildFile[];
  [key: string]: unknown;
}

interface BuildRequestBody {
  build_id?: string;
  prompt?: string;
}

function isBuildOutput(value: Record<string, unknown>): value is BuildOutput {
  if (typeof value.project_name !== "string") return false;
  if (!Array.isArray(value.files)) return false;

  return value.files.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const file = entry as Record<string, unknown>;
    return typeof file.path === "string" && typeof file.content === "string";
  });
}

function ensureStrictJsonPrompt(prompt: string): string {
  return `${prompt}\n\nREGRAS DE RESPOSTA:\n- Responda APENAS JSON válido\n- Sem markdown\n- Sem explicações\n- Formato obrigatório: {"project_name":"string","files":[{"path":"string","content":"string"}]}`;
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

  const envCheck = assertRequiredEnv([
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
  ]);
  if (!envCheck.ok) {
    console.error({
      scope: "build-system",
      provider: "system",
      status: 400,
      message: `Missing envs: ${envCheck.missing.join(",")}`,
    });
    return jsonResponse(req, 400, {
      status: "error",
      code: "config_error",
      missing: envCheck.missing,
      message: "Configure Supabase Edge Function secrets.",
    });
  }

  let buildId = "";
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse(req, 401, { status: "error", code: "unauthorized", message: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return jsonResponse(req, 401, { status: "error", code: "unauthorized", message: "Invalid token" });
    }

    let body: BuildRequestBody;
    try {
      body = (await req.json()) as BuildRequestBody;
    } catch {
      return jsonResponse(req, 400, {
        status: "error",
        code: "invalid_json",
        message: "Request body must be valid JSON.",
      });
    }

    buildId = String(body.build_id || "").trim();
    const prompt = String(body.prompt || "").trim();
    if (!buildId || !prompt) {
      return jsonResponse(req, 400, {
        status: "error",
        code: "invalid_input",
        message: "build_id and prompt are required.",
      });
    }

    supabaseAdmin = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
    const supabaseUser = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return jsonResponse(req, 401, { status: "error", code: "unauthorized", message: "Unauthorized" });
    }

    const userId = userData.user.id;
    const accountStatus = await getAccountStatus(supabaseAdmin, userId);

    if (isBillingBlocked(accountStatus)) {
      await supabaseAdmin.from("builds").update({ status: "failed" }).eq("id", buildId);
      return jsonResponse(req, 402, {
        status: "error",
        code: "billing_blocked",
        message: getBillingBlockedReason(accountStatus),
      });
    }

    await supabaseAdmin.from("builds").update({ status: "generating" }).eq("id", buildId);

    let strictPrompt = ensureStrictJsonPrompt(prompt);
    if (strictPrompt.length > 12000) {
      strictPrompt = strictPrompt.slice(0, 12000);
    }
    const startedAt = Date.now();
    const generation = await openaiGenerate({
      systemPrompt: "Gere um projeto JSON válido, técnico e conciso.",
      prompt: strictPrompt,
      temperature: 0.2,
      maxOutputTokens: 1200,
    });

    const { error: usageLogError } = await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: userId,
      provider: generation.provider,
      model: generation.model,
      task: "build_system",
      total_tokens: 0,
      latency_ms: Date.now() - startedAt,
      success: true,
    });
    if (usageLogError) {
      console.error({
        scope: "build-system",
        provider: "supabase",
        status: 500,
        message: usageLogError.message,
      });
    }

    const parsed = parsePossiblyWrappedJson(generation.text);
    if (!parsed || !isBuildOutput(parsed)) {
      await supabaseAdmin.from("builds").update({ status: "failed" }).eq("id", buildId);
      return jsonResponse(req, 422, {
        status: "error",
        code: "invalid_ai_output",
        message: "AI returned invalid build JSON.",
      });
    }

    const buildOutput = parsed;
    if (buildOutput.files.length < MIN_FILE_COUNT) {
      await supabaseAdmin.from("builds").update({ status: "failed" }).eq("id", buildId);
      return jsonResponse(req, 422, {
        status: "error",
        code: "invalid_build",
        message: `Build must contain at least ${MIN_FILE_COUNT} files.`,
      });
    }

    const filePaths = buildOutput.files.map((file) => file.path);
    const missingFiles = REQUIRED_FILES.filter((requiredPath) =>
      !filePaths.some((path) => path.endsWith(requiredPath) || path === requiredPath)
    );
    if (missingFiles.length > 0) {
      console.error({
        scope: "build-system",
        provider: generation.provider,
        status: 422,
        message: `Missing required files: ${missingFiles.join(",")}`,
      });
    }

    const blobWriter = new zip.BlobWriter("application/zip");
    const zipWriter = new zip.ZipWriter(blobWriter);

    for (const file of buildOutput.files) {
      const safePath = String(file.path || "").trim();
      if (!safePath) continue;
      await zipWriter.add(`${buildOutput.project_name || "project"}/${safePath}`, new zip.TextReader(file.content || ""));
    }

    await zipWriter.close();
    const zipBlob = await blobWriter.getData();

    if (zipBlob.size <= MIN_ZIP_SIZE_BYTES) {
      await supabaseAdmin.from("builds").update({ status: "failed" }).eq("id", buildId);
      return jsonResponse(req, 422, {
        status: "error",
        code: "invalid_zip",
        message: "Generated ZIP is too small.",
      });
    }

    const zipArrayBuffer = await zipBlob.arrayBuffer();
    const zipFileName = `${userId}/${buildId}.zip`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("build-artifacts")
      .upload(zipFileName, new Uint8Array(zipArrayBuffer), {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`upload_failed:${uploadError.message}`);
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from("build-artifacts")
      .createSignedUrl(zipFileName, 60 * 60 * 24 * 7);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(`signed_url_failed:${signedError?.message || "missing signed URL"}`);
    }

    const artifactUrl = signedData.signedUrl;

    await supabaseAdmin
      .from("builds")
      .update({
        build_json: buildOutput,
        status: "completed",
        artifact_url: artifactUrl,
      })
      .eq("id", buildId);

    return jsonResponse(req, 200, {
      status: "success",
      provider: generation.provider,
      model: generation.model,
      project_name: buildOutput.project_name,
      file_count: buildOutput.files.length,
      artifact_url: artifactUrl,
      build_json: buildOutput,
    });
  } catch (error) {
    if (error instanceof AIProviderHttpError) {
      console.error({
        scope: "build-system",
        provider: error.provider,
        status: error.status,
        message: error.bodySnippet,
      });
      if (buildId && supabaseAdmin) {
        await supabaseAdmin.from("builds").update({ status: "failed" }).eq("id", buildId).catch(() => {});
      }
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
      scope: "build-system",
      provider: "system",
      status: 500,
      message,
    });

    if (buildId && supabaseAdmin) {
      await supabaseAdmin.from("builds").update({ status: "failed" }).eq("id", buildId).catch(() => {});
    }

    return jsonResponse(req, 500, {
      status: "error",
      code: "internal_error",
      message,
    });
  }
});
