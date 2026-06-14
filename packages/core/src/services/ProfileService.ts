import type { ProfileDto, ProfileRepository, SnowflakeId } from '@sailorclawbot/contracts';
import { EventNames } from '@sailorclawbot/contracts';
import type { EventBus } from '../common/events/EventBus.js';
import type { Logger } from '../common/logging/Logger.js';
import { ValidationError } from '../common/errors/ValidationError.js';
import { NotFoundError } from '../common/errors/NotFoundError.js';

export class ProfileService {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly bus: EventBus,
    private readonly logger: Logger
  ) {}

  public async ensureProfile(guildId: SnowflakeId, userId: SnowflakeId): Promise<ProfileDto> {
    const existing = await this.profiles.findByGuildAndUser(guildId, userId);

    if (existing) {
      return existing;
    }

    const created = await this.profiles.create({ guildId, userId, displayName: null });
    this.logger.info('Profile created', { guildId, userId });
    await this.bus.publish({
      name: EventNames.ProfileCreated,
      payload: { guildId, userId },
      occurredAt: new Date(),
    });
    return created;
  }

  public async getProfile(guildId: SnowflakeId, userId: SnowflakeId): Promise<ProfileDto> {
    const profile = await this.profiles.findByGuildAndUser(guildId, userId);
    if (!profile) {
      throw new NotFoundError('Profile', `${guildId}:${userId}`);
    }
    return profile;
  }

  public async updateDisplayName(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    displayName: string | null
  ): Promise<ProfileDto> {
    if (displayName !== null && displayName.trim().length === 0) {
      throw new ValidationError('Display name cannot be blank', 'displayName');
    }

    const updated = await this.profiles.update(guildId, userId, { displayName });
    this.logger.info('Profile updated', { guildId, userId, displayName });
    await this.bus.publish({
      name: EventNames.ProfileUpdated,
      payload: { guildId, userId, displayName },
      occurredAt: new Date(),
    });
    return updated;
  }
}
