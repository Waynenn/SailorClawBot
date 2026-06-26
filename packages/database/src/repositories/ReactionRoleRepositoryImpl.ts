import type { PrismaClient } from '@prisma/client';
import type { ReactionRoleRepository, ReactionRoleDto } from '@sailorclawbot/contracts';
import { toReactionRoleDto } from './mappers.js';

export class ReactionRoleRepositoryImpl implements ReactionRoleRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findByMessage(guildId: string, messageId: string): Promise<ReactionRoleDto[]> {
    const rows = await this.prisma.reactionRole.findMany({ where: { guildId, messageId } });
    return rows.map(toReactionRoleDto);
  }

  public async findByMessageAndEmoji(guildId: string, messageId: string, emoji: string): Promise<ReactionRoleDto | null> {
    const row = await this.prisma.reactionRole.findUnique({
      where: { guildId_messageId_emoji: { guildId, messageId, emoji } },
    });
    return row ? toReactionRoleDto(row) : null;
  }

  public async create(input: Omit<ReactionRoleDto, 'id'>): Promise<ReactionRoleDto> {
    const row = await this.prisma.reactionRole.create({ data: input });
    return toReactionRoleDto(row);
  }

  public async delete(id: string): Promise<void> {
    await this.prisma.reactionRole.delete({ where: { id } });
  }

  public async deleteByMessageAndEmoji(guildId: string, messageId: string, emoji: string): Promise<void> {
    await this.prisma.reactionRole.deleteMany({ where: { guildId, messageId, emoji } });
  }
}
