import type { WarningDto, SnowflakeId } from '../types/index.js';

export interface WarningRepository {
  findById(id: string): Promise<WarningDto | null>;
  findByGuildAndUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<WarningDto[]>;
  create(input: Omit<WarningDto, 'id' | 'createdAt'>): Promise<WarningDto>;
  count(guildId: SnowflakeId, userId: SnowflakeId): Promise<number>;
}
