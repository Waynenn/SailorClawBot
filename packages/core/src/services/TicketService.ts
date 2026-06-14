import type { TicketRepository, TicketDto, SnowflakeId } from '@sailorclawbot/contracts';
import { EventNames } from '@sailorclawbot/contracts';
import type { EventBus } from '../common/events/EventBus.js';
import type { Logger } from '../common/logging/Logger.js';
import { NotFoundError } from '../common/errors/NotFoundError.js';
import { ConflictError } from '../common/errors/ConflictError.js';

export class TicketService {
  public constructor(
    private readonly tickets: TicketRepository,
    private readonly bus: EventBus,
    private readonly logger: Logger
  ) {}

  public async openTicket(
    guildId: SnowflakeId,
    openedByUserId: SnowflakeId,
    channelId: SnowflakeId | null = null
  ): Promise<TicketDto> {
    const ticket = await this.tickets.create({ guildId, openedByUserId, channelId });
    this.logger.info('Ticket opened', { guildId, openedByUserId, ticketId: ticket.id });
    await this.bus.publish({
      name: EventNames.TicketOpened,
      payload: { guildId, openedByUserId, ticketId: ticket.id, channelId },
      occurredAt: new Date(),
    });
    return ticket;
  }

  public async closeTicket(id: string): Promise<TicketDto> {
    const existing = await this.tickets.findById(id);
    if (!existing) throw new NotFoundError('Ticket', id);
    if (existing.status === 'closed') {
      throw new ConflictError('Ticket is already closed', 'TICKET_ALREADY_CLOSED');
    }

    const ticket = await this.tickets.close(id);
    this.logger.info('Ticket closed', { ticketId: id, guildId: ticket.guildId });
    await this.bus.publish({
      name: EventNames.TicketClosed,
      payload: { ticketId: id, guildId: ticket.guildId },
      occurredAt: new Date(),
    });
    return ticket;
  }

  public async listOpenByGuild(guildId: SnowflakeId): Promise<TicketDto[]> {
    return this.tickets.listOpenByGuild(guildId);
  }

  public async findTicket(id: string): Promise<TicketDto | null> {
    return this.tickets.findById(id);
  }
}
