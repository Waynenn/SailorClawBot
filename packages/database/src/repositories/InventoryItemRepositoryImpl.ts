import type { PrismaClient } from "@prisma/client";
import type {
	InventoryItemDto,
	InventoryItemRepository,
	SnowflakeId,
} from "@sailorclawbot/contracts";
import { toInventoryItemDto } from "./mappers.js";
import { translatePrismaError } from "./prisma-errors.js";

export class InventoryItemRepositoryImpl implements InventoryItemRepository {
	public constructor(private readonly db: PrismaClient) {}

	public async findByUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<InventoryItemDto[]> {
		const rows = await this.db.inventoryItem.findMany({
			where: { guildId, userId },
			include: { item: true },
			orderBy: { acquiredAt: "asc" },
		});
		return rows.map(toInventoryItemDto);
	}

	public async findByUserAndItem(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
	): Promise<InventoryItemDto | null> {
		const row = await this.db.inventoryItem.findUnique({
			where: { guildId_userId_itemId: { guildId, userId, itemId } },
			include: { item: true },
		});
		return row ? toInventoryItemDto(row) : null;
	}

	public async addItem(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
	): Promise<InventoryItemDto> {
		try {
			const row = await this.db.inventoryItem.upsert({
				where: { guildId_userId_itemId: { guildId, userId, itemId } },
				create: { guildId, userId, itemId, quantity: 1 },
				update: { quantity: { increment: 1 } },
				include: { item: true },
			});
			return toInventoryItemDto(row);
		} catch (error) {
			translatePrismaError(error, "add inventory item");
		}
	}

	public async removeItem(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
	): Promise<InventoryItemDto | null> {
		const existing = await this.db.inventoryItem.findUnique({
			where: { guildId_userId_itemId: { guildId, userId, itemId } },
			include: { item: true },
		});
		if (!existing) return null;

		try {
			if (existing.quantity <= 1) {
				await this.db.inventoryItem.delete({
					where: { guildId_userId_itemId: { guildId, userId, itemId } },
				});
				return null;
			}
			const row = await this.db.inventoryItem.update({
				where: { guildId_userId_itemId: { guildId, userId, itemId } },
				data: { quantity: { decrement: 1 } },
				include: { item: true },
			});
			return toInventoryItemDto(row);
		} catch (error) {
			translatePrismaError(error, "remove inventory item");
		}
	}

	public async consumeOne(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		itemId: string,
	): Promise<boolean> {
		try {
			// Row-locked conditional UPDATE: decrement only while more than one remains.
			const decremented = await this.db.inventoryItem.updateMany({
				where: { guildId, userId, itemId, quantity: { gt: 1 } },
				data: { quantity: { decrement: 1 } },
			});
			if (decremented.count > 0) return true;
			// Otherwise delete the single remaining unit, atomically.
			const deleted = await this.db.inventoryItem.deleteMany({
				where: { guildId, userId, itemId, quantity: 1 },
			});
			return deleted.count > 0;
		} catch (error) {
			translatePrismaError(error, "consume inventory item");
		}
	}
}
