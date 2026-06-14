import type { PrismaClient } from '@prisma/client';
import type { GuildMemberRepository, GuildMemberDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { toGuildMemberDto } from './mappers.js';
import { translatePrismaError } from './prisma-errors.js';

export class GuildMemberRepositoryImpl implements GuildMemberRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findByGuildAndUser(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<GuildMemberDto | null> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    const row = await this.db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    return row ? toGuildMemberDto(row) : null;
  }

  public async upsert(member: GuildMemberDto): Promise<GuildMemberDto> {
    if (!member.guildId || member.guildId.trim().length === 0) {
      throw new ValidationError('Guild ID is required', 'guildId');
    }
    if (!member.userId || member.userId.trim().length === 0) {
      throw new ValidationError('User ID is required', 'userId');
    }

    try {
      const row = await this.db.guildMember.upsert({
        where: { guildId_userId: { guildId: member.guildId, userId: member.userId } },
        create: { guildId: member.guildId, userId: member.userId },
        update: {},
      });
      return toGuildMemberDto(row);
    } catch (error) {
      translatePrismaError(error, 'upsert guild member');
    }
  }
}
