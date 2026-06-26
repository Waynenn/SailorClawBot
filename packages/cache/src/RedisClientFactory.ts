import { Redis } from 'ioredis';

/**
 * Create a fail-fast Redis client, or null when REDIS_URL is not configured.
 *
 * Fail-fast (enableOfflineQueue=false, maxRetriesPerRequest=1) means commands
 * reject quickly when Redis is unreachable instead of buffering forever, so the
 * cache/rate-limit layers can degrade gracefully. The 'error' handler is
 * attached so an unreachable Redis never crashes the process.
 */
export function createRedis(url: string | undefined, onError?: (err: Error) => void): Redis | null {
  if (!url || url.trim().length === 0) return null;
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  client.on('error', (err: Error) => {
    if (onError) onError(err);
  });
  return client;
}

export type { Redis };