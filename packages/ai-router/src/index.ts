export type AITask =
  | "intent_parse"
  | "module_suggestion"
  | "copy_refine"
  | "small_code_patch"
  | "ux_refine"
  | "schema_hint";

export type AIComplexity = "low" | "medium" | "high";
export type AIProvider = "gemini" | "openai";

export interface GenerateAIInput {
  task: AITask;
  complexity: AIComplexity;
  prompt: string;
  retries?: number;
}

export interface GenerateAIOutput {
  text: string;
  provider: AIProvider;
  model: string;
}

function parseSnippet(raw: string): string {
  return raw.slice(0, 800);
}

async function callOpenAI(prompt: string): Promise<GenerateAIOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`openai_${response.status}:${parseSnippet(body)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return {
    text: data.choices?.[0]?.message?.content?.trim() || "",
    provider: "openai",
    model,
  };
}

async function callGemini(prompt: string): Promise<GenerateAIOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`gemini_${response.status}:${parseSnippet(body)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  return {
    text: data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "",
    provider: "gemini",
    model,
  };
}

function orderForComplexity(complexity: AIComplexity): AIProvider[] {
  if (complexity === "low") return ["gemini", "openai"];
  if (complexity === "high") return ["openai", "gemini"];
  return process.env.AI_PROVIDER === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
}

export async function generateAI(input: GenerateAIInput): Promise<GenerateAIOutput> {
  const retries = Math.max(1, input.retries ?? 2);
  const providers = orderForComplexity(input.complexity);
  let lastError = "unknown";

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    for (const provider of providers) {
      try {
        if (provider === "openai") {
          return await callOpenAI(input.prompt);
        }
        return await callGemini(input.prompt);
      } catch (error) {
        lastError = error instanceof Error ? error.message : "ai_router_failed";
      }
    }
  }

  throw new Error(`ai_router_exhausted:${input.task}:${lastError}`);
}
