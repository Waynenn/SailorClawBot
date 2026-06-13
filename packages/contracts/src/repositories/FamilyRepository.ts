import type { FamilyDto, SnowflakeId } from '../types/index.js';

export interface FamilyRepository {
  findById(id: string): Promise<FamilyDto | null>;
  listByGuild(guildId: SnowflakeId): Promise<FamilyDto[]>;
  create(input: Pick<FamilyDto, 'guildId' | 'name' | 'ownerUserId'>): Promise<FamilyDto>;
}
