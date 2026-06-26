import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GiveawayRepository, GiveawayDto } from '@sailorclawbot/contracts';
import type { Logger } from '../common/logging/Logger.js';
import { GiveawayService } from './GiveawayService.js';
import { NotFoundError } from '../common/errors/NotFoundError.js';
import { ValidationError } from '../common/errors/ValidationError.js';

const FUTURE = new Date(Date.now() + 3_600_000);
const PAST = new Date(Date.now() - 1000);

function makeGiveaway(overrides: Partial<GiveawayDto> = {}): GiveawayDto {
  return {
    id: 'g1',
    guildId: 'guild_1',
    channelId: 'ch_1',
    messageId: null,
    prize: 'Test Prize',
    winnersCount: 1,
    endsAt: FUTURE,
    endedAt: null,
    hostId: 'host_1',
    participants: [],
    winners: [],
    ...overrides,
  };
}

function createHarness(stored: GiveawayDto | null = null) {
  let giveaway: GiveawayDto | null = stored;
  const activeList: GiveawayDto[] = stored ? [stored] : [];

  const repo: GiveawayRepository = {
    findById: async () => giveaway,
    findActive: async () => activeList,
    findExpired: async () => [],
    create: async (input) => {
      giveaway = makeGiveaway({ ...input, endedAt: null, participants: [], winners: [] });
      return giveaway;
    },
    setMessageId: async (_id, messageId) => {
      if (!giveaway) throw new Error('not found');
      giveaway = { ...giveaway, messageId };
      return giveaway;
    },
    addParticipant: async (_id, userId) => {
      if (!giveaway) throw new Error('not found');
      giveaway = { ...giveaway, participants: [...giveaway.participants, userId] };
      return giveaway;
    },
    end: async (_id, winners) => {
      if (!giveaway) throw new Error('not found');
      giveaway = { ...giveaway, endedAt: new Date(), winners };
      return giveaway;
    },
  };

  const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
  const svc = new GiveawayService(repo, logger);

  return { svc, getGiveaway: () => giveaway };
}

// ─── create ──────────────────────────────────────────────────────────────────

test('create — returns giveaway with correct fields', async () => {
  const { svc, getGiveaway } = createHarness();
  const result = await svc.create({
    guildId: 'guild_1',
    channelId: 'ch_1',
    prize: 'Discord Nitro',
    winnersCount: 2,
    durationMs: 60_000,
    hostId: 'host_1',
  });

  assert.equal(result.prize, 'Discord Nitro');
  assert.equal(result.winnersCount, 2);
  assert.ok(result.endsAt instanceof Date);
  assert.ok(result.endsAt.getTime() > Date.now());
  assert.ok(getGiveaway() !== null);
});

test('create — throws ValidationError when winnersCount < 1', async () => {
  const { svc } = createHarness();
  await assert.rejects(
    () => svc.create({ guildId: 'g', channelId: 'c', prize: 'X', winnersCount: 0, durationMs: 60_000, hostId: 'h' }),
    (e) => { assert.ok(e instanceof ValidationError); return true; }
  );
});

test('create — throws ValidationError when durationMs < 60000', async () => {
  const { svc } = createHarness();
  await assert.rejects(
    () => svc.create({ guildId: 'g', channelId: 'c', prize: 'X', winnersCount: 1, durationMs: 59_999, hostId: 'h' }),
    (e) => { assert.ok(e instanceof ValidationError); return true; }
  );
});

// ─── join ────────────────────────────────────────────────────────────────────

test('join — adds participant to active giveaway', async () => {
  const { svc, getGiveaway } = createHarness(makeGiveaway({ endsAt: FUTURE }));
  await svc.join('g1', 'user_1');

  assert.ok(getGiveaway()!.participants.includes('user_1'));
});

test('join — throws NotFoundError when giveaway missing', async () => {
  const { svc } = createHarness(null);
  await assert.rejects(
    () => svc.join('nonexistent', 'user_1'),
    (e) => { assert.ok(e instanceof NotFoundError); return true; }
  );
});

// BUG-R4a: join() must reject when giveaway is explicitly ended (endedAt set)
test('join — BUG-R4a: throws ValidationError when giveaway explicitly ended (endedAt set)', async () => {
  const { svc } = createHarness(makeGiveaway({ endedAt: new Date(), endsAt: FUTURE }));
  await assert.rejects(
    () => svc.join('g1', 'user_1'),
    (e) => { assert.ok(e instanceof ValidationError); return true; }
  );
});

// BUG-R4b: join() must also reject when endsAt has passed, even if endedAt is null
test('join — BUG-R4b: throws ValidationError when giveaway time has expired (endsAt in the past)', async () => {
  const { svc } = createHarness(makeGiveaway({ endedAt: null, endsAt: PAST }));
  await assert.rejects(
    () => svc.join('g1', 'user_1'),
    (e) => { assert.ok(e instanceof ValidationError); return true; }
  );
});

// ─── end ─────────────────────────────────────────────────────────────────────

test('end — picks winners from participants', async () => {
  const { svc } = createHarness(makeGiveaway({ participants: ['u1', 'u2', 'u3'], winnersCount: 2 }));
  const { winners } = await svc.end('g1');

  assert.equal(winners.length, 2);
  for (const w of winners) assert.ok(['u1', 'u2', 'u3'].includes(w));
});

test('end — returns empty winners when no participants', async () => {
  const { svc } = createHarness(makeGiveaway({ participants: [] }));
  const { winners } = await svc.end('g1');
  assert.equal(winners.length, 0);
});

test('end — caps at pool size when winnersCount exceeds participants', async () => {
  const { svc } = createHarness(makeGiveaway({ participants: ['u1', 'u2'], winnersCount: 5 }));
  const { winners } = await svc.end('g1');
  assert.equal(winners.length, 2);
});

test('end — throws NotFoundError when giveaway missing', async () => {
  const { svc } = createHarness(null);
  await assert.rejects(
    () => svc.end('nonexistent'),
    (e) => { assert.ok(e instanceof NotFoundError); return true; }
  );
});

test('end — throws ValidationError when already ended', async () => {
  const { svc } = createHarness(makeGiveaway({ endedAt: new Date() }));
  await assert.rejects(
    () => svc.end('g1'),
    (e) => { assert.ok(e instanceof ValidationError); return true; }
  );
});

test('end — winners are unique (Fisher-Yates produces no duplicates)', async () => {
  const participants = ['u1', 'u2', 'u3', 'u4', 'u5'];
  const { svc } = createHarness(makeGiveaway({ participants, winnersCount: 5 }));
  const { winners } = await svc.end('g1');

  assert.equal(winners.length, new Set(winners).size, 'winners must be unique');
});

test('end — sets endedAt on the giveaway', async () => {
  const { svc, getGiveaway } = createHarness(makeGiveaway({ participants: ['u1'] }));
  await svc.end('g1');

  assert.ok(getGiveaway()!.endedAt instanceof Date);
});

// ─── reroll ──────────────────────────────────────────────────────────────────

test('reroll — throws ValidationError when giveaway not yet ended', async () => {
  const { svc } = createHarness(makeGiveaway({ endedAt: null }));
  await assert.rejects(
    () => svc.reroll('g1'),
    (e) => { assert.ok(e instanceof ValidationError); return true; }
  );
});

test('reroll — throws NotFoundError when giveaway missing', async () => {
  const { svc } = createHarness(null);
  await assert.rejects(
    () => svc.reroll('nonexistent'),
    (e) => { assert.ok(e instanceof NotFoundError); return true; }
  );
});

test('reroll — picks new winners for an ended giveaway', async () => {
  const { svc } = createHarness(makeGiveaway({ participants: ['u1', 'u2', 'u3'], winnersCount: 1, endedAt: new Date() }));
  const { winners } = await svc.reroll('g1');

  assert.equal(winners.length, 1);
  assert.ok(['u1', 'u2', 'u3'].includes(winners[0]!));
});

// ─── listActive ───────────────────────────────────────────────────────────────

test('listActive — returns active giveaways for the guild', async () => {
  const { svc } = createHarness(makeGiveaway());
  const result = await svc.listActive('guild_1');
  assert.equal(result.length, 1);
});

test('listActive — returns empty array when no giveaways', async () => {
  const { svc } = createHarness(null);
  const result = await svc.listActive('guild_1');
  assert.equal(result.length, 0);
});
