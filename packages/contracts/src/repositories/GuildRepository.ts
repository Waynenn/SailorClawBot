import type { GuildDto, SnowflakeId } from "../types/index.js";

export interface GuildRepository {
	findById(id: SnowflakeId): Promise<GuildDto | null>;
	upsert(guild: Pick<GuildDto, "id" | "name">): Promise<GuildDto>;
}
