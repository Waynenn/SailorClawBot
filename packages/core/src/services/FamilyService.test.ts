import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FamilyRepository, FamilyDto } from '@sailorclawbot/contracts';
import type { Logger } from '../common/logging/Logger.js';
import { FamilyService } from './FamilyService.js';

const NOW = new Date('2024-01-01T00:00:00Z');

function makeFamily(overrides: Partial<FamilyDto> = {}): FamilyDto {
  return { id: 'fam_1', guildId: 'g', name: 'TestFamily', ownerUserId: 'u', createdAt: NOW, updatedAt: NOW, ...overrides };
}

function createHarness(stored: FamilyDto | null = null) {
  const log: string[] = [];
  let family = stored;

  const families: FamilyRepository = {
    findById: async () => family,
    listByGuild: async () => (family ? [family] : []),
    create: async (input) => {
      family = makeFamily({ guildId: input.guildId, name: input.name, ownerUserId: input.ownerUserId });
      return family;
    },
  };

  const logger: Logger = {
    info: (msg) => { log.push(msg); },
    warn: (msg) => { log.push(msg); },
    error: (msg) => { log.push(msg); },
  };

  return { families, logger, log, getFamily: () => family };
}

test('createFamily — creates and logs', async () => {
  const { families, logger, log, getFamily } = createHarness();
  const svc = new FamilyService(families, logger);

  const result = await svc.createFamily('g', 'TestFamily', 'u');
  assert.equal(result.name, 'TestFamily');
  assert.equal(result.ownerUserId, 'u');
  assert.equal(getFamily()?.name, 'TestFamily');
  assert.ok(log.some((m) => m.includes('Family created')));
});

test('listFamilies — returns families by guild', async () => {
  const { families, logger } = createHarness(makeFamily());
  const svc = new FamilyService(families, logger);

  const result = await svc.listFamilies('g');
  assert.equal(result.length, 1);
  assert.equal(result[0].guildId, 'g');
});

test('findFamily — returns family when found', async () => {
  const family = makeFamily();
  const { families, logger } = createHarness(family);
  const svc = new FamilyService(families, logger);

  const result = await svc.findFamily('fam_1');
  assert.deepEqual(result, family);
});

test('findFamily — returns null when not found', async () => {
  const { families, logger } = createHarness(null);
  const svc = new FamilyService(families, logger);

  const result = await svc.findFamily('nonexistent');
  assert.equal(result, null);
});
