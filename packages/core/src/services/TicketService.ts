import type {
	SnowflakeId,
	TicketDto,
	TicketRepository,
	TicketStats,
} from "@sailorclawbot/contracts";
import { EventNames } from "@sailorclawbot/contracts";
import { ConflictError } from "../common/errors/ConflictError.js";
import { NotFoundError } from "../common/errors/NotFoundError.js";
import type { EventBus } from "../common/events/EventBus.js";
import type { Logger } from "../common/logging/Logger.js";

export class TicketService {
	public constructor(
		private readonly tickets: TicketRepository,
		private readonly bus: EventBus,
		private readonly logger: Logger,
	) {}

	public async openTicket(
		guildId: SnowflakeId,
		openedByUserId: SnowflakeId,
		channelId: SnowflakeId | null = null,
		subject: string | null = null,
	): Promise<TicketDto> {
		const ticket = await this.tickets.create({
			guildId,
			openedByUserId,
			channelId,
			subject,
		});
		this.logger.info("Ticket opened", {
			guildId,
			openedByUserId,
			ticketId: ticket.id,
		});
		await this.bus.publish({
			name: EventNames.TicketOpened,
			payload: { guildId, openedByUserId, ticketId: ticket.id, channelId },
			occurredAt: new Date(),
		});
		return ticket;
	}

	public async claimTicket(
		id: string,
		claimedById: SnowflakeId,
	): Promise<TicketDto> {
		const existing = await this.tickets.findById(id);
		if (!existing) throw new NotFoundError("Ticket", id);
		if (existing.status === "closed")
			throw new ConflictError("Ticket is closed", "TICKET_ALREADY_CLOSED");
		if (existing.status === "claimed")
			throw new ConflictError(
				"Ticket already claimed",
				"TICKET_ALREADY_CLAIMED",
			);
		const ticket = await this.tickets.claim(id, claimedById);
		this.logger.info("Ticket claimed", { ticketId: id, claimedById });
		return ticket;
	}

	public async closeTicket(id: string): Promise<TicketDto> {
		const existing = await this.tickets.findById(id);
		if (!existing) throw new NotFoundError("Ticket", id);
		if (existing.status === "closed")
			throw new ConflictError(
				"Ticket is already closed",
				"TICKET_ALREADY_CLOSED",
			);
		const ticket = await this.tickets.close(id);
		this.logger.info("Ticket closed", {
			ticketId: id,
			guildId: ticket.guildId,
		});
		await this.bus.publish({
			name: EventNames.TicketClosed,
			payload: { ticketId: id, guildId: ticket.guildId },
			occurredAt: new Date(),
		});
		return ticket;
	}

	public async closeTicketByUser(
		id: string,
		closedById: SnowflakeId,
	): Promise<TicketDto> {
		const existing = await this.tickets.findById(id);
		if (!existing) throw new NotFoundError("Ticket", id);
		if (existing.status === "closed")
			throw new ConflictError(
				"Ticket is already closed",
				"TICKET_ALREADY_CLOSED",
			);
		const ticket = await this.tickets.closeWithDetails(id, closedById);
		this.logger.info("Ticket closed", {
			ticketId: id,
			closedById,
			guildId: ticket.guildId,
		});
		await this.bus.publish({
			name: EventNames.TicketClosed,
			payload: { ticketId: id, guildId: ticket.guildId },
			occurredAt: new Date(),
		});
		return ticket;
	}

	public async rateTicket(id: string, rating: number): Promise<TicketDto> {
		const existing = await this.tickets.findById(id);
		if (!existing) throw new NotFoundError("Ticket", id);
		return this.tickets.setRating(id, rating);
	}

	public async findByChannel(
		channelId: SnowflakeId,
	): Promise<TicketDto | null> {
		return this.tickets.findByChannel(channelId);
	}

	public async listOpenByGuild(guildId: SnowflakeId): Promise<TicketDto[]> {
		return this.tickets.listOpenByGuild(guildId);
	}

	public async findTicket(id: string): Promise<TicketDto | null> {
		return this.tickets.findById(id);
	}

	public async getStats(guildId: SnowflakeId): Promise<TicketStats> {
		return this.tickets.countByStatus(guildId);
	}

	public async nextTicketNumber(guildId: SnowflakeId): Promise<number> {
		return (await this.tickets.countAll(guildId)) + 1;
	}

	public async listExpiredChannels(olderThan: Date): Promise<TicketDto[]> {
		return this.tickets.listClosedWithChannelBefore(olderThan);
	}

	public async clearChannelId(id: string): Promise<void> {
		return this.tickets.clearChannelId(id);
	}
}
