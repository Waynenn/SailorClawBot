import type { PrismaClient } from '@prisma/client';
import type { LevelRoleRepository, LevelRoleDto } from '@sailorclawbot/contracts';
import { translatePrismaError } from './prisma-errors.js';
import { toLevelRoleDto } from './mappers.js';

export class LevelRoleRepositoryImpl implements LevelRoleRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findByGuild(guildId: string): Promise<LevelRoleDto[]> {
    const rows = await this.db.levelRole.findMany({
      where: { guildId },
      orderBy: { level: 'asc' },
    });
    return rows.map(toLevelRoleDto);
  }

  public async findByLevel(guildId: string, level: number): Promise<LevelRoleDto | null> {
    const row = await this.db.levelRole.findUnique({
      where: { guildId_level: { guildId, level } },
    });
    return row ? toLevelRoleDto(row) : null;
  }

  public async upsert(data: { guildId: string; level: number; roleId: string }): Promise<LevelRoleDto> {
    try {
      const row = await this.db.levelRole.upsert({
        where: { guildId_level: { guildId: data.guildId, level: data.level } },
        create: data,
        update: { roleId: data.roleId },
      });
      return toLevelRoleDto(row);
    } catch (error) {
      translatePrismaError(error, 'upsert level role');
    }
  }

  public async delete(id: string): Promise<void> {
    try {
      await this.db.levelRole.delete({ where: { id } });
    } catch (error) {
      translatePrismaError(error, 'delete level role');
    }
  }
}
