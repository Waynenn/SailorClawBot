import type { PrismaClient } from '@prisma/client';
import type { ProfileRepository, ProfileDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { toProfileDto } from './mappers.js';
import { translatePrismaError } from './prisma-errors.js';



export class ProfileRepositoryImpl implements ProfileRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findByGuildAndUser(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<ProfileDto | null> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    const row = await this.db.profile.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    return row ? toProfileDto(row) : null;
  }

  public async create(
    input: Pick<ProfileDto, 'guildId' | 'userId' | 'displayName'>
  ): Promise<ProfileDto> {
    if (!input.guildId || input.guildId.trim().length === 0) {
      throw new ValidationError('Guild ID is required', 'guildId');
    }
    if (!input.userId || input.userId.trim().length === 0) {
      throw new ValidationError('User ID is required', 'userId');
    }

    try {
      const row = await this.db.profile.create({
        data: {
          guildId: input.guildId,
          userId: input.userId,
          displayName: input.displayName,
        },
      });
      return toProfileDto(row);
    } catch (error) {
      translatePrismaError(error, 'create profile');
    }
  }

  public async update(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    changes: { displayName?: string | null }
  ): Promise<ProfileDto> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }

    try {
      const row = await this.db.profile.update({
        where: { guildId_userId: { guildId, userId } },
        data: changes,
      });
      return toProfileDto(row);
    } catch (error) {
      translatePrismaError(error, 'update profile');
    }
  }

  public async updateXp(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    data: { xp: number; level: number; totalXp: number }
  ): Promise<ProfileDto> {
    try {
      const row = await this.db.profile.update({
        where: { guildId_userId: { guildId, userId } },
        data,
      });
      return toProfileDto(row);
    } catch (error) {
      translatePrismaError(error, 'update profile xp');
    }
  }

  public async findLeaderboard(guildId: SnowflakeId, skip: number, take: number): Promise<ProfileDto[]> {
    const rows = await this.db.profile.findMany({
      where: { guildId },
      orderBy: { totalXp: 'desc' },
      skip,
      take,
    });
    return rows.map(toProfileDto);
  }

  public async countByGuild(guildId: SnowflakeId): Promise<number> {
    return this.db.profile.count({ where: { guildId } });
  }

  public async findRank(guildId: SnowflakeId, userId: SnowflakeId): Promise<number> {
    const profile = await this.db.profile.findUnique({
      where: { guildId_userId: { guildId, userId } },
      select: { totalXp: true },
    });
    if (!profile) return 0;
    const above = await this.db.profile.count({
      where: { guildId, totalXp: { gt: profile.totalXp } },
    });
    return above + 1;
  }
}
