import type { InventoryItemDto, SnowflakeId } from "../types/index.js";

export interface InventoryItemRepository {
	findByUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<InventoryItemDto[]>;
	findByUserAndItem(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
	): Promise<InventoryItemDto | null>;
	addItem(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
	): Promise<InventoryItemDto>;
	removeItem(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
	): Promise<InventoryItemDto | null>;
	/**
	 * Atomically remove exactly one unit (decrement, or delete the last one) via
	 * conditional UPDATE/DELETE. Returns true only if a unit was actually removed.
	 * Use as the gate before crediting a refund so concurrent sells of the same
	 * item can't be refunded twice (duplication exploit).
	 */
	consumeOne(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
	): Promise<boolean>;
}
