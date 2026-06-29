import type { GuildSettingsDto } from "../types/index.js";

export interface GuildSettingsRepository {
	findByGuild(guildId: string): Promise<GuildSettingsDto | null>;
	upsert(
		guildId: string,
		data: Partial<Omit<GuildSettingsDto, "guildId">>,
	): Promise<GuildSettingsDto>;
}
