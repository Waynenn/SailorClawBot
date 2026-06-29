import type { StaffNoteDto } from "../types/index.js";

export interface StaffNoteRepository {
	create(data: Omit<StaffNoteDto, "id" | "createdAt">): Promise<StaffNoteDto>;
	findByGuildAndUser(guildId: string, userId: string): Promise<StaffNoteDto[]>;
}
