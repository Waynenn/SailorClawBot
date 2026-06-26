import type { Redis } from 'ioredis';
import type { CachedMessage, MessageCache } from '@sailorclawbot/contracts';

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const KEY_PREFIX = 'msgcache:';

/**
 * Redis-backed message cache. When the client is null (Redis not configured) or
 * a call fails, every operation degrades to a no-op / null so logging falls back
 * to "content unavailable" rather than crashing.
 */
export class RedisMessageCache implements MessageCache {
  public constructor(private readonly client: Redis | null) {}

  public async set(message: CachedMessage, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(KEY_PREFIX + message.id, JSON.stringify(message), 'EX', ttlSeconds);
    } catch {
      /* degrade: caching is best-effort */
    }
  }

  public async get(messageId: string): Promise<CachedMessage | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(KEY_PREFIX + messageId);
      return raw ? (JSON.parse(raw) as CachedMessage) : null;
    } catch {
      return null;
    }
  }

  public async delete(messageId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(KEY_PREFIX + messageId);
    } catch {
      /* degrade */
    }
  }
}