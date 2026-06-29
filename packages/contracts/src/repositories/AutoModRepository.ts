import type { AutoModRuleDto } from "../dto/AutoModRuleDto.js";

export interface AutoModRepository {
	findAllByGuild(guildId: string): Promise<AutoModRuleDto[]>;
	upsert(
		guildId: string,
		type: string,
		enabled: boolean,
		config: Record<string, unknown>,
	): Promise<AutoModRuleDto>;
}
