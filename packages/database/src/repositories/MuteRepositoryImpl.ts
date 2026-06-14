import type { PrismaClient } from '@prisma/client';
import type { MuteRepository, MuteDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { toMuteDto } from './mappers.js';
import { translatePrismaError } from './prisma-errors.js';

export class MuteRepositoryImpl implements MuteRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(id: string): Promise<MuteDto | null> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Mute ID cannot be empty', 'id');
    }
    const row = await this.db.mute.findUnique({ where: { id } });
    return row ? toMuteDto(row) : null;
  }

  /** Returns the most recent mute for the user (active or not). */
  public async findByGuildAndUser(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<MuteDto | null> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    const row = await this.db.mute.findFirst({
      where: { guildId, userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (row?.expiresAt && row.expiresAt < new Date()) return null;
    return row ? toMuteDto(row) : null;
  }

  public async findActive(guildId: SnowflakeId): Promise<MuteDto[]> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    const now = new Date();
    const rows = await this.db.mute.findMany({
      where: { guildId, isActive: true },
      orderBy: { expiresAt: 'asc' },
    });
    return rows.filter((r) => !r.expiresAt || r.expiresAt >= now).map(toMuteDto);
  }

  public async create(input: Omit<MuteDto, 'id' | 'createdAt'>): Promise<MuteDto> {
    if (!input.guildId || input.guildId.trim().length === 0) {
      throw new ValidationError('Guild ID is required', 'guildId');
    }
    if (!input.userId || input.userId.trim().length === 0) {
      throw new ValidationError('User ID is required', 'userId');
    }
    if (!input.moderatorId || input.moderatorId.trim().length === 0) {
      throw new ValidationError('Moderator ID is required', 'moderatorId');
    }
    if (input.duration <= 0) {
      throw new ValidationError('Duration must be positive', 'duration');
    }
    if (input.caseNumber < 1) {
      throw new ValidationError('Case number must be positive', 'caseNumber');
    }

    try {
      const row = await this.db.mute.create({
        data: {
          guildId: input.guildId,
          userId: input.userId,
          reason: input.reason ?? null,
          moderatorId: input.moderatorId,
          caseNumber: input.caseNumber,
          duration: input.duration,
          expiresAt: input.expiresAt,
          isActive: input.isActive,
        },
      });
      return toMuteDto(row);
    } catch (error) {
      translatePrismaError(error, 'create mute');
    }
  }

  public async deactivate(id: string): Promise<MuteDto> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Mute ID cannot be empty', 'id');
    }
    try {
      const row = await this.db.mute.update({
        where: { id },
        data: { isActive: false },
      });
      return toMuteDto(row);
    } catch (error) {
      translatePrismaError(error, 'deactivate mute');
    }
  }

  public async delete(id: string): Promise<void> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Mute ID cannot be empty', 'id');
    }
    try {
      await this.db.mute.delete({ where: { id } });
    } catch (error) {
      translatePrismaError(error, 'delete mute');
    }
  }
}
