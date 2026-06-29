import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RedisRateLimiter } from './RedisRateLimiter.js';

// All tests run the in-memory fallback path (null client) — this is the code
// that keeps the bot functional when Redis is down, so it must be correct.

test('allows hits up to the limit, then denies', async () => {
  const limiter = new RedisRateLimiter(null);

  const first = await limiter.consume('user:1', 2, 60);
  const second = await limiter.consume('user:1', 2, 60);
  const third = await limiter.consume('user:1', 2, 60);

  assert.equal(first.allowed, true);
  assert.equal(first.retryAfterMs, 0);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
});

test('denied result reports a positive retryAfter within the window', async () => {
  const limiter = new RedisRateLimiter(null);

  await limiter.consume('user:2', 1, 30);
  const denied = await limiter.consume('user:2', 1, 30);

  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfterMs > 0);
  assert.ok(denied.retryAfterMs <= 30_000);
});

test('separate keys have independent counters', async () => {
  const limiter = new RedisRateLimiter(null);

  await limiter.consume('a', 1, 60);
  const otherKey = await limiter.consume('b', 1, 60);

  assert.equal(otherKey.allowed, true);
});

test('window resets after it elapses', async () => {
  const limiter = new RedisRateLimiter(null);

  // 1-second window so the test stays fast.
  await limiter.consume('user:3', 1, 1);
  const blocked = await limiter.consume('user:3', 1, 1);
  assert.equal(blocked.allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 1100));

  const afterReset = await limiter.consume('user:3', 1, 1);
  assert.equal(afterReset.allowed, true);
});
