import type { NoXpTargetDto } from "../types/index.js";

export interface NoXpTargetRepository {
	findByGuild(guildId: string): Promise<NoXpTargetDto[]>;
	isExcluded(guildId: string, targetId: string): Promise<boolean>;
	add(data: {
		guildId: string;
		targetId: string;
		targetType: "channel" | "role";
	}): Promise<NoXpTargetDto>;
	delete(id: string): Promise<void>;
}
