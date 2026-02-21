import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../../lib/config.ts";

function extractRoutes(paths: string[]): string[] {
  return paths
    .filter((path) => path.startsWith("src/app/") && path.endsWith("page.tsx"))
    .map((path) => {
      const route = path.replace("src/app", "").replace(/\/page\.tsx$/, "") || "/";
      return route.replace(/\/+/g, "/") || "/";
    })
    .sort((a, b) => a.localeCompare(b));
}

function sanitizeJsxToHtml(input: string): string {
  return input
    .replace(/className=/g, "class=")
    .replace(/\{[^{}]*\}/g, "")
    .replace(/<>/g, "")
    .replace(/<\/>/g, "")
    .replace(/<\/(>)?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractJsxReturn(content: string): string {
  const match = content.match(/return\s*\(([^]*?)\)\s*;?/m);
  if (!match?.[1]) return "";
  return sanitizeJsxToHtml(match[1]);
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
    const { project_id, route } = (await req.json()) as { project_id?: string; route?: string };
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, user_id")
      .eq("id", project_id)
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
      .eq("project_id", project_id)
      .order("path");

    if (filesError) {
      return new Response(JSON.stringify({ error: filesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allFiles = files || [];
    const paths = allFiles.map((file) => file.path);
    const routes = extractRoutes(paths);
    const selectedRoute = route || routes[0] || "/";

    const htmlFile = allFiles.find((file) => file.path.endsWith("index.html") || file.path.endsWith("preview.html"));
    if (htmlFile) {
      return new Response(JSON.stringify({ html: htmlFile.content, fallback: false, routes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetPath = selectedRoute === "/" ? "src/app/page.tsx" : `src/app${selectedRoute}/page.tsx`;
    const pageFile = allFiles.find((file) => file.path === targetPath);

    if (!pageFile) {
      return new Response(JSON.stringify({ fallback: true, routes, reason: "route_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const css = allFiles
      .filter((file) => file.path.endsWith(".css"))
      .map((file) => file.content)
      .join("\n\n");

    const jsxHtml = extractJsxReturn(pageFile.content);
    if (!jsxHtml) {
      return new Response(JSON.stringify({ fallback: true, routes, reason: "jsx_extract_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview Virtual</title>
  <style>${css}</style>
</head>
<body>
  <div id="preview-root">${jsxHtml}</div>
</body>
</html>`;

    return new Response(JSON.stringify({ html, fallback: false, routes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message, fallback: true }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});