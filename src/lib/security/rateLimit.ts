const memoryHits = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitOptions {
  key: string;
  max: number;
  windowMs: number;
}

export function checkRateLimit({ key, max, windowMs }: RateLimitOptions): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const current = memoryHits.get(key);

  if (!current || current.resetAt < now) {
    memoryHits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  if (current.count >= max) {
    return { allowed: false, remaining: 0 };
  }

  current.count += 1;
  memoryHits.set(key, current);
  return { allowed: true, remaining: Math.max(0, max - current.count) };
}
