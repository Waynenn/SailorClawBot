import type {
	FamilyDto,
	FamilyLeaderboardEntry,
	FamilyMemberDto,
	FamilyRepository,
	SnowflakeId,
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

export interface FamilyWithMembers {
	family: FamilyDto;
	members: FamilyMemberDto[];
}

export class FamilyService {
	public constructor(
		private readonly families: FamilyRepository,
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
		return this.families.leaderboard(guildId, limit);
	}

	// ── Lifecycle ──────────────────────────────────────────────────────────────

	public async createFamily(
		guildId: SnowflakeId,
		name: string,
		ownerUserId: SnowflakeId,
	): Promise<FamilyDto> {
		const cleanName = this.validateName(name);

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
		const nameTaken = await this.families.findByName(guildId, cleanName);
		if (nameTaken) {
			throw new ConflictError(
				"A family with that name already exists",
				"FAMILY_NAME_TAKEN",
			);
		}

		const family = await this.families.create({
			guildId,
			name: cleanName,
			ownerUserId,
		});
		this.logger.info("Family created", {
			guildId,
			name: cleanName,
			ownerUserId,
			familyId: family.id,
		});
		return family;
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

		const updated = await this.families.rename(family.id, cleanName);
		this.logger.info("Family renamed", {
			guildId,
			familyId: family.id,
			newName: cleanName,
			actorUserId,
		});
		return updated;
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

		const count = await this.families.countMembers(family.id);
		if (count >= FAMILY_MAX_MEMBERS) {
			throw new ConflictError(
				`Family is full (max ${FAMILY_MAX_MEMBERS} members)`,
				"FAMILY_FULL",
			);
		}

		const added = await this.families.addMember({
			guildId,
			familyId: family.id,
			userId: targetUserId,
		});
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

	// ── Internals ──────────────────────────────────────────────────────────────

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
