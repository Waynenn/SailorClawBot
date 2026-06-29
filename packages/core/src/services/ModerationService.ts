import type {
	BanDto,
	BanRepository,
	CaseDto,
	CaseRepository,
	MuteDto,
	MuteRepository,
	PermissionRepository,
	SnowflakeId,
	StaffNoteDto,
	StaffNoteRepository,
	WarningDto,
	WarningRepository,
} from "@sailorclawbot/contracts";
import { ConflictError } from "../common/errors/ConflictError.js";
import { ValidationError } from "../common/errors/ValidationError.js";
import type { EventBus } from "../common/events/EventBus.js";
import type { Logger } from "../common/logging/Logger.js";

const AUTO_MUTE_THRESHOLD = 3;
const AUTO_MUTE_DURATION = 1440;

/**
 * ModerationService orchestrates all moderation operations.
 *
 * Permission checks are the responsibility of the caller (bot command layer).
 * This service focuses purely on business logic and persistence.
 */
export class ModerationService {
	public constructor(
		private readonly warnings: WarningRepository,
		private readonly mutes: MuteRepository,
		private readonly bans: BanRepository,
		private readonly cases: CaseRepository,
		private readonly permissions: PermissionRepository,
		private readonly eventBus: EventBus,
		private readonly logger: Logger,
		private readonly staffNotes?: StaffNoteRepository,
	) {}

	// ==========================================================================
	// WARNINGS
	// ==========================================================================

	public async warnUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		reason: string,
		moderatorId: SnowflakeId,
	): Promise<WarningDto> {
		this.requireId(guildId, "guildId");
		this.requireId(userId, "userId");
		this.requireId(moderatorId, "moderatorId");
		if (!reason || reason.trim().length === 0) {
			throw new ValidationError("Reason required", "reason");
		}
		if (userId === moderatorId) {
			throw new ValidationError("Cannot warn yourself", "userId");
		}

		const caseNumber = await this.cases.getNextCaseNumber(guildId);

		const warning = await this.warnings.create({
			guildId,
			userId,
			reason,
			moderatorId,
			caseNumber,
		});

		await this.cases.create({
			guildId,
			caseNumber,
			type: "warning",
			userId,
			moderatorId,
			action: warning.id,
			reason,
			isAppealed: false,
			metadata: { warningId: warning.id },
		});

		const warningCount = await this.warnings.count(guildId, userId);
		let autoMuted = false;
		if (warningCount === AUTO_MUTE_THRESHOLD) {
			autoMuted = await this.tryAutoMute(
				guildId,
				userId,
				moderatorId,
				warningCount,
			);
		}

		await this.eventBus.publish({
			name: "moderation.warned",
			payload: {
				guildId,
				userId,
				moderatorId,
				reason,
				caseNumber,
				warningCount,
				autoMuted,
			},
			occurredAt: new Date(),
		});
		this.logger.info("User warned", {
			guildId,
			userId,
			moderatorId,
			caseNumber,
		});

		return warning;
	}

	// ==========================================================================
	// MUTES
	// ==========================================================================

	public async muteUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		durationMinutes: number,
		moderatorId: SnowflakeId,
		reason?: string,
	): Promise<MuteDto> {
		this.requireId(guildId, "guildId");
		this.requireId(userId, "userId");
		this.requireId(moderatorId, "moderatorId");
		if (userId === moderatorId)
			throw new ValidationError("Cannot mute yourself", "userId");
		if (durationMinutes <= 0) {
			throw new ValidationError("Duration must be positive", "durationMinutes");
		}

		const existing = await this.mutes.findByGuildAndUser(guildId, userId);
		if (existing?.isActive) {
			const until =
				existing.expiresAt instanceof Date
					? existing.expiresAt.toISOString()
					: String(existing.expiresAt);
			throw new ConflictError(
				`User is already muted until ${until}`,
				"USER_ALREADY_MUTED",
			);
		}

		const expiresAt = new Date(Date.now() + durationMinutes * 60_000);
		const caseNumber = await this.cases.getNextCaseNumber(guildId);

		const mute = await this.mutes.create({
			guildId,
			userId,
			reason,
			moderatorId,
			caseNumber,
			duration: durationMinutes,
			expiresAt,
			isActive: true,
		});

		await this.cases.create({
			guildId,
			caseNumber,
			type: "mute",
			userId,
			moderatorId,
			action: mute.id,
			reason,
			isAppealed: false,
			metadata: {
				muteId: mute.id,
				durationMinutes,
				expiresAt: expiresAt.toISOString(),
			},
		});

		await this.eventBus.publish({
			name: "moderation.muted",
			payload: {
				guildId,
				userId,
				moderatorId,
				reason,
				caseNumber,
				durationMinutes,
				expiresAt,
			},
			occurredAt: new Date(),
		});
		this.logger.info("User muted", {
			guildId,
			userId,
			moderatorId,
			caseNumber,
			durationMinutes,
		});

		return mute;
	}

	public async unmuteUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		moderatorId: SnowflakeId,
	): Promise<void> {
		this.requireId(guildId, "guildId");
		this.requireId(userId, "userId");
		this.requireId(moderatorId, "moderatorId");

		const mute = await this.mutes.findByGuildAndUser(guildId, userId);
		if (!mute || !mute.isActive) {
			throw new ConflictError("User is not currently muted", "NOT_MUTED");
		}

		await this.mutes.deactivate(mute.id);

		await this.eventBus.publish({
			name: "moderation.unmuted",
			payload: { guildId, userId, moderatorId, muteId: mute.id },
			occurredAt: new Date(),
		});
		this.logger.info("User unmuted", { guildId, userId, moderatorId });
	}

	// ==========================================================================
	// BANS
	// ==========================================================================

	public async banUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		reason: string,
		moderatorId: SnowflakeId,
		durationDays?: number,
	): Promise<BanDto> {
		this.requireId(guildId, "guildId");
		this.requireId(userId, "userId");
		this.requireId(moderatorId, "moderatorId");
		if (userId === moderatorId)
			throw new ValidationError("Cannot ban yourself", "userId");
		if (!reason || reason.trim().length === 0) {
			throw new ValidationError("Reason required", "reason");
		}
		if (durationDays !== undefined && durationDays <= 0) {
			throw new ValidationError("Duration must be positive", "durationDays");
		}

		const existing = await this.bans.findByGuildAndUser(guildId, userId);
		if (existing?.isActive) {
			throw new ConflictError("User is already banned", "USER_ALREADY_BANNED");
		}

		const expiresAt =
			durationDays !== undefined
				? new Date(Date.now() + durationDays * 24 * 60 * 60_000)
				: undefined;
		const caseNumber = await this.cases.getNextCaseNumber(guildId);

		const ban = await this.bans.create({
			guildId,
			userId,
			reason,
			moderatorId,
			caseNumber,
			expiresAt,
			isActive: true,
		});

		await this.cases.create({
			guildId,
			caseNumber,
			type: "ban",
			userId,
			moderatorId,
			action: ban.id,
			reason,
			isAppealed: false,
			metadata: {
				banId: ban.id,
				temporary: durationDays !== undefined,
				expiresAt: expiresAt?.toISOString(),
			},
		});

		await this.eventBus.publish({
			name: "moderation.banned",
			payload: {
				guildId,
				userId,
				moderatorId,
				reason,
				caseNumber,
				temporary: durationDays !== undefined,
				expiresAt,
			},
			occurredAt: new Date(),
		});
		this.logger.info("User banned", {
			guildId,
			userId,
			moderatorId,
			caseNumber,
		});

		return ban;
	}

	public async unbanUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		moderatorId: SnowflakeId,
	): Promise<void> {
		this.requireId(guildId, "guildId");
		this.requireId(userId, "userId");
		this.requireId(moderatorId, "moderatorId");

		const ban = await this.bans.findByGuildAndUser(guildId, userId);
		if (!ban || !ban.isActive) {
			throw new ConflictError("User is not currently banned", "NOT_BANNED");
		}

		await this.bans.deactivate(ban.id);

		await this.eventBus.publish({
			name: "moderation.unbanned",
			payload: { guildId, userId, moderatorId, banId: ban.id },
			occurredAt: new Date(),
		});
		this.logger.info("User unbanned", { guildId, userId, moderatorId });
	}

	// ==========================================================================
	// KICK
	// ==========================================================================

	public async kickUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		reason: string,
		moderatorId: SnowflakeId,
	): Promise<{ caseNumber: number }> {
		this.requireId(guildId, "guildId");
		this.requireId(userId, "userId");
		this.requireId(moderatorId, "moderatorId");
		if (!reason || reason.trim().length === 0) {
			throw new ValidationError("Reason required", "reason");
		}
		if (userId === moderatorId) {
			throw new ValidationError("Cannot kick yourself", "userId");
		}

		const caseNumber = await this.cases.getNextCaseNumber(guildId);

		await this.cases.create({
			guildId,
			caseNumber,
			type: "kick",
			userId,
			moderatorId,
			action: `kick:${caseNumber}`,
			reason,
			isAppealed: false,
			metadata: undefined,
		});

		await this.eventBus.publish({
			name: "moderation.kicked",
			payload: { guildId, userId, moderatorId, reason, caseNumber },
			occurredAt: new Date(),
		});
		this.logger.info("User kicked", {
			guildId,
			userId,
			moderatorId,
			caseNumber,
		});

		return { caseNumber };
	}

	// ==========================================================================
	// CASES
	// ==========================================================================

	public async listCases(
		guildId: SnowflakeId,
		userId?: SnowflakeId,
		limit = 10,
	): Promise<CaseDto[]> {
		this.requireId(guildId, "guildId");
		if (userId) {
			return this.cases.listByUser(guildId, userId, limit);
		}
		return this.cases.listByGuild(guildId, limit);
	}

	// ==========================================================================
	// STAFF NOTES
	// ==========================================================================

	public async addNote(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		authorId: SnowflakeId,
		content: string,
	): Promise<StaffNoteDto> {
		this.requireId(guildId, "guildId");
		this.requireId(userId, "userId");
		this.requireId(authorId, "authorId");
		if (!content || content.trim().length === 0) {
			throw new ValidationError("Note content required", "content");
		}
		if (!this.staffNotes)
			throw new ValidationError(
				"StaffNoteRepository not configured",
				"staffNotes",
			);
		return this.staffNotes.create({ guildId, userId, authorId, content });
	}

	public async getNotes(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<StaffNoteDto[]> {
		this.requireId(guildId, "guildId");
		this.requireId(userId, "userId");
		if (!this.staffNotes) return [];
		return this.staffNotes.findByGuildAndUser(guildId, userId);
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	private requireId(value: string, field: string): void {
		if (!value || value.trim().length === 0) {
			throw new ValidationError(`${field} required`, field);
		}
	}

	private async tryAutoMute(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		moderatorId: SnowflakeId,
		warningCount: number,
	): Promise<boolean> {
		this.logger.info("Auto-muting user after warning threshold", {
			guildId,
			userId,
			warningCount,
		});
		try {
			await this.muteUser(
				guildId,
				userId,
				AUTO_MUTE_DURATION,
				moderatorId,
				`Auto-mute: ${warningCount}+ warnings`,
			);
			return true;
		} catch (error) {
			if (error instanceof ConflictError) return false;
			throw error;
		}
	}
}
