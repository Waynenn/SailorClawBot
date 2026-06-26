import type { GiveawayDto } from '../types/index.js';

export interface GiveawayRepository {
  findById(id: string): Promise<GiveawayDto | null>;
  findActive(guildId: string): Promise<GiveawayDto[]>;
  findExpired(): Promise<GiveawayDto[]>;
  create(input: Omit<GiveawayDto, 'id' | 'endedAt' | 'participants' | 'winners'>): Promise<GiveawayDto>;
  setMessageId(id: string, messageId: string): Promise<GiveawayDto>;
  addParticipant(id: string, userId: string): Promise<GiveawayDto>;
  end(id: string, winners: string[]): Promise<GiveawayDto>;
}
