import type { XpMultiplierDto } from '../types/index.js';

export interface XpMultiplierRepository {
  findByGuild(guildId: string): Promise<XpMultiplierDto[]>;
  findByTarget(guildId: string, targetId: string, targetType: 'channel' | 'role'): Promise<XpMultiplierDto | null>;
  upsert(data: { guildId: string; targetId: string; targetType: 'channel' | 'role'; multiplier: number }): Promise<XpMultiplierDto>;
  delete(id: string): Promise<void>;
}
