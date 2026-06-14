import type { PrismaClient } from '@prisma/client';
import type { TicketRepository, TicketDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { translatePrismaError } from './prisma-errors.js';

function toTicketDto(row: { id: string; guildId: string; openedByUserId: string; channelId: string | null; status: string; createdAt: Date; updatedAt: Date }): TicketDto {
  return {
    id: row.id,
    guildId: row.guildId,
    openedByUserId: row.openedByUserId,
    channelId: row.channelId,
    status: row.status as 'open' | 'closed',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class TicketRepositoryImpl implements TicketRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(id: string): Promise<TicketDto | null> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Ticket ID cannot be empty', 'id');
    }
    const row = await this.db.ticket.findUnique({ where: { id } });
    return row ? toTicketDto(row) : null;
  }

  public async listOpenByGuild(guildId: SnowflakeId): Promise<TicketDto[]> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    const rows = await this.db.ticket.findMany({
      where: { guildId, status: 'open' },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toTicketDto);
  }

  public async create(
    input: Pick<TicketDto, 'guildId' | 'openedByUserId' | 'channelId'>
  ): Promise<TicketDto> {
    if (!input.guildId || input.guildId.trim().length === 0) {
      throw new ValidationError('Guild ID is required', 'guildId');
    }
    if (!input.openedByUserId || input.openedByUserId.trim().length === 0) {
      throw new ValidationError('User ID is required', 'openedByUserId');
    }

    try {
      const row = await this.db.ticket.create({
        data: {
          guildId: input.guildId,
          openedByUserId: input.openedByUserId,
          channelId: input.channelId,
        },
      });
      return toTicketDto(row);
    } catch (error) {
      translatePrismaError(error, 'create ticket');
    }
  }

  public async close(id: string): Promise<TicketDto> {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Ticket ID cannot be empty', 'id');
    }

    try {
      const row = await this.db.ticket.update({
        where: { id },
        data: { status: 'closed' },
      });
      return toTicketDto(row);
    } catch (error) {
      translatePrismaError(error, 'close ticket');
    }
  }
}
