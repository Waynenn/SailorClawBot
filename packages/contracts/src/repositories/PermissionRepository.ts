import type { PermissionOverrideDto, SnowflakeId } from "../types/index.js";

export interface PermissionRepository {
	findByGuildUserPermission(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		permission: string,
	): Promise<PermissionOverrideDto | null>;
	findByGuildUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<PermissionOverrideDto[]>;
	create(
		input: Omit<PermissionOverrideDto, "id">,
	): Promise<PermissionOverrideDto>;
	update(id: string, allowed: boolean): Promise<PermissionOverrideDto>;
	delete(id: string): Promise<void>;
	deleteByGuildAndUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<number>;
}
