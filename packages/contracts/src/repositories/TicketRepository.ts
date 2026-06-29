import type { SnowflakeId, TicketDto } from "../types/index.js";

export interface TicketStats {
	open: number;
	claimed: number;
	closed: number;
}

export interface TicketRepository {
	findById(id: string): Promise<TicketDto | null>;
	findByChannel(channelId: SnowflakeId): Promise<TicketDto | null>;
	listOpenByGuild(guildId: SnowflakeId): Promise<TicketDto[]>;
	countByStatus(guildId: SnowflakeId): Promise<TicketStats>;
	countAll(guildId: SnowflakeId): Promise<number>;
	create(
		input: Pick<
			TicketDto,
			"guildId" | "openedByUserId" | "channelId" | "subject"
		>,
	): Promise<TicketDto>;
	claim(id: string, claimedById: SnowflakeId): Promise<TicketDto>;
	close(id: string): Promise<TicketDto>;
	closeWithDetails(id: string, closedById: SnowflakeId): Promise<TicketDto>;
	setRating(id: string, rating: number): Promise<TicketDto>;
	listClosedWithChannelBefore(date: Date): Promise<TicketDto[]>;
	clearChannelId(id: string): Promise<void>;
}
