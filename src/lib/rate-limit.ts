/**
 * Rate limit: Upstash Redis si está configurado; si no, fallback en memoria (limitado en serverless).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const RATE_LIMIT_WARNED = { current: false };
const memoryMap = new Map<string, { count: number; resetAt: number }>();
const upstashCache = new Map<string, { limit: (id: string) => Promise<{ success: boolean }> }>();

function isRateLimitedMemory(key: string, limit: number, windowMs: number): boolean {
  if (!RATE_LIMIT_WARNED.current) {
    RATE_LIMIT_WARNED.current = true;
    console.warn(
      '[rate-limit] UPSTASH_REDIS_REST_URL no configurado; usando límite en memoria (no fiable en serverless).'
    );
  }
  const now = Date.now();
  let entry = memoryMap.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    memoryMap.set(key, entry);
  }
  entry.count++;
  return entry.count > limit;
}

function getUpstashRatelimit(
  limit: number,
  windowMs: number
): { limit: (id: string) => Promise<{ success: boolean }> } | null {
  const cacheKey = `${limit}_${windowMs}`;
  const cached = upstashCache.get(cacheKey);
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const redis = new Redis({ url, token });
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    const rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    });
    upstashCache.set(cacheKey, rl);
    return rl;
  } catch {
    return null;
  }
}

/**
 * Devuelve true si el identificador (ej. IP) supera el límite.
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const rl = getUpstashRatelimit(limit, windowMs);
  if (rl) {
    const { success } = await rl.limit(identifier);
    return !success;
  }
  return isRateLimitedMemory(identifier, limit, windowMs);
}
