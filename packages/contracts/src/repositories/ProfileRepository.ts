import type { ProfileDto, SnowflakeId } from "../types/index.js";

export interface ProfileRepository {
	findByGuildAndUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<ProfileDto | null>;
	create(
		input: Pick<ProfileDto, "guildId" | "userId" | "displayName">,
	): Promise<ProfileDto>;
	update(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		changes: { displayName?: string | null },
	): Promise<ProfileDto>;
	updateXp(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		data: { xp: number; level: number; totalXp: number },
	): Promise<ProfileDto>;
	findLeaderboard(
		guildId: SnowflakeId,
		skip: number,
		take: number,
	): Promise<ProfileDto[]>;
	countByGuild(guildId: SnowflakeId): Promise<number>;
	findRank(guildId: SnowflakeId, userId: SnowflakeId): Promise<number>;
}
