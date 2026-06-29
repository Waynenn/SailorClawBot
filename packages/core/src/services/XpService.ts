import type {
	ProfileDto,
	ProfileRepository,
	SnowflakeId,
} from "@sailorclawbot/contracts";
import { EventNames } from "@sailorclawbot/contracts";
import { NotFoundError } from "../common/errors/NotFoundError.js";
import { ValidationError } from "../common/errors/ValidationError.js";
import type { EventBus } from "../common/events/EventBus.js";
import type { Logger } from "../common/logging/Logger.js";

export interface XpGrantResult {
	leveled: boolean;
	newLevel: number;
	profile: ProfileDto;
}

export interface LeaderboardEntry {
	profile: ProfileDto;
	rank: number;
}

export interface LeaderboardResult {
	entries: LeaderboardEntry[];
	total: number;
}

export class XpService {
	public constructor(
		private readonly profiles: ProfileRepository,
		private readonly bus: EventBus,
		private readonly logger: Logger,
	) {}

	public xpNeededForLevel(level: number): number {
		return 5 * level * level + 50 * level + 100;
	}

	public async grantXp(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		amount: number,
	): Promise<XpGrantResult> {
		if (amount <= 0)
			throw new ValidationError("XP amount must be positive", "amount");

		const profile = await this.profiles.findByGuildAndUser(guildId, userId);
		if (!profile)
			throw new NotFoundError(
				`Profile not found: ${guildId}:${userId}`,
				"Profile",
			);

		const newTotalXp = profile.totalXp + amount;
		let newLevel = profile.level;
		let newXp = profile.xp + amount;
		let leveled = false;

		while (newXp >= this.xpNeededForLevel(newLevel)) {
			newXp -= this.xpNeededForLevel(newLevel);
			newLevel++;
			leveled = true;
		}

		const updated = await this.profiles.updateXp(guildId, userId, {
			xp: newXp,
			level: newLevel,
			totalXp: newTotalXp,
		});

		await this.bus.publish({
			name: EventNames.XpGained,
			payload: { guildId, userId, amount },
			occurredAt: new Date(),
		});

		if (leveled) {
			this.logger.info("Level up", { guildId, userId, newLevel });
			await this.bus.publish({
				name: EventNames.LevelUp,
				payload: { guildId, userId, newLevel },
				occurredAt: new Date(),
			});
		}

		return { leveled, newLevel, profile: updated };
	}

	public async setXp(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		totalXp: number,
	): Promise<ProfileDto> {
		if (totalXp < 0)
			throw new ValidationError("Total XP cannot be negative", "totalXp");

		const profile = await this.profiles.findByGuildAndUser(guildId, userId);
		if (!profile)
			throw new NotFoundError(
				`Profile not found: ${guildId}:${userId}`,
				"Profile",
			);

		let level = 0;
		let remaining = totalXp;
		while (remaining >= this.xpNeededForLevel(level)) {
			remaining -= this.xpNeededForLevel(level);
			level++;
		}

		return this.profiles.updateXp(guildId, userId, {
			xp: remaining,
			level,
			totalXp,
		});
	}

	public async getLeaderboard(
		guildId: SnowflakeId,
		page: number,
		limit: number,
	): Promise<LeaderboardResult> {
		const skip = (page - 1) * limit;
		const [profileList, total] = await Promise.all([
			this.profiles.findLeaderboard(guildId, skip, limit),
			this.profiles.countByGuild(guildId),
		]);
		return {
			entries: profileList.map((p, i) => ({ profile: p, rank: skip + i + 1 })),
			total,
		};
	}

	public async getRank(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<number> {
		const profile = await this.profiles.findByGuildAndUser(guildId, userId);
		if (!profile)
			throw new NotFoundError(
				`Profile not found: ${guildId}:${userId}`,
				"Profile",
			);
		return this.profiles.findRank(guildId, userId);
	}
}
