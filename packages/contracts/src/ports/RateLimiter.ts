/**
 * Port: rate limiter.
 *
 * Per-guild limits may run in-memory per shard (one guild = one shard), but
 * GLOBAL cross-guild per-user limits require a shared store (Redis) so the
 * counter is consistent across shards. The implementation lives in
 * `packages/cache`; the bot depends only on this interface.
 */
export interface RateLimitResult {
	allowed: boolean;
	/** Milliseconds until the next attempt is allowed (0 when allowed). */
	retryAfterMs: number;
}

export interface RateLimiter {
	/**
	 * Atomically count one hit against `key` within a fixed `windowSeconds`
	 * window of size `limit`. Returns whether the hit is allowed.
	 */
	consume(
		key: string,
		limit: number,
		windowSeconds: number,
	): Promise<RateLimitResult>;
}
