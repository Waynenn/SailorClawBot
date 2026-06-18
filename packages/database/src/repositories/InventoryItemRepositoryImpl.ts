import type { PrismaClient } from '@prisma/client';
import type { InventoryItemRepository, InventoryItemDto, SnowflakeId } from '@sailorclawbot/contracts';
import { translatePrismaError } from './prisma-errors.js';
import { toInventoryItemDto } from './mappers.js';

export class InventoryItemRepositoryImpl implements InventoryItemRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findByUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<InventoryItemDto[]> {
    const rows = await this.db.inventoryItem.findMany({
      where: { guildId, userId },
      include: { item: true },
      orderBy: { acquiredAt: 'asc' },
    });
    return rows.map(toInventoryItemDto);
  }

  public async findByUserAndItem(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    itemId: string
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
    itemId: string
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
      translatePrismaError(error, 'add inventory item');
    }
  }

  public async removeItem(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    itemId: string
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
      translatePrismaError(error, 'remove inventory item');
    }
  }
}
