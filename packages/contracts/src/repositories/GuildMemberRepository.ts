import type { GuildMemberDto, SnowflakeId } from "../types/index.js";

export interface GuildMemberRepository {
	findByGuildAndUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<GuildMemberDto | null>;
	upsert(member: GuildMemberDto): Promise<GuildMemberDto>;
}
