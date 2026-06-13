import type { PrismaClient } from '@prisma/client';
import type {
  PermissionRepository,
  PermissionOverrideDto,
  SnowflakeId,
} from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { toPermissionOverrideDto } from './mappers.js';
import { translatePrismaError } from './prisma-errors.js';

export class PermissionRepositoryImpl implements PermissionRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findByGuildUserPermission(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    permission: string
  ): Promise<PermissionOverrideDto | null> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    if (!permission || permission.trim().length === 0) {
      throw new ValidationError('Permission cannot be empty', 'permission');
    }
    const row = await this.db.permissionOverride.findUnique({
      where: { guildId_userId_permission: { guildId, userId, permission } },
    });
    return row ? toPermissionOverrideDto(row) : null;
  }

  public async findByGuildUser(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<PermissionOverrideDto[]> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    const rows = await this.db.permissionOverride.findMany({
      where: { guildId, userId },
    });
    return rows.map(toPermissionOverrideDto);
  }

  public async create(
    input: Omit<PermissionOverrideDto, 'id'>
  ): Promise<PermissionOverrideDto> {
    if (!input.guildId || input.guildId.trim().length === 0) {
      throw new ValidationError('Guild ID is required', 'guildId');
    }
    if (!input.userId || input.userId.trim().length === 0) {
      throw new ValidationError('User ID is required', 'userId');
    }
    if (!input.permission || input.permission.trim().length === 0) {
      throw new ValidationError('Permission is required', 'permission');
    }
    try {
      const row = await this.db.permissionOverride.create({
        data: {
          guildId: input.guildId,
          userId: input.userId,
          permission: input.permission,
          allowed: input.allowed,
        },
      });
      return toPermissionOverrideDto(row);
    } catch (error) {
      translatePrismaError(error, 'create permission override');
    }
  }

  public async update(id: string, allowed: boolean): Promise<PermissionOverrideDto> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Permission override ID cannot be empty', 'id');
    }
    try {
      const row = await this.db.permissionOverride.update({
        where: { id },
        data: { allowed },
      });
      return toPermissionOverrideDto(row);
    } catch (error) {
      translatePrismaError(error, 'update permission override');
    }
  }

  public async delete(id: string): Promise<void> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Permission override ID cannot be empty', 'id');
    }
    try {
      await this.db.permissionOverride.delete({ where: { id } });
    } catch (error) {
      translatePrismaError(error, 'delete permission override');
    }
  }

  public async deleteByGuildAndUser(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<number> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    const result = await this.db.permissionOverride.deleteMany({
      where: { guildId, userId },
    });
    return result.count;
  }
}
