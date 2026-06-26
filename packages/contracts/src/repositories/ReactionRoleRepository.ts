import type { ReactionRoleDto } from '../types/index.js';

export interface ReactionRoleRepository {
  findByMessage(guildId: string, messageId: string): Promise<ReactionRoleDto[]>;
  findByMessageAndEmoji(guildId: string, messageId: string, emoji: string): Promise<ReactionRoleDto | null>;
  create(input: Omit<ReactionRoleDto, 'id'>): Promise<ReactionRoleDto>;
  delete(id: string): Promise<void>;
  deleteByMessageAndEmoji(guildId: string, messageId: string, emoji: string): Promise<void>;
}
