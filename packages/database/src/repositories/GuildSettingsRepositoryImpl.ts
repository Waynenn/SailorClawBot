import type { PrismaClient } from '@prisma/client';
import type { GuildSettingsRepository, GuildSettingsDto } from '@sailorclawbot/contracts';
import { translatePrismaError } from './prisma-errors.js';
import { toGuildSettingsDto } from './mappers.js';

export class GuildSettingsRepositoryImpl implements GuildSettingsRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findByGuild(guildId: string): Promise<GuildSettingsDto | null> {
    const row = await this.db.guildSettings.findUnique({ where: { guildId } });
    return row ? toGuildSettingsDto(row) : null;
  }

  public async upsert(guildId: string, data: Partial<Omit<GuildSettingsDto, 'guildId'>>): Promise<GuildSettingsDto> {
    try {
      const row = await this.db.guildSettings.upsert({
        where: { guildId },
        create: { guildId, ...data },
        update: data,
      });
      return toGuildSettingsDto(row);
    } catch (error) {
      translatePrismaError(error, 'upsert guild settings');
    }
  }
}
