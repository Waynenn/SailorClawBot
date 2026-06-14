import type { PrismaClient } from '@prisma/client';
import type { GuildRepository, GuildDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { toGuildDto } from './mappers.js';
import { translatePrismaError } from './prisma-errors.js';

export class GuildRepositoryImpl implements GuildRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(id: SnowflakeId): Promise<GuildDto | null> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'id');
    }
    const row = await this.db.guild.findUnique({ where: { id } });
    return row ? toGuildDto(row) : null;
  }

  public async upsert(guild: Pick<GuildDto, 'id' | 'name'>): Promise<GuildDto> {
    if (!guild.id || guild.id.trim().length === 0) {
      throw new ValidationError('Guild ID is required', 'id');
    }
    if (!guild.name || guild.name.trim().length === 0) {
      throw new ValidationError('Guild name is required', 'name');
    }

    try {
      const row = await this.db.guild.upsert({
        where: { id: guild.id },
        create: { id: guild.id, name: guild.name },
        update: { name: guild.name },
      });
      return toGuildDto(row);
    } catch (error) {
      translatePrismaError(error, 'upsert guild');
    }
  }
}
