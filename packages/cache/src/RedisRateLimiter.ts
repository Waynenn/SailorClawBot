import type { Redis } from 'ioredis';
import type { RateLimiter, RateLimitResult } from '@sailorclawbot/contracts';

const KEY_PREFIX = 'ratelimit:';

// Fixed-window counter. INCR returns the new count; on the first hit we set the
// window TTL. Atomic so concurrent shards share one counter.
const LUA_FIXED_WINDOW = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

interface MemoryWindow {
  count: number;
  resetAt: number;
}

/**
 * Rate limiter on Redis (cross-shard) with an in-memory per-process fallback for
 * when Redis is unavailable. The fallback is per-shard only — acceptable for
 * per-guild limits, lossy for global ones — but it keeps the bot functional.
 */
export class RedisRateLimiter implements RateLimiter {
  private readonly memory = new Map<string, MemoryWindow>();

  public constructor(private readonly client: Redis | null) {}

  public async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    if (this.client) {
      try {
        const res = (await this.client.eval(
          LUA_FIXED_WINDOW,
          1,
          KEY_PREFIX + key,
          String(windowSeconds)
        )) as [number, number];
        const count = Number(res[0]);
        const ttlMs = Number(res[1]);
        if (count <= limit) return { allowed: true, retryAfterMs: 0 };
        return { allowed: false, retryAfterMs: ttlMs > 0 ? ttlMs : windowSeconds * 1000 };
      } catch {
        return this.consumeInMemory(key, limit, windowSeconds);
      }
    }
    return this.consumeInMemory(key, limit, windowSeconds);
  }

  private consumeInMemory(key: string, limit: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    const existing = this.memory.get(key);
    if (!existing || existing.resetAt <= now) {
      this.memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return { allowed: true, retryAfterMs: 0 };
    }
    existing.count += 1;
    if (existing.count <= limit) return { allowed: true, retryAfterMs: 0 };
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }
}