import { serve } from "https://deno.land/std/http/server.ts";

type GenerateRequestBody = {
  category?: string;
  template?: string;
  fields?: Record<string, string>;
};

type JsonError = {
  status: "error";
  code: string;
  message: string;
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

function buildCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(req: Request, status: number, code: string, message: string): Response {
  const body: JsonError = { status: "error", code, message };
  return jsonResponse(req, status, body);
}

function sanitizeFields(fields: unknown): Record<string, string> {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    if (typeof value === "string") output[key] = value;
  }
  return output;
}

function buildPrompt(input: GenerateRequestBody): { systemPrompt: string; prompt: string } {
  const category = (input.category ?? "").trim();
  const template = (input.template ?? "").trim();
  const fields = sanitizeFields(input.fields);

  const systemPrompt = category === "system_builder"
    ? "Você é um arquiteto de software sênior. Responda com especificação técnica objetiva, clara e organizada."
    : "Você é um redator técnico profissional. Responda de forma clara e útil em português brasileiro.";

  if (!template) {
    const pairs = Object.entries(fields).map(([k, v]) => `- ${k}: ${v}`).join("\n");
    return {
      systemPrompt,
      prompt: pairs
        ? `Gere conteúdo para categoria "${category || "geral"}" usando os dados:\n${pairs}`
        : `Gere conteúdo para categoria "${category || "geral"}".`,
    };
  }

  let prompt = template;
  for (const [key, value] of Object.entries(fields)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  return { systemPrompt, prompt };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return errorResponse(req, 405, "method_not_allowed", "Use POST.");
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return errorResponse(req, 401, "unauthorized", "Missing Bearer token.");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return errorResponse(req, 401, "unauthorized", "Invalid Bearer token.");
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return errorResponse(req, 400, "config_error", "Missing ENV: OPENAI_API_KEY");
  }

  let body: GenerateRequestBody;
  try {
    body = (await req.json()) as GenerateRequestBody;
  } catch {
    return errorResponse(req, 400, "invalid_json", "Request body must be valid JSON.");
  }

  const { systemPrompt, prompt } = buildPrompt(body);
  const trimmedPrompt = prompt.trim().slice(0, 12000);
  if (!trimmedPrompt) {
    return errorResponse(req, 400, "invalid_input", "Prompt is empty.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: trimmedPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const providerMessage = (() => {
        if (!data || typeof data !== "object") return raw.slice(0, 500) || "OpenAI request failed";
        const err = data.error;
        if (!err || typeof err !== "object") return raw.slice(0, 500) || "OpenAI request failed";
        const msg = (err as Record<string, unknown>).message;
        return typeof msg === "string" && msg ? msg : (raw.slice(0, 500) || "OpenAI request failed");
      })();

      return errorResponse(req, 502, "ai_provider_error", providerMessage);
    }

    const choices = data?.choices;
    const first = Array.isArray(choices) ? choices[0] : null;
    const message = first && typeof first === "object"
      ? (first as Record<string, unknown>).message
      : null;
    const text = message && typeof message === "object"
      ? (message as Record<string, unknown>).content
      : null;

    if (typeof text !== "string" || !text.trim()) {
      return errorResponse(req, 502, "invalid_ai_output", "OpenAI returned empty content.");
    }

    return jsonResponse(req, 200, {
      status: "success",
      model: OPENAI_MODEL,
      provider: "openai",
      text: text.trim(),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse(req, 408, "request_timeout", "OpenAI request timeout.");
    }

    const message = error instanceof Error ? error.message : "Internal error";
    return errorResponse(req, 500, "internal_error", message);
  } finally {
    clearTimeout(timeout);
  }
});
