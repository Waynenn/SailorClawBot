import type { ProfileDto, SnowflakeId } from '../types/index.js';

export interface ProfileRepository {
  findByGuildAndUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<ProfileDto | null>;
  create(input: Pick<ProfileDto, 'guildId' | 'userId' | 'displayName'>): Promise<ProfileDto>;
}
