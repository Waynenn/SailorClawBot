import type { ProfileDto, ProfileRepository, SnowflakeId } from '@sailorclawbot/contracts';

export class ProfileService {
  public constructor(private readonly profiles: ProfileRepository) {}

  public async ensureProfile(guildId: SnowflakeId, userId: SnowflakeId): Promise<ProfileDto> {
    const existing = await this.profiles.findByGuildAndUser(guildId, userId);

    if (existing) {
      return existing;
    }

    return this.profiles.create({
      guildId,
      userId,
      displayName: null
    });
  }
}
