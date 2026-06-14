import type { PrismaClient } from '@prisma/client';
import type { RoleMappingDto, RoleMappingRepository, SnowflakeId } from '@sailorclawbot/contracts';
import { translatePrismaError } from './prisma-errors.js';

export class RoleMappingRepositoryImpl implements RoleMappingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hasPermission(guildId: SnowflakeId, roleIds: SnowflakeId[], permission: string): Promise<boolean> {
    if (roleIds.length === 0) return false;
    const count = await this.prisma.roleMapping.count({
      where: { guildId, roleId: { in: roleIds }, permission },
    });
    return count > 0;
  }

  async listByGuild(guildId: SnowflakeId): Promise<RoleMappingDto[]> {
    const rows = await this.prisma.roleMapping.findMany({ where: { guildId } });
    return rows.map(toDto);
  }

  async add(guildId: SnowflakeId, roleId: SnowflakeId, permission: string): Promise<RoleMappingDto> {
    try {
      const row = await this.prisma.roleMapping.upsert({
        where: { guildId_roleId_permission: { guildId, roleId, permission } },
        update: {},
        create: { guildId, roleId, permission },
      });
      return toDto(row);
    } catch (e) {
      translatePrismaError(e, 'RoleMapping.add');
    }
  }

  async remove(guildId: SnowflakeId, roleId: SnowflakeId, permission: string): Promise<void> {
    await this.prisma.roleMapping.deleteMany({ where: { guildId, roleId, permission } });
  }
}

function toDto(row: { id: string; guildId: string; roleId: string; permission: string }): RoleMappingDto {
  return { id: row.id, guildId: row.guildId, roleId: row.roleId, permission: row.permission };
}
