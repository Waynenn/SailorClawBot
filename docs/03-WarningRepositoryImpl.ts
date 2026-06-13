// ============================================================================
// packages/database/src/repositories/WarningRepositoryImpl.ts
// Example implementation - follow this pattern for all other repositories
// ============================================================================

import type { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library.js';
import type { WarningRepository, WarningDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError, NotFoundError } from '@sailorclawbot/core';

/**
 * Concrete implementation of WarningRepository using Prisma
 * 
 * Responsibilities:
 * - Create warnings
 * - Query warnings by user
 * - Count warnings
 * - Generate case numbers
 * 
 * Error Handling:
 * - Validates input
 * - Converts Prisma errors to domain errors
 * - Provides clear error messages
 */
export class WarningRepositoryImpl implements WarningRepository {
  constructor(private db: PrismaClient) {}

  async findById(id: string): Promise<WarningDto | null> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Warning ID cannot be empty');
    }

    try {
      const warning = await this.db.warning.findUnique({
        where: { id }
      });

      return warning ?? null;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        throw new ValidationError(`Failed to find warning: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Find all warnings for a user in a guild
   * Ordered by most recent first
   */
  async findByGuildAndUser(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<WarningDto[]> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty');
    }

    try {
      const warnings = await this.db.warning.findMany({
        where: {
          guildId,
          userId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return warnings;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        throw new ValidationError(
          `Failed to find warnings for user: ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Get next sequential case number for a guild
   * Used for human-readable case references
   */
  async getNextCaseNumber(guildId: SnowflakeId): Promise<number> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty');
    }

    try {
      const lastWarning = await this.db.warning.findFirst({
        where: { guildId },
        orderBy: { caseNumber: 'desc' },
        select: { caseNumber: true }
      });

      return (lastWarning?.caseNumber ?? 0) + 1;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        throw new ValidationError(`Failed to get case number: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create a new warning
   * Validates all required fields before insertion
   */
  async create(input: Omit<WarningDto, 'id' | 'createdAt'>): Promise<WarningDto> {
    // Validate input
    if (!input.guildId || input.guildId.trim().length === 0) {
      throw new ValidationError('Guild ID is required');
    }
    if (!input.userId || input.userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }
    if (!input.reason || input.reason.trim().length === 0) {
      throw new ValidationError('Reason is required');
    }
    if (!input.moderatorId || input.moderatorId.trim().length === 0) {
      throw new ValidationError('Moderator ID is required');
    }
    if (input.caseNumber < 1) {
      throw new ValidationError('Case number must be positive');
    }

    try {
      const warning = await this.db.warning.create({
        data: {
          guildId: input.guildId,
          userId: input.userId,
          reason: input.reason,
          moderatorId: input.moderatorId,
          caseNumber: input.caseNumber
        }
      });

      return warning;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        // P2002 = Unique constraint violation
        if (error.code === 'P2002') {
          throw new ValidationError(
            `Warning already exists for case #${input.caseNumber} in guild ${input.guildId}`
          );
        }
        // P2003 = Foreign key constraint violation
        if (error.code === 'P2003') {
          throw new ValidationError(
            'Guild does not exist. Create guild first.'
          );
        }
        throw new ValidationError(`Failed to create warning: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Count warnings for a user in a guild
   * Useful for auto-mute logic (e.g., 3 warnings = auto-mute)
   */
  async count(guildId: SnowflakeId, userId: SnowflakeId): Promise<number> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty');
    }

    try {
      return await this.db.warning.count({
        where: {
          guildId,
          userId
        }
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        throw new ValidationError(`Failed to count warnings: ${error.message}`);
      }
      throw error;
    }
  }
}

// ============================================================================
// INTEGRATION TEST EXAMPLE
// ============================================================================
/*
// packages/database/tests/integration/WarningRepository.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { WarningRepositoryImpl } from '../../src/repositories/WarningRepositoryImpl';
import { ValidationError } from '@sailorclawbot/core';

describe('WarningRepositoryImpl', () => {
  let db: PrismaClient;
  let repo: WarningRepositoryImpl;
  const testGuildId = 'guild_123456789';
  const testUserId = 'user_987654321';
  const testModId = 'mod_111111111';

  beforeAll(async () => {
    db = new PrismaClient();
    repo = new WarningRepositoryImpl(db);

    // Create test guild
    await db.guild.create({
      data: {
        id: testGuildId,
        name: 'Test Guild'
      }
    });
  });

  afterAll(async () => {
    await db.guild.deleteMany({});
    await db.$disconnect();
  });

  describe('create', () => {
    it('should create a warning', async () => {
      const warning = await repo.create({
        guildId: testGuildId,
        userId: testUserId,
        reason: 'Spam',
        moderatorId: testModId,
        caseNumber: 1
      });

      expect(warning.id).toBeDefined();
      expect(warning.guildId).toBe(testGuildId);
      expect(warning.userId).toBe(testUserId);
      expect(warning.reason).toBe('Spam');
      expect(warning.caseNumber).toBe(1);
    });

    it('should reject empty reason', async () => {
      await expect(
        repo.create({
          guildId: testGuildId,
          userId: 'user_2',
          reason: '',
          moderatorId: testModId,
          caseNumber: 2
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject duplicate case number', async () => {
      // First warning already exists with case #1
      await expect(
        repo.create({
          guildId: testGuildId,
          userId: 'user_3',
          reason: 'Different user',
          moderatorId: testModId,
          caseNumber: 1
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('findByGuildAndUser', () => {
    it('should find warnings for user', async () => {
      const warnings = await repo.findByGuildAndUser(testGuildId, testUserId);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].userId).toBe(testUserId);
    });

    it('should return empty array for user with no warnings', async () => {
      const warnings = await repo.findByGuildAndUser(
        testGuildId,
        'user_no_warnings'
      );

      expect(warnings).toEqual([]);
    });
  });

  describe('count', () => {
    it('should count warnings for user', async () => {
      const count = await repo.count(testGuildId, testUserId);

      expect(count).toBeGreaterThan(0);
    });

    it('should return 0 for user with no warnings', async () => {
      const count = await repo.count(testGuildId, 'user_no_warnings');

      expect(count).toBe(0);
    });
  });

  describe('getNextCaseNumber', () => {
    it('should return next sequential case number', async () => {
      const next = await repo.getNextCaseNumber(testGuildId);

      expect(next).toBe(2);
    });

    it('should return 1 for new guild', async () => {
      const newGuildId = 'guild_new_123';
      await db.guild.create({
        data: { id: newGuildId, name: 'New Guild' }
      });

      const next = await repo.getNextCaseNumber(newGuildId);

      expect(next).toBe(1);
    });
  });
});
*/
