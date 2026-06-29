import type { StarboardEntryDto } from "../types/index.js";

export interface StarboardEntryRepository {
	findByOriginalMessage(
		guildId: string,
		originalMsgId: string,
	): Promise<StarboardEntryDto | null>;
	create(input: Omit<StarboardEntryDto, "id">): Promise<StarboardEntryDto>;
	updateStarCount(
		guildId: string,
		originalMsgId: string,
		starCount: number,
	): Promise<StarboardEntryDto>;
	delete(guildId: string, originalMsgId: string): Promise<void>;
}
