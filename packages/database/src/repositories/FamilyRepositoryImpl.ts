import type { PrismaClient } from '@prisma/client';
import type { FamilyRepository, FamilyDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { translatePrismaError } from './prisma-errors.js';

function toFamilyDto(row: { id: string; guildId: string; name: string; ownerUserId: string; createdAt: Date; updatedAt: Date }): FamilyDto {
  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class FamilyRepositoryImpl implements FamilyRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(id: string): Promise<FamilyDto | null> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Family ID cannot be empty', 'id');
    }
    const row = await this.db.family.findUnique({ where: { id } });
    return row ? toFamilyDto(row) : null;
  }

  public async listByGuild(guildId: SnowflakeId): Promise<FamilyDto[]> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    const rows = await this.db.family.findMany({
      where: { guildId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toFamilyDto);
  }

  public async create(
    input: Pick<FamilyDto, 'guildId' | 'name' | 'ownerUserId'>
  ): Promise<FamilyDto> {
    if (!input.guildId || input.guildId.trim().length === 0) {
      throw new ValidationError('Guild ID is required', 'guildId');
    }
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Family name is required', 'name');
    }
    if (!input.ownerUserId || input.ownerUserId.trim().length === 0) {
      throw new ValidationError('Owner user ID is required', 'ownerUserId');
    }

    try {
      const row = await this.db.family.create({
        data: {
          guildId: input.guildId,
          name: input.name,
          ownerUserId: input.ownerUserId,
        },
      });
      return toFamilyDto(row);
    } catch (error) {
      translatePrismaError(error, 'create family');
    }
  }
}
