import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StarboardEntryRepository, StarboardEntryDto } from '@sailorclawbot/contracts';
import type { Logger } from '../common/logging/Logger.js';
import { StarboardService } from './StarboardService.js';

function makeEntry(overrides: Partial<StarboardEntryDto> = {}): StarboardEntryDto {
  return {
    id: 'e1',
    guildId: 'guild_1',
    originalMsgId: 'msg_1',
    starboardMsgId: 'sb_1',
    authorId: 'author_1',
    channelId: 'ch_1',
    starCount: 5,
    ...overrides,
  };
}

function createHarness(existing: StarboardEntryDto | null = null) {
  let stored: StarboardEntryDto | null = existing;

  const repo: StarboardEntryRepository = {
    findByOriginalMessage: async () => stored,
    create: async (input) => {
      stored = { id: 'e_new', ...input };
      return stored;
    },
    updateStarCount: async (_guild, _msg, starCount) => {
      if (!stored) throw new Error('not found');
      stored = { ...stored, starCount };
      return stored;
    },
    delete: async () => {
      stored = null;
    },
  };

  const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
  const svc = new StarboardService(repo, logger);

  const buildEntry = async () => ({
    guildId: 'guild_1',
    originalMsgId: 'msg_1',
    starboardMsgId: 'sb_new',
    authorId: 'author_1',
    channelId: 'ch_1',
  });

  return { svc, buildEntry, getStored: () => stored };
}

test('action:create — creates entry when starCount reaches threshold and none exists', async () => {
  const { svc, buildEntry, getStored } = createHarness(null);

  const result = await svc.handleReaction('guild_1', 'msg_1', 5, 5, buildEntry);

  assert.equal(result.action, 'create');
  assert.ok(result.entry);
  assert.equal(result.entry.starCount, 5);
  assert.ok(getStored() !== null);
});

test('action:none — does nothing when starCount is below threshold and no entry exists', async () => {
  const { svc, buildEntry, getStored } = createHarness(null);

  const result = await svc.handleReaction('guild_1', 'msg_1', 3, 5, buildEntry);

  assert.equal(result.action, 'none');
  assert.equal(result.entry, null);
  assert.equal(getStored(), null);
});

test('action:update — updates star count when entry exists and count is above threshold', async () => {
  const entry = makeEntry({ starCount: 5 });
  const { svc, buildEntry, getStored } = createHarness(entry);

  const result = await svc.handleReaction('guild_1', 'msg_1', 7, 5, buildEntry);

  assert.equal(result.action, 'update');
  assert.ok(result.entry);
  assert.equal(result.entry.starCount, 7);
  assert.equal(getStored()?.starCount, 7);
});

test('action:delete — removes entry and returns it when count drops below threshold', async () => {
  const entry = makeEntry({ starCount: 5 });
  const { svc, buildEntry, getStored } = createHarness(entry);

  const result = await svc.handleReaction('guild_1', 'msg_1', 2, 5, buildEntry);

  assert.equal(result.action, 'delete');
  assert.ok(result.entry, 'deleted entry is returned to caller');
  assert.equal(result.entry.starboardMsgId, 'sb_1');
  assert.equal(getStored(), null);
});

test('buildEntry is not called when entry already exists (update path)', async () => {
  const entry = makeEntry({ starCount: 5 });
  const { svc } = createHarness(entry);

  let called = false;
  const buildEntry = async () => {
    called = true;
    return { guildId: 'guild_1', originalMsgId: 'msg_1', starboardMsgId: 'sb_x', authorId: 'a', channelId: 'c' };
  };

  await svc.handleReaction('guild_1', 'msg_1', 8, 5, buildEntry);

  assert.equal(called, false, 'buildEntry must not be called on update');
});

test('buildEntry is not called when count is below threshold (delete path)', async () => {
  const entry = makeEntry({ starCount: 5 });
  const { svc } = createHarness(entry);

  let called = false;
  const buildEntry = async () => {
    called = true;
    return { guildId: 'guild_1', originalMsgId: 'msg_1', starboardMsgId: 'sb_x', authorId: 'a', channelId: 'c' };
  };

  await svc.handleReaction('guild_1', 'msg_1', 2, 5, buildEntry);

  assert.equal(called, false, 'buildEntry must not be called on delete');
});

test('findEntry returns null when no entry exists', async () => {
  const { svc } = createHarness(null);

  const result = await svc.findEntry('guild_1', 'msg_1');

  assert.equal(result, null);
});

test('findEntry returns entry when one exists', async () => {
  const entry = makeEntry();
  const { svc } = createHarness(entry);

  const result = await svc.findEntry('guild_1', 'msg_1');

  assert.ok(result);
  assert.equal(result.id, 'e1');
});
