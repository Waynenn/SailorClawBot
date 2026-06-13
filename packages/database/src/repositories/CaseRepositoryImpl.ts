import type { PrismaClient, Prisma } from '@prisma/client';
import type { CaseRepository, CaseDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { toCaseDto } from './mappers.js';
import { translatePrismaError } from './prisma-errors.js';

export class CaseRepositoryImpl implements CaseRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(id: string): Promise<CaseDto | null> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Case ID cannot be empty', 'id');
    }
    const row = await this.db.case.findUnique({ where: { id } });
    return row ? toCaseDto(row) : null;
  }

  public async findByGuildAndNumber(
    guildId: SnowflakeId,
    caseNumber: number
  ): Promise<CaseDto | null> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    const row = await this.db.case.findUnique({
      where: { guildId_caseNumber: { guildId, caseNumber } },
    });
    return row ? toCaseDto(row) : null;
  }

  public async listByGuild(
    guildId: SnowflakeId,
    limit = 50,
    offset = 0
  ): Promise<CaseDto[]> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    const rows = await this.db.case.findMany({
      where: { guildId },
      orderBy: { caseNumber: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map(toCaseDto);
  }

  public async listByUser(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    limit = 50
  ): Promise<CaseDto[]> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    const rows = await this.db.case.findMany({
      where: { guildId, userId },
      orderBy: { caseNumber: 'desc' },
      take: limit,
    });
    return rows.map(toCaseDto);
  }

  /**
   * Atomically allocates the next case number using a per-guild counter.
   * The upsert + increment runs as a single statement, so concurrent
   * moderation actions never receive the same number.
   */
  public async getNextCaseNumber(guildId: SnowflakeId): Promise<number> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    try {
      const counter = await this.db.guildCaseCounter.upsert({
        where: { guildId },
        create: { guildId, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
        select: { lastNumber: true },
      });
      return counter.lastNumber;
    } catch (error) {
      translatePrismaError(error, 'allocate case number');
    }
  }

  public async create(
    input: Omit<CaseDto, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CaseDto> {
    if (!input.guildId || input.guildId.trim().length === 0) {
      throw new ValidationError('Guild ID is required', 'guildId');
    }
    if (input.caseNumber < 1) {
      throw new ValidationError('Case number must be positive', 'caseNumber');
    }

    try {
      const row = await this.db.case.create({
        data: {
          guildId: input.guildId,
          caseNumber: input.caseNumber,
          type: input.type,
          userId: input.userId,
          moderatorId: input.moderatorId,
          action: input.action,
          reason: input.reason ?? null,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
          isAppealed: input.isAppealed,
          appealReason: input.appealReason ?? null,
          resolvedAt: input.resolvedAt ?? null,
        },
      });
      return toCaseDto(row);
    } catch (error) {
      translatePrismaError(error, 'create case');
    }
  }

  public async update(id: string, changes: Partial<CaseDto>): Promise<CaseDto> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Case ID cannot be empty', 'id');
    }

    const data: Prisma.CaseUpdateInput = {};
    if (changes.type !== undefined) data.type = changes.type;
    if (changes.reason !== undefined) data.reason = changes.reason;
    if (changes.metadata !== undefined) {
      data.metadata = changes.metadata as Prisma.InputJsonValue;
    }
    if (changes.isAppealed !== undefined) data.isAppealed = changes.isAppealed;
    if (changes.appealReason !== undefined) data.appealReason = changes.appealReason;
    if (changes.resolvedAt !== undefined) data.resolvedAt = changes.resolvedAt;

    try {
      const row = await this.db.case.update({ where: { id }, data });
      return toCaseDto(row);
    } catch (error) {
      translatePrismaError(error, 'update case');
    }
  }

  public async delete(id: string): Promise<void> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Case ID cannot be empty', 'id');
    }
    try {
      await this.db.case.delete({ where: { id } });
    } catch (error) {
      translatePrismaError(error, 'delete case');
    }
  }
}
