import type { PrismaClient } from "@prisma/client";
import type { GiveawayDto, GiveawayRepository } from "@sailorclawbot/contracts";
import { toGiveawayDto } from "./mappers.js";

export class GiveawayRepositoryImpl implements GiveawayRepository {
	public constructor(private readonly prisma: PrismaClient) {}

	public async findById(id: string): Promise<GiveawayDto | null> {
		const row = await this.prisma.giveaway.findUnique({ where: { id } });
		return row ? toGiveawayDto(row) : null;
	}

	public async findActive(guildId: string): Promise<GiveawayDto[]> {
		const rows = await this.prisma.giveaway.findMany({
			where: { guildId, endedAt: null },
			orderBy: { endsAt: "asc" },
		});
		return rows.map(toGiveawayDto);
	}

	public async findExpired(): Promise<GiveawayDto[]> {
		const rows = await this.prisma.giveaway.findMany({
			where: { endsAt: { lte: new Date() }, endedAt: null },
		});
		return rows.map(toGiveawayDto);
	}

	public async create(
		input: Omit<GiveawayDto, "id" | "endedAt" | "participants" | "winners">,
	): Promise<GiveawayDto> {
		const row = await this.prisma.giveaway.create({
			data: {
				guildId: input.guildId,
				channelId: input.channelId,
				messageId: input.messageId,
				prize: input.prize,
				winnersCount: input.winnersCount,
				endsAt: input.endsAt,
				hostId: input.hostId,
				requiredRoleId: input.requiredRoleId,
				boosterOnly: input.boosterOnly,
				minLevel: input.minLevel,
			},
		});
		return toGiveawayDto(row);
	}

	public async setMessageId(
		id: string,
		messageId: string,
	): Promise<GiveawayDto> {
		const row = await this.prisma.giveaway.update({
			where: { id },
			data: { messageId },
		});
		return toGiveawayDto(row);
	}

	public async addParticipant(
		id: string,
		userId: string,
	): Promise<GiveawayDto> {
		const giveaway = await this.prisma.giveaway.findUniqueOrThrow({
			where: { id },
		});
		const current = (giveaway.participants as unknown as string[]) ?? [];
		if (current.includes(userId)) return toGiveawayDto(giveaway);
		const updated = [...current, userId];
		const row = await this.prisma.giveaway.update({
			where: { id },
			data: {
				participants: updated as unknown as Parameters<
					typeof this.prisma.giveaway.update
				>[0]["data"]["participants"],
			},
		});
		return toGiveawayDto(row);
	}

	public async end(id: string, winners: string[]): Promise<GiveawayDto> {
		const row = await this.prisma.giveaway.update({
			where: { id },
			data: {
				endedAt: new Date(),
				winners: winners as unknown as Parameters<
					typeof this.prisma.giveaway.update
				>[0]["data"]["winners"],
			},
		});
		return toGiveawayDto(row);
	}
}
