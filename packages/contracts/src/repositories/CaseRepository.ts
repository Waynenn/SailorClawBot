import type { CaseDto, SnowflakeId } from "../types/index.js";

export interface CaseRepository {
	findById(id: string): Promise<CaseDto | null>;
	findByGuildAndNumber(
		guildId: SnowflakeId,
		caseNumber: number,
	): Promise<CaseDto | null>;
	listByGuild(
		guildId: SnowflakeId,
		limit?: number,
		offset?: number,
	): Promise<CaseDto[]>;
	listByUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		limit?: number,
	): Promise<CaseDto[]>;
	/**
	 * Atomically allocates the next sequential case number for a guild.
	 * This is the authoritative case-number source for all moderation actions.
	 */
	getNextCaseNumber(guildId: SnowflakeId): Promise<number>;
	create(
		input: Omit<CaseDto, "id" | "createdAt" | "updatedAt">,
	): Promise<CaseDto>;
	update(id: string, changes: Partial<CaseDto>): Promise<CaseDto>;
	delete(id: string): Promise<void>;
}
