import type { PrismaClient } from "@prisma/client";
import type {
	NoXpTargetDto,
	NoXpTargetRepository,
} from "@sailorclawbot/contracts";
import { toNoXpTargetDto } from "./mappers.js";
import { translatePrismaError } from "./prisma-errors.js";

export class NoXpTargetRepositoryImpl implements NoXpTargetRepository {
	public constructor(private readonly db: PrismaClient) {}

	public async findByGuild(guildId: string): Promise<NoXpTargetDto[]> {
		const rows = await this.db.noXpTarget.findMany({ where: { guildId } });
		return rows.map(toNoXpTargetDto);
	}

	public async isExcluded(guildId: string, targetId: string): Promise<boolean> {
		const row = await this.db.noXpTarget.findFirst({
			where: { guildId, targetId },
		});
		return row !== null;
	}

	public async add(data: {
		guildId: string;
		targetId: string;
		targetType: "channel" | "role";
	}): Promise<NoXpTargetDto> {
		try {
			const row = await this.db.noXpTarget.create({ data });
			return toNoXpTargetDto(row);
		} catch (error) {
			translatePrismaError(error, "add no-xp target");
		}
	}

	public async delete(id: string): Promise<void> {
		try {
			await this.db.noXpTarget.delete({ where: { id } });
		} catch (error) {
			translatePrismaError(error, "delete no-xp target");
		}
	}
}
