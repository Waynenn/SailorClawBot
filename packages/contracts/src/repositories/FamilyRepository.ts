import type {
	FamilyDto,
	FamilyJoinRequestDto,
	FamilyLeaderboardEntry,
	FamilyMemberDto,
	FamilyRole,
	SnowflakeId,
} from "../types/index.js";

export interface FamilyRepository {
	findById(id: string): Promise<FamilyDto | null>;
	findByName(guildId: SnowflakeId, name: string): Promise<FamilyDto | null>;
	listByGuild(guildId: SnowflakeId): Promise<FamilyDto[]>;
	create(
		input: Pick<FamilyDto, "guildId" | "name" | "ownerUserId">,
	): Promise<FamilyDto>;
	rename(id: string, name: string): Promise<FamilyDto>;
	delete(id: string): Promise<void>;

	addMember(input: {
		guildId: SnowflakeId;
		familyId: string;
		userId: SnowflakeId;
		role?: FamilyRole;
	}): Promise<FamilyMemberDto>;
	removeMember(familyId: string, userId: SnowflakeId): Promise<void>;
	listMembers(familyId: string): Promise<FamilyMemberDto[]>;
	countMembers(familyId: string): Promise<number>;
	findMemberByUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<FamilyMemberDto | null>;
	updateMemberRole(
		familyId: string,
		userId: SnowflakeId,
		role: FamilyRole,
	): Promise<FamilyMemberDto>;

	/** Atomically reassign ownership: old owner → OFFICER, new owner → OWNER, Family.ownerUserId updated. */
	transferOwnership(
		familyId: string,
		newOwnerUserId: SnowflakeId,
	): Promise<FamilyDto>;

	/** Families ranked by summed member totalXp (descending). */
	leaderboard(
		guildId: SnowflakeId,
		limit: number,
	): Promise<FamilyLeaderboardEntry[]>;

	// ── Join requests (approval flow) ───────────────────────────────────────────
	createJoinRequest(input: {
		guildId: SnowflakeId;
		familyId: string;
		userId: SnowflakeId;
	}): Promise<FamilyJoinRequestDto>;
	findJoinRequest(
		familyId: string,
		userId: SnowflakeId,
	): Promise<FamilyJoinRequestDto | null>;
	listJoinRequests(familyId: string): Promise<FamilyJoinRequestDto[]>;
	deleteJoinRequest(familyId: string, userId: SnowflakeId): Promise<void>;
	/** Remove every pending request a user has across the guild (e.g. after they join one). */
	deleteJoinRequestsForUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<void>;
}
