import type { FamilyRepository, FamilyDto, SnowflakeId } from '@sailorclawbot/contracts';
import type { Logger } from '../common/logging/Logger.js';

export class FamilyService {
  public constructor(
    private readonly families: FamilyRepository,
    private readonly logger: Logger
  ) {}

  public async createFamily(
    guildId: SnowflakeId,
    name: string,
    ownerUserId: SnowflakeId
  ): Promise<FamilyDto> {
    const family = await this.families.create({ guildId, name, ownerUserId });
    this.logger.info('Family created', { guildId, name, ownerUserId, familyId: family.id });
    return family;
  }

  public async listFamilies(guildId: SnowflakeId): Promise<FamilyDto[]> {
    return this.families.listByGuild(guildId);
  }

  public async findFamily(id: string): Promise<FamilyDto | null> {
    return this.families.findById(id);
  }
}
