import type { PrismaClient } from '@prisma/client';
import type { WarningRepository, WarningDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { toWarningDto } from './mappers.js';
import { translatePrismaError } from './prisma-errors.js';

export class WarningRepositoryImpl implements WarningRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(id: string): Promise<WarningDto | null> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Warning ID cannot be empty', 'id');
    }
    const row = await this.db.warning.findUnique({ where: { id } });
    return row ? toWarningDto(row) : null;
  }

  public async findByGuildAndUser(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<WarningDto[]> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    const rows = await this.db.warning.findMany({
      where: { guildId, userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toWarningDto);
  }

  public async create(input: Omit<WarningDto, 'id' | 'createdAt'>): Promise<WarningDto> {
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
      const row = await this.db.warning.create({
        data: {
          guildId: input.guildId,
          userId: input.userId,
          reason: input.reason,
          moderatorId: input.moderatorId,
          caseNumber: input.caseNumber,
        },
      });
      return toWarningDto(row);
    } catch (error) {
      translatePrismaError(error, 'create warning');
    }
  }

  public async count(guildId: SnowflakeId, userId: SnowflakeId): Promise<number> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    try {
      return await this.db.warning.count({ where: { guildId, userId } });
    } catch (error) {
      translatePrismaError(error, 'count warnings');
    }
  }
}
