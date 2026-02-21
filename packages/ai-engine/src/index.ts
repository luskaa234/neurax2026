export type AITask = "intent_parse" | "scaffold_extend" | "module_regen" | "file_regen" | "validation_fix";
export type ComplexityLevel = "low" | "medium" | "high";

export interface AIRequest {
  task: AITask;
  complexityLevel: ComplexityLevel;
  prompt: string;
  userId: string;
  projectId?: string;
  fallbackAllowed?: boolean;
}

export interface AIUsageLog {
  provider: "openai" | "gemini";
  model: string;
  task: AITask;
  userId: string;
  projectId?: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface AIResult {
  text: string;
  json?: Record<string, unknown>;
  provider: "openai" | "gemini";
  model: string;
}

function extractJson(text: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
}

async function callOpenAI(prompt: string): Promise<AIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.2 }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`openai_error_${response.status}:${err}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  return { text, json: extractJson(text), provider: "openai", model };
}

async function callGemini(prompt: string): Promise<AIResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`gemini_error_${response.status}:${err}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
  return { text, json: extractJson(text), provider: "gemini", model };
}

export async function generateAI(request: AIRequest): Promise<{ result: AIResult; usage: AIUsageLog }> {
  const started = Date.now();
  const preferred = process.env.AI_PROVIDER === "gemini" ? "gemini" : "openai";
  const order = request.fallbackAllowed ?? true ? [preferred, preferred === "openai" ? "gemini" : "openai"] : [preferred];

  let lastError = "unknown";

  for (const provider of order) {
    try {
      const result = provider === "openai" ? await callOpenAI(request.prompt) : await callGemini(request.prompt);
      const usage: AIUsageLog = {
        provider: result.provider,
        model: result.model,
        task: request.task,
        userId: request.userId,
        projectId: request.projectId,
        latencyMs: Date.now() - started,
        success: true,
      };
      return { result, usage };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "ai_call_failed";
    }
  }

  return {
    result: { text: "", provider: preferred === "openai" ? "openai" : "gemini", model: "n/a" },
    usage: {
      provider: preferred === "openai" ? "openai" : "gemini",
      model: "n/a",
      task: request.task,
      userId: request.userId,
      projectId: request.projectId,
      latencyMs: Date.now() - started,
      success: false,
      error: lastError,
    },
  };
}
