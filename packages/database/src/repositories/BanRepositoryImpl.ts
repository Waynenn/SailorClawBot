import type { PrismaClient } from '@prisma/client';
import type { BanRepository, BanDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { toBanDto } from './mappers.js';
import { translatePrismaError } from './prisma-errors.js';

export class BanRepositoryImpl implements BanRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(id: string): Promise<BanDto | null> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Ban ID cannot be empty', 'id');
    }
    const row = await this.db.ban.findUnique({ where: { id } });
    return row ? toBanDto(row) : null;
  }

  /** Returns the most recent ban for the user (active or not). */
  public async findByGuildAndUser(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<BanDto | null> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    const row = await this.db.ban.findFirst({
      where: { guildId, userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (row?.expiresAt && row.expiresAt < new Date()) return null;
    return row ? toBanDto(row) : null;
  }

  public async findActive(guildId: SnowflakeId): Promise<BanDto[]> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    const now = new Date();
    const rows = await this.db.ban.findMany({
      where: { guildId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.filter((r) => !r.expiresAt || r.expiresAt >= now).map(toBanDto);
  }

  public async findExpired(): Promise<BanDto[]> {
    const now = new Date();
    const rows = await this.db.ban.findMany({
      where: { isActive: true, expiresAt: { not: null, lte: now } },
    });
    return rows.map(toBanDto);
  }

  public async create(input: Omit<BanDto, 'id' | 'createdAt'>): Promise<BanDto> {
    if (!input.guildId || input.guildId.trim().length === 0) {
      throw new ValidationError('Guild ID is required', 'guildId');
    }
    if (!input.userId || input.userId.trim().length === 0) {
      throw new ValidationError('User ID is required', 'userId');
    }
    if (!input.reason || input.reason.trim().length === 0) {
      throw new ValidationError('Reason is required', 'reason');
    }
    if (!input.moderatorId || input.moderatorId.trim().length === 0) {
      throw new ValidationError('Moderator ID is required', 'moderatorId');
    }
    if (input.caseNumber < 1) {
      throw new ValidationError('Case number must be positive', 'caseNumber');
    }

    try {
      const row = await this.db.ban.create({
        data: {
          guildId: input.guildId,
          userId: input.userId,
          reason: input.reason,
          moderatorId: input.moderatorId,
          caseNumber: input.caseNumber,
          expiresAt: input.expiresAt ?? null,
          isActive: input.isActive,
        },
      });
      return toBanDto(row);
    } catch (error) {
      translatePrismaError(error, 'create ban');
    }
  }

  public async deactivate(id: string): Promise<BanDto> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Ban ID cannot be empty', 'id');
    }
    try {
      const row = await this.db.ban.update({
        where: { id },
        data: { isActive: false },
      });
      return toBanDto(row);
    } catch (error) {
      translatePrismaError(error, 'deactivate ban');
    }
  }

  public async delete(id: string): Promise<void> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Ban ID cannot be empty', 'id');
    }
    try {
      await this.db.ban.delete({ where: { id } });
    } catch (error) {
      translatePrismaError(error, 'delete ban');
    }
  }
}
