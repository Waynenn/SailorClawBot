import type { PrismaClient } from "@prisma/client";
import type {
	XpMultiplierDto,
	XpMultiplierRepository,
} from "@sailorclawbot/contracts";
import { toXpMultiplierDto } from "./mappers.js";
import { translatePrismaError } from "./prisma-errors.js";

export class XpMultiplierRepositoryImpl implements XpMultiplierRepository {
	public constructor(private readonly db: PrismaClient) {}

	public async findByGuild(guildId: string): Promise<XpMultiplierDto[]> {
		const rows = await this.db.xpMultiplier.findMany({ where: { guildId } });
		return rows.map(toXpMultiplierDto);
	}

	public async findByTarget(
		guildId: string,
		targetId: string,
		targetType: "channel" | "role",
	): Promise<XpMultiplierDto | null> {
		const row = await this.db.xpMultiplier.findFirst({
			where: { guildId, targetId, targetType },
		});
		return row ? toXpMultiplierDto(row) : null;
	}

	public async upsert(data: {
		guildId: string;
		targetId: string;
		targetType: "channel" | "role";
		multiplier: number;
	}): Promise<XpMultiplierDto> {
		try {
			const row = await this.db.xpMultiplier.upsert({
				where: {
					guildId_targetId_targetType: {
						guildId: data.guildId,
						targetId: data.targetId,
						targetType: data.targetType,
					},
				},
				create: data,
				update: { multiplier: data.multiplier },
			});
			return toXpMultiplierDto(row);
		} catch (error) {
			translatePrismaError(error, "upsert xp multiplier");
		}
	}

	public async delete(id: string): Promise<void> {
		try {
			await this.db.xpMultiplier.delete({ where: { id } });
		} catch (error) {
			translatePrismaError(error, "delete xp multiplier");
		}
	}
}
