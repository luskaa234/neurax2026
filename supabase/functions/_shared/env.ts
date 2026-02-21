function cleanEnvValue(value: string | undefined): string {
  return (value || "").trim();
}

export function requireEnv(name: string): string {
  const value = cleanEnvValue(Deno.env.get(name));
  if (!value) {
    throw new Error(`Missing ENV: ${name}`);
  }
  return value;
}

export function assertRequiredEnv(list: string[]): { ok: true } | { ok: false; missing: string[] } {
  const missing = list
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .filter((name) => !cleanEnvValue(Deno.env.get(name)));

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true };
}
