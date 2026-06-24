import type { PrismaClient } from '@prisma/client';
import type { StaffNoteRepository, StaffNoteDto } from '@sailorclawbot/contracts';

export class StaffNoteRepositoryImpl implements StaffNoteRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async create(data: Omit<StaffNoteDto, 'id' | 'createdAt'>): Promise<StaffNoteDto> {
    return this.prisma.staffNote.create({ data });
  }

  public async findByGuildAndUser(guildId: string, userId: string): Promise<StaffNoteDto[]> {
    return this.prisma.staffNote.findMany({
      where: { guildId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
