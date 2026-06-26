import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickWinners } from './pickWinners.js';

test('returns empty array for an empty participant pool', () => {
  assert.deepEqual(pickWinners([], 3), []);
});

test('returns empty array when count is below one', () => {
  assert.deepEqual(pickWinners(['a', 'b'], 0), []);
});

test('caps winners at the pool size when count exceeds entries', () => {
  // Arrange
  const pool = ['a', 'b', 'c'];

  // Act
  const winners = pickWinners(pool, 10);

  // Assert
  assert.equal(winners.length, 3);
  assert.deepEqual([...winners].sort(), ['a', 'b', 'c']);
});

test('draws exactly count winners with no duplicates', () => {
  const pool = Array.from({ length: 20 }, (_, i) => `u${i}`);

  const winners = pickWinners(pool, 5);

  assert.equal(winners.length, 5);
  assert.equal(new Set(winners).size, 5);
  for (const w of winners) assert.ok(pool.includes(w));
});

test('does not mutate the input array', () => {
  const pool = ['a', 'b', 'c', 'd'];
  const snapshot = [...pool];

  pickWinners(pool, 2);

  assert.deepEqual(pool, snapshot);
});
