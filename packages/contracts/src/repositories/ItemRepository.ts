import type { ItemDto, CreateItemDto, SnowflakeId } from '../types/index.js';

export interface ItemRepository {
  findById(id: string): Promise<ItemDto | null>;
  findByGuild(guildId: SnowflakeId): Promise<ItemDto[]>;
  create(data: CreateItemDto): Promise<ItemDto>;
  update(id: string, data: Partial<Pick<ItemDto, 'name' | 'description' | 'price' | 'emoji' | 'type' | 'effect' | 'stock'>>): Promise<ItemDto>;
  delete(id: string): Promise<void>;
  decrementStockIfAvailable(id: string): Promise<boolean>;
}
