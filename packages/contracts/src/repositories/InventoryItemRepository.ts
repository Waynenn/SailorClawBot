import type { InventoryItemDto, SnowflakeId } from '../types/index.js';

export interface InventoryItemRepository {
  findByUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<InventoryItemDto[]>;
  findByUserAndItem(guildId: SnowflakeId, userId: SnowflakeId, itemId: string): Promise<InventoryItemDto | null>;
  addItem(guildId: SnowflakeId, userId: SnowflakeId, itemId: string): Promise<InventoryItemDto>;
  removeItem(guildId: SnowflakeId, userId: SnowflakeId, itemId: string): Promise<InventoryItemDto | null>;
}
