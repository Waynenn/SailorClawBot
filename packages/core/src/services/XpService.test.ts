import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { XpService } from './XpService.js';
import type { ProfileRepository, ProfileDto } from '@sailorclawbot/contracts';
import type { EventBus } from '../common/events/EventBus.js';
import type { Logger } from '../common/logging/Logger.js';

function makeProfile(overrides: Partial<ProfileDto> = {}): ProfileDto {
  return {
    id: 'p1',
    guildId: 'g1',
    userId: 'u1',
    displayName: null,
    xp: 0,
    level: 0,
    totalXp: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProfileRepo(profile: ProfileDto | null = makeProfile()): ProfileRepository {
  return {
    findByGuildAndUser: async () => profile,
    create: async (input) => makeProfile({ guildId: input.guildId, userId: input.userId }),
    update: async (_g, _u, changes) => makeProfile(changes as Partial<ProfileDto>),
    updateXp: async (_g, _u, data) => makeProfile({ ...data }),
    findLeaderboard: async () => [profile ?? makeProfile()],
    countByGuild: async () => 1,
    findRank: async () => 1,
  };
}

const noopBus: EventBus = { publish: async () => {} };
const noopLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

describe('XpService.xpNeededForLevel', () => {
  const svc = new XpService(makeProfileRepo(), noopBus, noopLogger);

  it('level 0 needs 100 xp', () => {
    assert.equal(svc.xpNeededForLevel(0), 100);
  });

  it('level 1 needs 155 xp', () => {
    assert.equal(svc.xpNeededForLevel(1), 155);
  });

  it('level 5 needs 475 xp', () => {
    assert.equal(svc.xpNeededForLevel(5), 475);
  });
});

describe('XpService.grantXp', () => {
  it('adds xp without leveling up', async () => {
    const svc = new XpService(makeProfileRepo(), noopBus, noopLogger);
    const result = await svc.grantXp('g1', 'u1', 20);
    assert.equal(result.leveled, false);
    assert.equal(result.newLevel, 0);
  });

  it('levels up when xp threshold crossed', async () => {
    const profile = makeProfile({ xp: 95, level: 0, totalXp: 95 });
    let saved: { xp: number; level: number; totalXp: number } | null = null;
    const repo: ProfileRepository = {
      ...makeProfileRepo(profile),
      updateXp: async (_g, _u, data) => {
        saved = data;
        return makeProfile(data);
      },
    };
    const svc = new XpService(repo, noopBus, noopLogger);
    const result = await svc.grantXp('g1', 'u1', 10);
    assert.equal(result.leveled, true);
    assert.equal(result.newLevel, 1);
    assert.equal(saved!.level, 1);
    assert.equal(saved!.totalXp, 105);
  });

  it('throws on zero amount', async () => {
    const svc = new XpService(makeProfileRepo(), noopBus, noopLogger);
    await assert.rejects(() => svc.grantXp('g1', 'u1', 0), /positive/i);
  });

  it('throws when profile not found', async () => {
    const svc = new XpService(makeProfileRepo(null), noopBus, noopLogger);
    await assert.rejects(() => svc.grantXp('g1', 'u1', 10), /not found/i);
  });
});

describe('XpService.setXp', () => {
  it('recalculates level from totalXp', async () => {
    let saved: { xp: number; level: number; totalXp: number } | null = null;
    const repo: ProfileRepository = {
      ...makeProfileRepo(),
      updateXp: async (_g, _u, data) => {
        saved = data;
        return makeProfile(data);
      },
    };
    const svc = new XpService(repo, noopBus, noopLogger);
    await svc.setXp('g1', 'u1', 200);
    // level 0 needs 100, level 1 needs 155 — 200 total: pass level 0 (100), remaining 100 < 155 → level 1
    assert.equal(saved!.level, 1);
    assert.equal(saved!.totalXp, 200);
  });

  it('throws on negative xp', async () => {
    const svc = new XpService(makeProfileRepo(), noopBus, noopLogger);
    await assert.rejects(() => svc.setXp('g1', 'u1', -1), /negative/i);
  });
});

describe('XpService.getLeaderboard', () => {
  it('returns entries with rank', async () => {
    const svc = new XpService(makeProfileRepo(), noopBus, noopLogger);
    const result = await svc.getLeaderboard('g1', 1, 10);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0]!.rank, 1);
    assert.equal(result.total, 1);
  });

  it('page 2 offsets rank correctly', async () => {
    const p1 = makeProfile({ id: 'p1', userId: 'u1' });
    const p2 = makeProfile({ id: 'p2', userId: 'u2' });
    const repo: ProfileRepository = {
      ...makeProfileRepo(p1),
      findLeaderboard: async (_g, skip) => (skip === 0 ? [p1] : [p2]),
      countByGuild: async () => 2,
    };
    const svc = new XpService(repo, noopBus, noopLogger);
    const result = await svc.getLeaderboard('g1', 2, 1);
    assert.equal(result.entries[0]!.rank, 2);
  });
});

describe('XpService.getRank', () => {
  it('returns rank from repo', async () => {
    const svc = new XpService(makeProfileRepo(), noopBus, noopLogger);
    const rank = await svc.getRank('g1', 'u1');
    assert.equal(rank, 1);
  });

  it('throws when profile not found', async () => {
    const svc = new XpService(makeProfileRepo(null), noopBus, noopLogger);
    await assert.rejects(() => svc.getRank('g1', 'u1'), /not found/i);
  });
});
