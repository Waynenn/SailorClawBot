import type { BanDto, SnowflakeId } from "../types/index.js";

export interface BanRepository {
	findById(id: string): Promise<BanDto | null>;
	findByGuildAndUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<BanDto | null>;
	findActive(guildId: SnowflakeId): Promise<BanDto[]>;
	/** All active temp-bans past their expiry, across every guild (worker use). Excludes permanent bans (null expiresAt). */
	findExpired(): Promise<BanDto[]>;
	create(input: Omit<BanDto, "id" | "createdAt">): Promise<BanDto>;
	deactivate(id: string): Promise<BanDto>;
	delete(id: string): Promise<void>;
}
