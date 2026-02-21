export interface GenerateResult {
  status: "success";
  provider: "openai";
  model: "gpt-4o-mini";
  text: string;
}

export class AIProviderHttpError extends Error {
  provider: "openai";
  status: number;
  bodySnippet: string;

  constructor(provider: "openai", status: number, bodySnippet: string) {
    super(`${provider} API error: ${status}`);
    this.name = "AIProviderHttpError";
    this.provider = provider;
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

interface OpenAIGenerateInput {
  systemPrompt: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

function snippet(value: string): string {
  return value.slice(0, 800);
}

async function parseResponseSafe(response: Response): Promise<{ json: Record<string, unknown> | null; raw: string }> {
  const raw = await response.text();
  if (!raw) return { json: null, raw: "" };
  try {
    return { json: JSON.parse(raw) as Record<string, unknown>, raw };
  } catch {
    return { json: null, raw };
  }
}

function providerErrorMessage(payload: Record<string, unknown> | null, raw: string): string {
  if (!payload) return snippet(raw);
  const error = payload.error;
  if (!error || typeof error !== "object") return snippet(raw);
  const message = (error as Record<string, unknown>).message;
  if (typeof message === "string" && message.trim().length > 0) {
    return snippet(message);
  }
  return snippet(raw);
}

export async function openaiGenerate({
  systemPrompt,
  prompt,
  temperature = 0.2,
  maxOutputTokens = 1200,
}: OpenAIGenerateInput): Promise<GenerateResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const model = "gpt-4o-mini";
  const safeTokens = Math.min(1500, Math.max(1, maxOutputTokens));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: safeTokens,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIProviderHttpError("openai", 408, "Request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const { json, raw } = await parseResponseSafe(response);
  if (!response.ok) {
    const bodySnippet = providerErrorMessage(json, raw);
    console.error({
      scope: "openai",
      provider: "openai",
      status: response.status,
      message: bodySnippet,
      model,
    });
    throw new AIProviderHttpError("openai", response.status, bodySnippet);
  }

  const choices = json?.choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const message = first && typeof first === "object" ? (first as Record<string, unknown>).message : undefined;
  const text = message && typeof message === "object" ? (message as Record<string, unknown>).content : undefined;

  if (typeof text !== "string" || text.trim().length === 0) {
    throw new AIProviderHttpError("openai", 500, "OpenAI returned empty text");
  }

  return {
    status: "success",
    provider: "openai",
    model,
    text: text.trim(),
  };
}
