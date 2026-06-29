import type { SnowflakeId } from "../types/index.js";

export interface RoleMappingDto {
	id: string;
	guildId: string;
	roleId: string;
	permission: string;
}

export interface RoleMappingRepository {
	hasPermission(
		guildId: SnowflakeId,
		roleIds: SnowflakeId[],
		permission: string,
	): Promise<boolean>;
	listByGuild(guildId: SnowflakeId): Promise<RoleMappingDto[]>;
	add(
		guildId: SnowflakeId,
		roleId: SnowflakeId,
		permission: string,
	): Promise<RoleMappingDto>;
	remove(
		guildId: SnowflakeId,
		roleId: SnowflakeId,
		permission: string,
	): Promise<void>;
}
