import type { PrismaClient } from '@prisma/client';
import type { TicketRepository, TicketDto, TicketStats, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { translatePrismaError } from './prisma-errors.js';

type TicketRow = {
  id: string;
  guildId: string;
  openedByUserId: string;
  channelId: string | null;
  claimedById: string | null;
  claimedAt: Date | null;
  closedById: string | null;
  rating: number | null;
  subject: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function toTicketDto(row: TicketRow): TicketDto {
  return {
    id: row.id,
    guildId: row.guildId,
    openedByUserId: row.openedByUserId,
    channelId: row.channelId,
    claimedById: row.claimedById,
    claimedAt: row.claimedAt,
    closedById: row.closedById,
    rating: row.rating,
    subject: row.subject,
    status: row.status as 'open' | 'claimed' | 'closed',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class TicketRepositoryImpl implements TicketRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(id: string): Promise<TicketDto | null> {
    if (!id) throw new ValidationError('Ticket ID cannot be empty', 'id');
    const row = await this.db.ticket.findUnique({ where: { id } });
    return row ? toTicketDto(row) : null;
  }

  public async findByChannel(channelId: SnowflakeId): Promise<TicketDto | null> {
    const row = await this.db.ticket.findFirst({ where: { channelId, status: { not: 'closed' } } });
    return row ? toTicketDto(row) : null;
  }

  public async listOpenByGuild(guildId: SnowflakeId): Promise<TicketDto[]> {
    if (!guildId) throw new ValidationError('Guild ID cannot be empty', 'guildId');
    const rows = await this.db.ticket.findMany({
      where: { guildId, status: { in: ['open', 'claimed'] } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toTicketDto);
  }

  public async countByStatus(guildId: SnowflakeId): Promise<TicketStats> {
    const groups = await this.db.ticket.groupBy({
      by: ['status'],
      where: { guildId },
      _count: { _all: true },
    });
    const map: Record<string, number> = {};
    for (const g of groups) map[g.status] = g._count._all;
    return { open: map['open'] ?? 0, claimed: map['claimed'] ?? 0, closed: map['closed'] ?? 0 };
  }

  public async countAll(guildId: SnowflakeId): Promise<number> {
    return this.db.ticket.count({ where: { guildId } });
  }

  public async create(
    input: Pick<TicketDto, 'guildId' | 'openedByUserId' | 'channelId' | 'subject'>
  ): Promise<TicketDto> {
    if (!input.guildId) throw new ValidationError('Guild ID is required', 'guildId');
    if (!input.openedByUserId) throw new ValidationError('User ID is required', 'openedByUserId');
    try {
      const row = await this.db.ticket.create({
        data: {
          guildId: input.guildId,
          openedByUserId: input.openedByUserId,
          channelId: input.channelId,
          subject: input.subject,
        },
      });
      return toTicketDto(row);
    } catch (error) {
      translatePrismaError(error, 'create ticket');
    }
  }

  public async claim(id: string, claimedById: SnowflakeId): Promise<TicketDto> {
    try {
      const row = await this.db.ticket.update({
        where: { id },
        data: { status: 'claimed', claimedById, claimedAt: new Date() },
      });
      return toTicketDto(row);
    } catch (error) {
      translatePrismaError(error, 'claim ticket');
    }
  }

  public async close(id: string): Promise<TicketDto> {
    try {
      const row = await this.db.ticket.update({ where: { id }, data: { status: 'closed' } });
      return toTicketDto(row);
    } catch (error) {
      translatePrismaError(error, 'close ticket');
    }
  }

  public async closeWithDetails(id: string, closedById: SnowflakeId): Promise<TicketDto> {
    try {
      const row = await this.db.ticket.update({
        where: { id },
        data: { status: 'closed', closedById },
      });
      return toTicketDto(row);
    } catch (error) {
      translatePrismaError(error, 'close ticket');
    }
  }

  public async setRating(id: string, rating: number): Promise<TicketDto> {
    try {
      const row = await this.db.ticket.update({ where: { id }, data: { rating } });
      return toTicketDto(row);
    } catch (error) {
      translatePrismaError(error, 'rate ticket');
    }
  }

  public async listClosedWithChannelBefore(date: Date): Promise<TicketDto[]> {
    const rows = await this.db.ticket.findMany({
      where: { status: 'closed', channelId: { not: null }, updatedAt: { lt: date } },
    });
    return rows.map(toTicketDto);
  }

  public async clearChannelId(id: string): Promise<void> {
    await this.db.ticket.update({ where: { id }, data: { channelId: null } });
  }
}
