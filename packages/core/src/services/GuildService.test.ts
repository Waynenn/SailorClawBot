import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GuildRepository, GuildMemberRepository, GuildDto, GuildMemberDto } from '@sailorclawbot/contracts';
import type { EventBus, DomainEvent } from '../common/events/EventBus.js';
import type { Logger } from '../common/logging/Logger.js';
import { GuildService } from './GuildService.js';

const NOW = new Date('2024-01-01T00:00:00Z');

function makeGuild(overrides: Partial<GuildDto> = {}): GuildDto {
  return {
    id: 'guild_1',
    name: 'Test Guild',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeMember(overrides: Partial<GuildMemberDto> = {}): GuildMemberDto {
  return {
    guildId: 'guild_1',
    userId: 'user_1',
    joinedAt: NOW,
    ...overrides,
  };
}

function createHarness(existingGuild: GuildDto | null = null) {
  const events: DomainEvent[] = [];
  const logs: { message: string }[] = [];
  let storedGuild: GuildDto | null = existingGuild;
  let storedMember: GuildMemberDto | null = null;

  const guilds: GuildRepository = {
    findById: async () => storedGuild,
    upsert: async (input) => {
      storedGuild = makeGuild({ id: input.id, name: input.name });
      return storedGuild;
    },
  };

  const members: GuildMemberRepository = {
    findByGuildAndUser: async () => storedMember,
    upsert: async (input) => {
      storedMember = { guildId: input.guildId, userId: input.userId, joinedAt: NOW };
      return storedMember;
    },
  };

  const bus: EventBus = {
    publish: async (event) => { events.push(event); },
  };

  const logger: Logger = {
    info: (message) => { logs.push({ message }); },
    warn: (message) => { logs.push({ message }); },
    error: (message) => { logs.push({ message }); },
  };

  return { guilds, members, bus, logger, events, logs, getGuild: () => storedGuild, getMember: () => storedMember };
}

test('registerGuild — upserts guild and publishes guild.registered', async () => {
  const { guilds, members, bus, logger, events, getGuild } = createHarness(null);
  const service = new GuildService(guilds, members, bus, logger);

  const result = await service.registerGuild('guild_1', 'Test Guild');

  assert.equal(result.id, 'guild_1');
  assert.equal(result.name, 'Test Guild');
  assert.equal(getGuild()?.name, 'Test Guild');
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'guild.registered');
});

test('registerGuild — updates name and publishes event', async () => {
  const { guilds, members, bus, logger, events } = createHarness(makeGuild({ name: 'Old Name' }));
  const service = new GuildService(guilds, members, bus, logger);

  const result = await service.registerGuild('guild_1', 'New Name');

  assert.equal(result.name, 'New Name');
  assert.equal(events[0].name, 'guild.registered');
});

test('ensureMember — upserts member', async () => {
  const { guilds, members, bus, logger, getMember } = createHarness(makeGuild());
  const service = new GuildService(guilds, members, bus, logger);

  const result = await service.ensureMember('guild_1', 'user_1');

  assert.equal(result.guildId, 'guild_1');
  assert.equal(result.userId, 'user_1');
  assert.equal(getMember()?.userId, 'user_1');
});

test('findGuild — returns guild when found', async () => {
  const guild = makeGuild();
  const { guilds, members, bus, logger } = createHarness(guild);
  const service = new GuildService(guilds, members, bus, logger);

  const result = await service.findGuild('guild_1');

  assert.deepEqual(result, guild);
});

test('findGuild — returns null when not found', async () => {
  const { guilds, members, bus, logger } = createHarness(null);
  const service = new GuildService(guilds, members, bus, logger);

  const result = await service.findGuild('nonexistent');

  assert.equal(result, null);
});
