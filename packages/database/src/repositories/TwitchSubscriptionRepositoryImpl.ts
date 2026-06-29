import type { PrismaClient } from "@prisma/client";
import type {
	TwitchSubscriptionDto,
	TwitchSubscriptionRepository,
} from "@sailorclawbot/contracts";
import { toTwitchSubscriptionDto } from "./mappers.js";
import { translatePrismaError } from "./prisma-errors.js";

export class TwitchSubscriptionRepositoryImpl
	implements TwitchSubscriptionRepository
{
	public constructor(private readonly db: PrismaClient) {}

	public async findByGuild(guildId: string): Promise<TwitchSubscriptionDto[]> {
		const rows = await this.db.twitchSubscription.findMany({
			where: { guildId },
		});
		return rows.map(toTwitchSubscriptionDto);
	}

	public async findByLogin(
		guildId: string,
		twitchLogin: string,
	): Promise<TwitchSubscriptionDto | null> {
		const row = await this.db.twitchSubscription.findUnique({
			where: { guildId_twitchLogin: { guildId, twitchLogin } },
		});
		return row ? toTwitchSubscriptionDto(row) : null;
	}

	public async findAll(): Promise<TwitchSubscriptionDto[]> {
		const rows = await this.db.twitchSubscription.findMany();
		return rows.map(toTwitchSubscriptionDto);
	}

	public async create(data: {
		guildId: string;
		twitchLogin: string;
		notifyChannelId: string;
		mentionRoleId?: string;
		customMessage?: string;
	}): Promise<TwitchSubscriptionDto> {
		try {
			const row = await this.db.twitchSubscription.create({ data });
			return toTwitchSubscriptionDto(row);
		} catch (error) {
			translatePrismaError(error, "create twitch subscription");
		}
	}

	public async updateLastStreamId(
		id: string,
		lastStreamId: string,
	): Promise<void> {
		await this.db.twitchSubscription.update({
			where: { id },
			data: { lastStreamId },
		});
	}

	public async delete(id: string): Promise<void> {
		try {
			await this.db.twitchSubscription.delete({ where: { id } });
		} catch (error) {
			translatePrismaError(error, "delete twitch subscription");
		}
	}
}
