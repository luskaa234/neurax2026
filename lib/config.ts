function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error("Missing server AI provider key");
  }
  return value;
}

export function getSupabaseUrl(): string {
  const value = Deno.env.get("SUPABASE_URL");
  if (!value) {
    throw new Error("SUPABASE_URL is not configured");
  }
  return value;
}

export function getSupabaseAnonKey(): string {
  const value = Deno.env.get("SUPABASE_ANON_KEY");
  if (!value) {
    throw new Error("SUPABASE_ANON_KEY is not configured");
  }
  return value;
}

export function getSupabaseServiceRoleKey(): string {
  const value = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!value) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return value;
}

export function getGeminiApiKey(): string {
  return requiredEnv("GEMINI_API_KEY");
}

export function getOpenAIApiKey(): string {
  return requiredEnv("OPENAI_API_KEY");
}

export function getGeminiModel(): string {
  return Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash";
}

export function getOpenAIModel(): string {
  return Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
}
