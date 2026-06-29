import type { MuteDto, SnowflakeId } from "../types/index.js";

export interface MuteRepository {
	findById(id: string): Promise<MuteDto | null>;
	findByGuildAndUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<MuteDto | null>;
	findActive(guildId: SnowflakeId): Promise<MuteDto[]>;
	/** All active mutes past their expiry, across every guild (worker use). */
	findExpired(): Promise<MuteDto[]>;
	create(input: Omit<MuteDto, "id" | "createdAt">): Promise<MuteDto>;
	deactivate(id: string): Promise<MuteDto>;
	delete(id: string): Promise<void>;
}
