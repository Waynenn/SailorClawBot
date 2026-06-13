import type { SnowflakeId, TicketDto } from '../types/index.js';

export interface TicketRepository {
  findById(id: string): Promise<TicketDto | null>;
  listOpenByGuild(guildId: SnowflakeId): Promise<TicketDto[]>;
  create(input: Pick<TicketDto, 'guildId' | 'openedByUserId' | 'channelId'>): Promise<TicketDto>;
  close(id: string): Promise<TicketDto>;
}
