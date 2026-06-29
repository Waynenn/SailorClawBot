import type { PrismaClient } from "@prisma/client";
import type {
	GuildSettingsDto,
	GuildSettingsRepository,
} from "@sailorclawbot/contracts";
import { toGuildSettingsDto } from "./mappers.js";
import { translatePrismaError } from "./prisma-errors.js";

export class GuildSettingsRepositoryImpl implements GuildSettingsRepository {
	public constructor(private readonly db: PrismaClient) {}

	public async findByGuild(guildId: string): Promise<GuildSettingsDto | null> {
		const row = await this.db.guildSettings.findUnique({ where: { guildId } });
		return row ? toGuildSettingsDto(row) : null;
	}

	public async upsert(
		guildId: string,
		data: Partial<Omit<GuildSettingsDto, "guildId">>,
	): Promise<GuildSettingsDto> {
		try {
			const row = await this.db.guildSettings.upsert({
				where: { guildId },
				create: { guildId, ...data },
				update: data,
			});
			return toGuildSettingsDto(row);
		} catch (error) {
			translatePrismaError(error, "upsert guild settings");
		}
	}
}
