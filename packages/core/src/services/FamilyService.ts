import type {
	FamilyDto,
	FamilyJoinRequestDto,
	FamilyLeaderboardEntry,
	FamilyMemberDto,
	FamilyRepository,
	GuildSettingsRepository,
	SnowflakeId,
	WalletRepository,
} from "@sailorclawbot/contracts";
import { ConflictError } from "../common/errors/ConflictError.js";
import { NotFoundError } from "../common/errors/NotFoundError.js";
import { PermissionDeniedError } from "../common/errors/PermissionDeniedError.js";
import { ValidationError } from "../common/errors/ValidationError.js";
import type { Logger } from "../common/logging/Logger.js";

export const FAMILY_NAME_MIN = 2;
export const FAMILY_NAME_MAX = 32;
export const FAMILY_MAX_MEMBERS = 25;
export const FAMILY_LEADERBOARD_LIMIT = 10;
const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

export interface FamilyWithMembers {
	family: FamilyDto;
	members: FamilyMemberDto[];
}

/** Effective per-guild family settings, with hard fallbacks when no row exists. */
interface ResolvedFamilySettings {
	creationEnabled: boolean;
	maxFamilies: number | null;
	maxMembers: number;
	requireApproval: boolean;
	creationMode: string;
	creationCost: bigint;
	nameChangeCost: bigint;
}

export interface JoinResult {
	status: "joined" | "pending";
	member?: FamilyMemberDto;
	request?: FamilyJoinRequestDto;
}

export class FamilyService {
	private readonly leaderboardCache = new Map<
		string,
		{ entries: FamilyLeaderboardEntry[]; expiresAt: number }
	>();

	public constructor(
		private readonly families: FamilyRepository,
		private readonly settings: GuildSettingsRepository,
		private readonly wallets: WalletRepository,
		private readonly logger: Logger,
	) {}

	// ── Reads ────────────────────────────────────────────────────────────────

	public async listFamilies(guildId: SnowflakeId): Promise<FamilyDto[]> {
		return this.families.listByGuild(guildId);
	}

	public async findFamily(id: string): Promise<FamilyDto | null> {
		return this.families.findById(id);
	}

	public async findFamilyByName(
		guildId: SnowflakeId,
		name: string,
	): Promise<FamilyDto | null> {
		return this.families.findByName(guildId, name.trim());
	}

	public async getFamilyInfo(familyId: string): Promise<FamilyWithMembers> {
		const family = await this.families.findById(familyId);
		if (!family) {
			throw new NotFoundError("Family not found", "Family");
		}
		const members = await this.families.listMembers(familyId);
		return { family, members };
	}

	public async getMyFamily(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<FamilyWithMembers | null> {
		const membership = await this.families.findMemberByUser(guildId, userId);
		if (!membership) return null;
		const family = await this.families.findById(membership.familyId);
		if (!family) return null;
		const members = await this.families.listMembers(family.id);
		return { family, members };
	}

	public async leaderboard(
		guildId: SnowflakeId,
		limit: number = FAMILY_LEADERBOARD_LIMIT,
	): Promise<FamilyLeaderboardEntry[]> {
		const cached = this.leaderboardCache.get(guildId);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.entries.slice(0, limit);
		}
		const entries = await this.families.leaderboard(
			guildId,
			FAMILY_LEADERBOARD_LIMIT,
		);
		this.leaderboardCache.set(guildId, {
			entries,
			expiresAt: Date.now() + LEADERBOARD_CACHE_TTL_MS,
		});
		return entries.slice(0, limit);
	}

	public async listJoinRequests(
		guildId: SnowflakeId,
		actorUserId: SnowflakeId,
	): Promise<FamilyJoinRequestDto[]> {
		const { family, membership } = await this.requireMembership(
			guildId,
			actorUserId,
		);
		this.requireRank(membership, ["OWNER", "OFFICER"], "view join requests");
		return this.families.listJoinRequests(family.id);
	}

	// ── Lifecycle ──────────────────────────────────────────────────────────────

	public async createFamily(
		guildId: SnowflakeId,
		name: string,
		ownerUserId: SnowflakeId,
	): Promise<FamilyDto> {
		const cleanName = this.validateName(name);
		const cfg = await this.resolveSettings(guildId);

		if (!cfg.creationEnabled) {
			throw new ConflictError(
				"Family creation is disabled on this server",
				"FAMILY_CREATION_DISABLED",
			);
		}

		const existingMembership = await this.families.findMemberByUser(
			guildId,
			ownerUserId,
		);
		if (existingMembership) {
			throw new ConflictError(
				"You are already in a family",
				"ALREADY_IN_FAMILY",
			);
		}

		if (cfg.maxFamilies !== null) {
			const families = await this.families.listByGuild(guildId);
			if (families.length >= cfg.maxFamilies) {
				throw new ConflictError(
					`This server has reached its family limit (${cfg.maxFamilies})`,
					"MAX_FAMILIES_REACHED",
				);
			}
		}

		const nameTaken = await this.families.findByName(guildId, cleanName);
		if (nameTaken) {
			throw new ConflictError(
				"A family with that name already exists",
				"FAMILY_NAME_TAKEN",
			);
		}

		const cost = this.coinCost(cfg, cfg.creationCost);
		if (cost > 0n) await this.charge(guildId, ownerUserId, cost);

		try {
			const family = await this.families.create({
				guildId,
				name: cleanName,
				ownerUserId,
			});
			this.invalidateLeaderboard(guildId);
			this.logger.info("Family created", {
				guildId,
				name: cleanName,
				ownerUserId,
				familyId: family.id,
				cost: cost.toString(),
			});
			return family;
		} catch (error) {
			if (cost > 0n) await this.refund(guildId, ownerUserId, cost);
			throw error;
		}
	}

	public async disbandFamily(
		guildId: SnowflakeId,
		actorUserId: SnowflakeId,
	): Promise<FamilyDto> {
		const { family } = await this.requireOwnership(guildId, actorUserId);
		await this.families.delete(family.id);
		this.logger.info("Family disbanded", {
			guildId,
			familyId: family.id,
			actorUserId,
		});
		return family;
	}

	public async renameFamily(
		guildId: SnowflakeId,
		actorUserId: SnowflakeId,
		newName: string,
	): Promise<FamilyDto> {
		const cleanName = this.validateName(newName);
		const { family, membership } = await this.requireMembership(
			guildId,
			actorUserId,
		);
		this.requireRank(membership, ["OWNER", "OFFICER"], "rename the family");

		const nameTaken = await this.families.findByName(guildId, cleanName);
		if (nameTaken && nameTaken.id !== family.id) {
			throw new ConflictError(
				"A family with that name already exists",
				"FAMILY_NAME_TAKEN",
			);
		}

		const cfg = await this.resolveSettings(guildId);
		const cost = cfg.nameChangeCost > 0n ? cfg.nameChangeCost : 0n;
		if (cost > 0n) await this.charge(guildId, actorUserId, cost);

		try {
			const updated = await this.families.rename(family.id, cleanName);
			this.invalidateLeaderboard(guildId);
			this.logger.info("Family renamed", {
				guildId,
				familyId: family.id,
				newName: cleanName,
				actorUserId,
				cost: cost.toString(),
			});
			return updated;
		} catch (error) {
			if (cost > 0n) await this.refund(guildId, actorUserId, cost);
			throw error;
		}
	}

	// ── Membership ──────────────────────────────────────────────────────────────

	public async invite(
		guildId: SnowflakeId,
		actorUserId: SnowflakeId,
		targetUserId: SnowflakeId,
	): Promise<FamilyMemberDto> {
		const { family, membership } = await this.requireMembership(
			guildId,
			actorUserId,
		);
		this.requireRank(membership, ["OWNER", "OFFICER"], "add members");

		const targetMembership = await this.families.findMemberByUser(
			guildId,
			targetUserId,
		);
		if (targetMembership) {
			throw new ConflictError(
				"That user is already in a family",
				"TARGET_ALREADY_IN_FAMILY",
			);
		}

		const cfg = await this.resolveSettings(guildId);
		await this.assertHasCapacity(family.id, cfg.maxMembers);

		const added = await this.families.addMember({
			guildId,
			familyId: family.id,
			userId: targetUserId,
		});
		await this.families.deleteJoinRequestsForUser(guildId, targetUserId);
		this.invalidateLeaderboard(guildId);
		this.logger.info("Family member added", {
			guildId,
			familyId: family.id,
			targetUserId,
			actorUserId,
		});
		return added;
	}

	public async kick(
		guildId: SnowflakeId,
		actorUserId: SnowflakeId,
		targetUserId: SnowflakeId,
	): Promise<void> {
		if (actorUserId === targetUserId) {
			throw new ValidationError(
				"Use leave to exit your own family",
				"targetUserId",
			);
		}
		const { family, membership } = await this.requireMembership(
			guildId,
			actorUserId,
		);
		this.requireRank(membership, ["OWNER", "OFFICER"], "kick members");

		const target = await this.requireMemberOfFamily(
			family.id,
			guildId,
			targetUserId,
		);
		if (target.role === "OWNER") {
			throw new PermissionDeniedError("You cannot kick the family owner");
		}
		// Officers may only kick plain members; the owner can kick anyone.
		if (membership.role === "OFFICER" && target.role === "OFFICER") {
			throw new PermissionDeniedError("Officers can only kick regular members");
		}

		await this.families.removeMember(family.id, targetUserId);
		this.logger.info("Family member kicked", {
			guildId,
			familyId: family.id,
			targetUserId,
			actorUserId,
		});
	}

	public async leave(guildId: SnowflakeId, userId: SnowflakeId): Promise<void> {
		const { family, membership } = await this.requireMembership(
			guildId,
			userId,
		);
		if (membership.role === "OWNER") {
			throw new ConflictError(
				"Owners must transfer ownership or disband the family before leaving",
				"OWNER_CANNOT_LEAVE",
			);
		}
		await this.families.removeMember(family.id, userId);
		this.logger.info("Family member left", {
			guildId,
			familyId: family.id,
			userId,
		});
	}

	public async promote(
		guildId: SnowflakeId,
		actorUserId: SnowflakeId,
		targetUserId: SnowflakeId,
	): Promise<FamilyMemberDto> {
		const { family } = await this.requireOwnership(guildId, actorUserId);
		const target = await this.requireMemberOfFamily(
			family.id,
			guildId,
			targetUserId,
		);
		if (target.role !== "MEMBER") {
			throw new ConflictError(
				"That user cannot be promoted further",
				"INVALID_PROMOTION",
			);
		}
		const updated = await this.families.updateMemberRole(
			family.id,
			targetUserId,
			"OFFICER",
		);
		this.logger.info("Family member promoted", {
			guildId,
			familyId: family.id,
			targetUserId,
		});
		return updated;
	}

	public async demote(
		guildId: SnowflakeId,
		actorUserId: SnowflakeId,
		targetUserId: SnowflakeId,
	): Promise<FamilyMemberDto> {
		const { family } = await this.requireOwnership(guildId, actorUserId);
		const target = await this.requireMemberOfFamily(
			family.id,
			guildId,
			targetUserId,
		);
		if (target.role !== "OFFICER") {
			throw new ConflictError(
				"That user is not an officer",
				"INVALID_DEMOTION",
			);
		}
		const updated = await this.families.updateMemberRole(
			family.id,
			targetUserId,
			"MEMBER",
		);
		this.logger.info("Family member demoted", {
			guildId,
			familyId: family.id,
			targetUserId,
		});
		return updated;
	}

	public async transferOwnership(
		guildId: SnowflakeId,
		actorUserId: SnowflakeId,
		targetUserId: SnowflakeId,
	): Promise<FamilyDto> {
		if (actorUserId === targetUserId) {
			throw new ValidationError("You already own this family", "targetUserId");
		}
		const { family } = await this.requireOwnership(guildId, actorUserId);
		await this.requireMemberOfFamily(family.id, guildId, targetUserId);
		const updated = await this.families.transferOwnership(
			family.id,
			targetUserId,
		);
		this.logger.info("Family ownership transferred", {
			guildId,
			familyId: family.id,
			from: actorUserId,
			to: targetUserId,
		});
		return updated;
	}

	// ── Join requests (self-service) ────────────────────────────────────────────

	public async requestJoin(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		familyName: string,
	): Promise<JoinResult> {
		const existing = await this.families.findMemberByUser(guildId, userId);
		if (existing) {
			throw new ConflictError(
				"You are already in a family",
				"ALREADY_IN_FAMILY",
			);
		}

		const family = await this.families.findByName(guildId, familyName.trim());
		if (!family) {
			throw new NotFoundError("No family with that name", "Family");
		}

		const cfg = await this.resolveSettings(guildId);
		await this.assertHasCapacity(family.id, cfg.maxMembers);

		if (!cfg.requireApproval) {
			const member = await this.families.addMember({
				guildId,
				familyId: family.id,
				userId,
			});
			await this.families.deleteJoinRequestsForUser(guildId, userId);
			this.invalidateLeaderboard(guildId);
			this.logger.info("Family joined", { guildId, familyId: family.id, userId });
			return { status: "joined", member };
		}

		const pending = await this.families.findJoinRequest(family.id, userId);
		if (pending) {
			throw new ConflictError(
				"You already have a pending request for this family",
				"ALREADY_REQUESTED",
			);
		}
		const request = await this.families.createJoinRequest({
			guildId,
			familyId: family.id,
			userId,
		});
		this.logger.info("Family join requested", {
			guildId,
			familyId: family.id,
			userId,
		});
		return { status: "pending", request };
	}

	public async acceptJoin(
		guildId: SnowflakeId,
		actorUserId: SnowflakeId,
		targetUserId: SnowflakeId,
	): Promise<FamilyMemberDto> {
		const { family, membership } = await this.requireMembership(
			guildId,
			actorUserId,
		);
		this.requireRank(membership, ["OWNER", "OFFICER"], "accept members");

		const request = await this.families.findJoinRequest(
			family.id,
			targetUserId,
		);
		if (!request) {
			throw new NotFoundError("No pending request from that user", "JoinRequest");
		}

		const alreadyMember = await this.families.findMemberByUser(
			guildId,
			targetUserId,
		);
		if (alreadyMember) {
			await this.families.deleteJoinRequest(family.id, targetUserId);
			throw new ConflictError(
				"That user is already in a family",
				"TARGET_ALREADY_IN_FAMILY",
			);
		}

		const cfg = await this.resolveSettings(guildId);
		await this.assertHasCapacity(family.id, cfg.maxMembers);

		const member = await this.families.addMember({
			guildId,
			familyId: family.id,
			userId: targetUserId,
		});
		await this.families.deleteJoinRequestsForUser(guildId, targetUserId);
		this.invalidateLeaderboard(guildId);
		this.logger.info("Family join accepted", {
			guildId,
			familyId: family.id,
			targetUserId,
			actorUserId,
		});
		return member;
	}

	public async denyJoin(
		guildId: SnowflakeId,
		actorUserId: SnowflakeId,
		targetUserId: SnowflakeId,
	): Promise<void> {
		const { family, membership } = await this.requireMembership(
			guildId,
			actorUserId,
		);
		this.requireRank(membership, ["OWNER", "OFFICER"], "deny members");

		const request = await this.families.findJoinRequest(
			family.id,
			targetUserId,
		);
		if (!request) {
			throw new NotFoundError("No pending request from that user", "JoinRequest");
		}
		await this.families.deleteJoinRequest(family.id, targetUserId);
		this.logger.info("Family join denied", {
			guildId,
			familyId: family.id,
			targetUserId,
			actorUserId,
		});
	}

	// ── Internals ──────────────────────────────────────────────────────────────

	private async resolveSettings(
		guildId: SnowflakeId,
	): Promise<ResolvedFamilySettings> {
		const s = await this.settings.findByGuild(guildId);
		return {
			creationEnabled: s?.familyCreationEnabled ?? true,
			maxFamilies: s?.maxFamilies ?? null,
			maxMembers: s?.maxFamilyMembers ?? FAMILY_MAX_MEMBERS,
			requireApproval: s?.familyRequireApproval ?? false,
			creationMode: s?.familyCreationMode ?? "coins",
			creationCost: s?.familyCreationCost ?? 0n,
			nameChangeCost: s?.familyNameChangeCost ?? 0n,
		};
	}

	/** Coin cost is only charged when the creation mode includes coins. */
	private coinCost(cfg: ResolvedFamilySettings, amount: bigint): bigint {
		return cfg.creationMode === "coins" || cfg.creationMode === "both"
			? amount
			: 0n;
	}

	private async assertHasCapacity(
		familyId: string,
		maxMembers: number,
	): Promise<void> {
		const count = await this.families.countMembers(familyId);
		if (count >= maxMembers) {
			throw new ConflictError(
				`Family is full (max ${maxMembers} members)`,
				"FAMILY_FULL",
			);
		}
	}

	private async charge(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		amount: bigint,
	): Promise<void> {
		const wallet = await this.ensureWallet(guildId, userId);
		const debited = await this.wallets.tryDebit(wallet.id, amount);
		if (!debited) {
			throw new ConflictError(
				"You do not have enough coins",
				"INSUFFICIENT_BALANCE",
			);
		}
	}

	private async refund(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		amount: bigint,
	): Promise<void> {
		const wallet = await this.ensureWallet(guildId, userId);
		await this.wallets.adjustBalance(wallet.id, amount);
	}

	private async ensureWallet(guildId: SnowflakeId, userId: SnowflakeId) {
		const existing = await this.wallets.findByGuildAndUser(guildId, userId);
		if (existing) return existing;
		return this.wallets.create({ guildId, userId });
	}

	private invalidateLeaderboard(guildId: SnowflakeId): void {
		this.leaderboardCache.delete(guildId);
	}

	private validateName(name: string): string {
		const clean = (name ?? "").trim();
		if (clean.length < FAMILY_NAME_MIN || clean.length > FAMILY_NAME_MAX) {
			throw new ValidationError(
				`Family name must be ${FAMILY_NAME_MIN}–${FAMILY_NAME_MAX} characters`,
				"name",
			);
		}
		// The name is echoed into message content; reject mention/markdown control
		// characters so a name like "@everyone" can't trigger a ping injection.
		if (/[@`\\]/.test(clean)) {
			throw new ValidationError(
				"Family name cannot contain @, backticks or backslashes",
				"name",
			);
		}
		return clean;
	}

	private async requireMembership(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<{ family: FamilyDto; membership: FamilyMemberDto }> {
		const membership = await this.families.findMemberByUser(guildId, userId);
		if (!membership) {
			throw new NotFoundError("You are not in a family", "FamilyMember");
		}
		const family = await this.families.findById(membership.familyId);
		if (!family) {
			throw new NotFoundError("Family not found", "Family");
		}
		return { family, membership };
	}

	private async requireOwnership(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<{ family: FamilyDto; membership: FamilyMemberDto }> {
		const result = await this.requireMembership(guildId, userId);
		this.requireRank(result.membership, ["OWNER"], "perform this action");
		return result;
	}

	private requireRank(
		membership: FamilyMemberDto,
		allowed: ReadonlyArray<FamilyMemberDto["role"]>,
		action: string,
	): void {
		if (!allowed.includes(membership.role)) {
			throw new PermissionDeniedError(
				`You do not have permission to ${action}`,
			);
		}
	}

	private async requireMemberOfFamily(
		familyId: string,
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<FamilyMemberDto> {
		const target = await this.families.findMemberByUser(guildId, userId);
		if (!target || target.familyId !== familyId) {
			throw new NotFoundError(
				"That user is not a member of your family",
				"FamilyMember",
			);
		}
		return target;
	}
}
