import type { PrismaClient } from "@prisma/client";
import type {
	StarboardEntryDto,
	StarboardEntryRepository,
} from "@sailorclawbot/contracts";
import { toStarboardEntryDto } from "./mappers.js";

export class StarboardEntryRepositoryImpl implements StarboardEntryRepository {
	public constructor(private readonly prisma: PrismaClient) {}

	public async findByOriginalMessage(
		guildId: string,
		originalMsgId: string,
	): Promise<StarboardEntryDto | null> {
		const row = await this.prisma.starboardEntry.findUnique({
			where: { guildId_originalMsgId: { guildId, originalMsgId } },
		});
		return row ? toStarboardEntryDto(row) : null;
	}

	public async create(
		input: Omit<StarboardEntryDto, "id">,
	): Promise<StarboardEntryDto> {
		const row = await this.prisma.starboardEntry.create({ data: input });
		return toStarboardEntryDto(row);
	}

	public async updateStarCount(
		guildId: string,
		originalMsgId: string,
		starCount: number,
	): Promise<StarboardEntryDto> {
		const row = await this.prisma.starboardEntry.update({
			where: { guildId_originalMsgId: { guildId, originalMsgId } },
			data: { starCount },
		});
		return toStarboardEntryDto(row);
	}

	public async delete(guildId: string, originalMsgId: string): Promise<void> {
		await this.prisma.starboardEntry.delete({
			where: { guildId_originalMsgId: { guildId, originalMsgId } },
		});
	}
}
