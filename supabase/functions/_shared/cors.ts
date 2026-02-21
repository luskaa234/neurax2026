export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const configured = (Deno.env.get("CORS_ALLOWED_ORIGIN") || "http://localhost:8080").trim();

  const allowlist = new Set([
    configured,
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:5173",
  ]);

  const allowOrigin = allowlist.has(origin) ? origin : configured;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  };
}
