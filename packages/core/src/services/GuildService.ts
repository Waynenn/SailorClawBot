import type {
  GuildRepository,
  GuildMemberRepository,
  GuildDto,
  GuildMemberDto,
  SnowflakeId,
} from '@sailorclawbot/contracts';
import { EventNames } from '@sailorclawbot/contracts';
import type { EventBus } from '../common/events/EventBus.js';
import type { Logger } from '../common/logging/Logger.js';

export class GuildService {
  public constructor(
    private readonly guilds: GuildRepository,
    private readonly members: GuildMemberRepository,
    private readonly bus: EventBus,
    private readonly logger: Logger
  ) {}

  public async registerGuild(id: SnowflakeId, name: string): Promise<GuildDto> {
    const guild = await this.guilds.upsert({ id, name });
    this.logger.info('Guild registered', { id, name });
    await this.bus.publish({
      name: EventNames.GuildRegistered,
      payload: { id, name },
      occurredAt: new Date(),
    });
    return guild;
  }

  public async ensureMember(guildId: SnowflakeId, userId: SnowflakeId): Promise<GuildMemberDto> {
    return this.members.upsert({ guildId, userId, joinedAt: new Date() });
  }

  public async findGuild(id: SnowflakeId): Promise<GuildDto | null> {
    return this.guilds.findById(id);
  }
}
