import type { StarboardEntryRepository, StarboardEntryDto } from '@sailorclawbot/contracts';
import type { Logger } from '../common/logging/Logger.js';

export interface StarboardUpsertInput {
  guildId: string;
  originalMsgId: string;
  starboardMsgId: string;
  authorId: string;
  channelId: string;
  starCount: number;
}

export type StarboardAction = 'create' | 'update' | 'delete' | 'none';

export interface StarboardResult {
  action: StarboardAction;
  entry: StarboardEntryDto | null;
}

export class StarboardService {
  public constructor(
    private readonly repo: StarboardEntryRepository,
    private readonly logger: Logger
  ) {}

  public async handleReaction(
    guildId: string,
    originalMsgId: string,
    starCount: number,
    threshold: number,
    buildEntry: () => Omit<StarboardEntryDto, 'id' | 'starCount'>
  ): Promise<StarboardResult> {
    const existing = await this.repo.findByOriginalMessage(guildId, originalMsgId);

    if (starCount >= threshold) {
      if (!existing) {
        const input = buildEntry();
        const entry = await this.repo.create({ ...input, starCount });
        this.logger.info('Starboard entry created', { guildId, originalMsgId });
        return { action: 'create', entry };
      }
      const entry = await this.repo.updateStarCount(guildId, originalMsgId, starCount);
      return { action: 'update', entry };
    }

    if (existing) {
      await this.repo.delete(guildId, originalMsgId);
      this.logger.info('Starboard entry deleted (below threshold)', { guildId, originalMsgId });
      return { action: 'delete', entry: null };
    }

    return { action: 'none', entry: null };
  }

  public async findEntry(guildId: string, originalMsgId: string): Promise<StarboardEntryDto | null> {
    return this.repo.findByOriginalMessage(guildId, originalMsgId);
  }
}
