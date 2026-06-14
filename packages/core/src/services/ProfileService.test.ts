import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProfileRepository, ProfileDto } from '@sailorclawbot/contracts';
import type { EventBus, DomainEvent } from '../common/events/EventBus.js';
import type { Logger } from '../common/logging/Logger.js';
import { ProfileService } from './ProfileService.js';
import { ValidationError } from '../common/errors/ValidationError.js';
import { NotFoundError } from '../common/errors/NotFoundError.js';

const NOW = new Date('2024-01-01T00:00:00Z');

function makeProfile(overrides: Partial<ProfileDto> = {}): ProfileDto {
  return {
    id: 'profile_1',
    guildId: 'guild_1',
    userId: 'user_1',
    displayName: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createHarness(existing: ProfileDto | null = null) {
  const events: DomainEvent[] = [];
  const logs: { message: string; context?: Record<string, unknown> }[] = [];
  let stored: ProfileDto | null = existing;

  const profiles: ProfileRepository = {
    findByGuildAndUser: async () => stored,
    create: async (input) => {
      stored = makeProfile({ guildId: input.guildId, userId: input.userId, displayName: input.displayName });
      return stored;
    },
    update: async (guildId, userId, changes) => {
      if (!stored) throw new NotFoundError('Profile', `${guildId}:${userId}`);
      stored = { ...stored, ...changes, updatedAt: NOW };
      return stored;
    },
  };

  const bus: EventBus = {
    publish: async (event) => { events.push(event); },
  };

  const logger: Logger = {
    info: (message, context) => { logs.push({ message, context }); },
    warn: (message, context) => { logs.push({ message, context }); },
    error: (message, context) => { logs.push({ message, context }); },
  };

  return { profiles, bus, logger, events, logs, getStored: () => stored };
}

test('ensureProfile — returns existing profile without creating', async () => {
  const existing = makeProfile({ displayName: 'Wayne' });
  const { profiles, bus, logger, events } = createHarness(existing);
  const service = new ProfileService(profiles, bus, logger);

  const result = await service.ensureProfile('guild_1', 'user_1');

  assert.deepEqual(result, existing);
  assert.equal(events.length, 0);
});

test('ensureProfile — creates profile and publishes profile.created', async () => {
  const { profiles, bus, logger, events } = createHarness(null);
  const service = new ProfileService(profiles, bus, logger);

  const result = await service.ensureProfile('guild_1', 'user_1');

  assert.equal(result.guildId, 'guild_1');
  assert.equal(result.userId, 'user_1');
  assert.equal(result.displayName, null);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'profile.created');
});

test('getProfile — returns profile when found', async () => {
  const existing = makeProfile({ displayName: 'Test' });
  const { profiles, bus, logger } = createHarness(existing);
  const service = new ProfileService(profiles, bus, logger);

  const result = await service.getProfile('guild_1', 'user_1');

  assert.deepEqual(result, existing);
});

test('getProfile — throws NotFoundError when profile missing', async () => {
  const { profiles, bus, logger } = createHarness(null);
  const service = new ProfileService(profiles, bus, logger);

  await assert.rejects(
    () => service.getProfile('guild_1', 'user_1'),
    (err) => {
      assert.ok(err instanceof NotFoundError);
      return true;
    }
  );
});

test('updateDisplayName — updates profile and publishes profile.updated', async () => {
  const existing = makeProfile({ displayName: null });
  const { profiles, bus, logger, events, getStored } = createHarness(existing);
  const service = new ProfileService(profiles, bus, logger);

  const result = await service.updateDisplayName('guild_1', 'user_1', 'Wayne');

  assert.equal(result.displayName, 'Wayne');
  assert.equal(getStored()?.displayName, 'Wayne');
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'profile.updated');
});

test('updateDisplayName — allows setting displayName to null', async () => {
  const existing = makeProfile({ displayName: 'Wayne' });
  const { profiles, bus, logger, events } = createHarness(existing);
  const service = new ProfileService(profiles, bus, logger);

  const result = await service.updateDisplayName('guild_1', 'user_1', null);

  assert.equal(result.displayName, null);
  assert.equal(events.length, 1);
});

test('updateDisplayName — rejects blank string', async () => {
  const existing = makeProfile();
  const { profiles, bus, logger } = createHarness(existing);
  const service = new ProfileService(profiles, bus, logger);

  await assert.rejects(
    () => service.updateDisplayName('guild_1', 'user_1', '   '),
    (err) => {
      assert.ok(err instanceof ValidationError);
      return true;
    }
  );
});
