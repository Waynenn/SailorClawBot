import type { TwitchSubscriptionDto } from "../types/index.js";

export interface TwitchSubscriptionRepository {
	findByGuild(guildId: string): Promise<TwitchSubscriptionDto[]>;
	findByLogin(
		guildId: string,
		twitchLogin: string,
	): Promise<TwitchSubscriptionDto | null>;
	findAll(): Promise<TwitchSubscriptionDto[]>;
	create(data: {
		guildId: string;
		twitchLogin: string;
		notifyChannelId: string;
		mentionRoleId?: string;
		customMessage?: string;
	}): Promise<TwitchSubscriptionDto>;
	updateLastStreamId(id: string, lastStreamId: string): Promise<void>;
	delete(id: string): Promise<void>;
}
