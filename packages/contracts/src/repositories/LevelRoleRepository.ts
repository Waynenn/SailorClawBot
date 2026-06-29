import type { LevelRoleDto } from "../types/index.js";

export interface LevelRoleRepository {
	findByGuild(guildId: string): Promise<LevelRoleDto[]>;
	findByLevel(guildId: string, level: number): Promise<LevelRoleDto | null>;
	upsert(data: {
		guildId: string;
		level: number;
		roleId: string;
	}): Promise<LevelRoleDto>;
	delete(id: string): Promise<void>;
}
