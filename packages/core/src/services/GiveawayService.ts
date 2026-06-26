import type { GiveawayRepository, GiveawayDto } from '@sailorclawbot/contracts';
import type { Logger } from '../common/logging/Logger.js';
import { NotFoundError } from '../common/errors/NotFoundError.js';
import { ValidationError } from '../common/errors/ValidationError.js';
import { ConflictError } from '../common/errors/ConflictError.js';

export interface CreateGiveawayInput {
  guildId: string;
  channelId: string;
  prize: string;
  winnersCount: number;
  durationMs: number;
  hostId: string;
}

export class GiveawayService {
  public constructor(
    private readonly repo: GiveawayRepository,
    private readonly logger: Logger
  ) {}

  public async create(input: CreateGiveawayInput): Promise<GiveawayDto> {
    if (input.winnersCount < 1) throw new ValidationError('Winners count must be at least 1', 'winnersCount');
    if (input.durationMs < 60_000) throw new ValidationError('Duration must be at least 1 minute', 'durationMs');
    const endsAt = new Date(Date.now() + input.durationMs);
    return this.repo.create({
      guildId: input.guildId,
      channelId: input.channelId,
      messageId: null,
      prize: input.prize,
      winnersCount: input.winnersCount,
      endsAt,
      hostId: input.hostId,
    });
  }

  public async join(id: string, userId: string): Promise<GiveawayDto> {
    const giveaway = await this.repo.findById(id);
    if (!giveaway) throw new NotFoundError(`Giveaway ${id} not found`, 'Giveaway');
    if (giveaway.endedAt) throw new ValidationError('This giveaway has already ended', 'id');
    if (giveaway.endsAt < new Date()) throw new ValidationError('This giveaway has already ended', 'id');
    if (giveaway.participants.includes(userId)) throw new ConflictError('Already entered this giveaway', 'userId');
    return this.repo.addParticipant(id, userId);
  }

  public async end(id: string): Promise<{ giveaway: GiveawayDto; winners: string[] }> {
    const giveaway = await this.repo.findById(id);
    if (!giveaway) throw new NotFoundError(`Giveaway ${id} not found`, 'Giveaway');
    if (giveaway.endedAt) throw new ValidationError('Already ended', 'id');
    const winners = this.pickWinners(giveaway.participants, giveaway.winnersCount);
    const updated = await this.repo.end(id, winners);
    this.logger.info('Giveaway ended', { id, winners });
    return { giveaway: updated, winners };
  }

  public async reroll(id: string): Promise<{ giveaway: GiveawayDto; winners: string[] }> {
    const giveaway = await this.repo.findById(id);
    if (!giveaway) throw new NotFoundError(`Giveaway ${id} not found`, 'Giveaway');
    if (!giveaway.endedAt) throw new ValidationError('Giveaway has not ended yet', 'id');
    const winners = this.pickWinners(giveaway.participants, giveaway.winnersCount);
    const updated = await this.repo.end(id, winners);
    return { giveaway: updated, winners };
  }

  public async listActive(guildId: string): Promise<GiveawayDto[]> {
    return this.repo.findActive(guildId);
  }

  private pickWinners(participants: string[], count: number): string[] {
    if (participants.length === 0) return [];
    const pool = [...participants];
    const winners: string[] = [];
    const take = Math.min(count, pool.length);
    for (let i = 0; i < take; i++) {
      const idx = Math.floor(Math.random() * (pool.length - i));
      winners.push(pool[idx]);
      pool[idx] = pool[pool.length - 1 - i];
    }
    return winners;
  }
}
