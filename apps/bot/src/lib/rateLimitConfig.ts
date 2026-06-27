import type { RateLimiter } from '@sailorclawbot/contracts';

/**
 * Anti-abuse rate limits for command and button interactions (Block 0.4).
 *
 * Two levels:
 *  - Per-guild per-user buckets for normal command spam. One guild lives on one
 *    shard, so an in-memory fallback is acceptable when Redis is down.
 *  - A GLOBAL per-user counter for cross-guild abuse (same account spamming
 *    commands across many servers). This needs Redis to stay consistent across
 *    shards; the in-memory fallback is lossy here but keeps the bot alive.
 *
 * XP cooldown is intentionally NOT handled here — it stays in-memory per shard.
 * daily/work/crime/rob carry their own persisted cooldowns in the DB.
 */
export interface RateRule {
  limit: number;
  windowSeconds: number;
  /** Shared bucket name so related commands count against one counter. */
  bucket: string;
}

// Staff / config commands — never throttled.
const EXEMPT = new Set([
  'warn', 'mute', 'unmute', 'ban', 'unban', 'kick', 'cases',
  'purge', 'slowmode', 'lockdown', 'unlock', 'softban', 'note',
  'automod', 'welcome', 'log', 'reactionrole', 'starboard', 'giveaway', 'twitch',
]);

// Own persisted cooldown in the DB — don't double-limit.
const DB_COOLDOWN = new Set(['daily', 'work', 'crime', 'rob']);

// Gambling commands share one tight bucket to curb spam-betting / alternating.
const GAMBLING = new Set(['coinflip', 'slots', 'roulette', 'blackjack']);

const GAMBLING_RULE: RateRule = { limit: 1, windowSeconds: 3, bucket: 'gambling' };
const GENERAL_RULE: RateRule = { limit: 1, windowSeconds: 2, bucket: 'general' };

/** Per-guild per-user button rule (giveaway_join etc.). */
const BUTTON_RULE: RateRule = { limit: 3, windowSeconds: 10, bucket: 'button' };

/** Cross-guild anti-spam: one counter per user across all shards (Redis). */
const GLOBAL_ANTISPAM = { limit: 20, windowSeconds: 60 };

/** Per-guild rule for a command, or null when the command is exempt. */
export function commandRule(name: string): RateRule | null {
  if (EXEMPT.has(name) || DB_COOLDOWN.has(name)) return null;
  if (GAMBLING.has(name)) return GAMBLING_RULE;
  return GENERAL_RULE;
}

/**
 * Enforce limits for a slash command. Returns retryAfterMs when the user is
 * throttled (caller should refuse and report it), or 0 when allowed.
 */
export async function consumeCommand(
  limiter: RateLimiter,
  name: string,
  guildId: string,
  userId: string,
): Promise<number> {
  const rule = commandRule(name);
  if (!rule) return 0;

  // Global cross-shard anti-spam first — cheapest way to stop wide abuse.
  const global = await limiter.consume(
    `global:${userId}`,
    GLOBAL_ANTISPAM.limit,
    GLOBAL_ANTISPAM.windowSeconds,
  );
  if (!global.allowed) return global.retryAfterMs;

  const perGuild = await limiter.consume(
    `cmd:${guildId}:${userId}:${rule.bucket}`,
    rule.limit,
    rule.windowSeconds,
  );
  return perGuild.allowed ? 0 : perGuild.retryAfterMs;
}

/**
 * Enforce the per-guild button limit. Returns retryAfterMs when throttled, or 0
 * when allowed.
 */
export async function consumeButton(
  limiter: RateLimiter,
  guildId: string,
  userId: string,
): Promise<number> {
  const result = await limiter.consume(
    `btn:${guildId}:${userId}:${BUTTON_RULE.bucket}`,
    BUTTON_RULE.limit,
    BUTTON_RULE.windowSeconds,
  );
  return result.allowed ? 0 : result.retryAfterMs;
}

/** Human-friendly seconds for the retry message. */
export function retryAfterSeconds(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}
