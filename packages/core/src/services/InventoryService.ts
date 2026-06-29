import type {
	InventoryItemDto,
	InventoryItemRepository,
	ItemDto,
	SnowflakeId,
} from "@sailorclawbot/contracts";
import { NotFoundError } from "../common/errors/NotFoundError.js";
import type { Logger } from "../common/logging/Logger.js";

export interface UseItemResult {
	item: ItemDto;
	remainingQuantity: number;
}

export class InventoryService {
	public constructor(
		private readonly inventory: InventoryItemRepository,
		private readonly logger: Logger,
	) {}

	public async listInventory(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<InventoryItemDto[]> {
		return this.inventory.findByUser(guildId, userId);
	}

	public async useItem(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
	): Promise<UseItemResult> {
		const invItem = await this.inventory.findByUserAndItem(
			guildId,
			userId,
			itemId,
		);
		if (!invItem)
			throw new NotFoundError(
				"InventoryItem",
				`${guildId}:${userId}:${itemId}`,
			);
		if (!invItem.item) throw new NotFoundError("Item", itemId);

		const remaining = await this.inventory.removeItem(guildId, userId, itemId);
		const remainingQuantity = remaining?.quantity ?? 0;

		this.logger.info("Item used", {
			guildId,
			userId,
			itemId,
			remainingQuantity,
		});
		return { item: invItem.item, remainingQuantity };
	}
}
