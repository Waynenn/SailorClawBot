import type { PrismaClient } from "@prisma/client";
import type {
	FamilyDto,
	FamilyJoinRequestDto,
	FamilyLeaderboardEntry,
	FamilyMemberDto,
	FamilyRepository,
	FamilyRole,
	SnowflakeId,
} from "@sailorclawbot/contracts";
import { ValidationError } from "@sailorclawbot/core";
import { translatePrismaError } from "./prisma-errors.js";

type FamilyRow = {
	id: string;
	guildId: string;
	name: string;
	ownerUserId: string;
	createdAt: Date;
	updatedAt: Date;
};
type MemberRow = {
	id: string;
	guildId: string;
	familyId: string;
	userId: string;
	role: FamilyRole;
	joinedAt: Date;
};
type JoinRequestRow = {
	id: string;
	guildId: string;
	familyId: string;
	userId: string;
	createdAt: Date;
};

function toFamilyDto(row: FamilyRow): FamilyDto {
	return {
		id: row.id,
		guildId: row.guildId,
		name: row.name,
		ownerUserId: row.ownerUserId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function toMemberDto(row: MemberRow): FamilyMemberDto {
	return {
		id: row.id,
		guildId: row.guildId,
		familyId: row.familyId,
		userId: row.userId,
		role: row.role,
		joinedAt: row.joinedAt,
	};
}

function toJoinRequestDto(row: JoinRequestRow): FamilyJoinRequestDto {
	return {
		id: row.id,
		guildId: row.guildId,
		familyId: row.familyId,
		userId: row.userId,
		createdAt: row.createdAt,
	};
}

function requireNonEmpty(value: string, field: string): void {
	if (!value || value.trim().length === 0) {
		throw new ValidationError(`${field} cannot be empty`, field);
	}
}

export class FamilyRepositoryImpl implements FamilyRepository {
	public constructor(private readonly db: PrismaClient) {}

	public async findById(id: string): Promise<FamilyDto | null> {
		requireNonEmpty(id, "id");
		const row = await this.db.family.findUnique({ where: { id } });
		return row ? toFamilyDto(row) : null;
	}

	public async findByName(
		guildId: SnowflakeId,
		name: string,
	): Promise<FamilyDto | null> {
		requireNonEmpty(guildId, "guildId");
		requireNonEmpty(name, "name");
		const row = await this.db.family.findUnique({
			where: { guildId_name: { guildId, name } },
		});
		return row ? toFamilyDto(row) : null;
	}

	public async listByGuild(guildId: SnowflakeId): Promise<FamilyDto[]> {
		requireNonEmpty(guildId, "guildId");
		const rows = await this.db.family.findMany({
			where: { guildId },
			orderBy: { createdAt: "asc" },
		});
		return rows.map(toFamilyDto);
	}

	public async create(
		input: Pick<FamilyDto, "guildId" | "name" | "ownerUserId">,
	): Promise<FamilyDto> {
		requireNonEmpty(input.guildId, "guildId");
		requireNonEmpty(input.name, "name");
		requireNonEmpty(input.ownerUserId, "ownerUserId");

		try {
			// Create the family and enroll the owner as an OWNER member atomically.
			const row = await this.db.family.create({
				data: {
					guildId: input.guildId,
					name: input.name,
					ownerUserId: input.ownerUserId,
					members: {
						create: {
							guildId: input.guildId,
							userId: input.ownerUserId,
							role: "OWNER",
						},
					},
				},
			});
			return toFamilyDto(row);
		} catch (error) {
			translatePrismaError(error, "create family");
		}
	}

	public async rename(id: string, name: string): Promise<FamilyDto> {
		requireNonEmpty(id, "id");
		requireNonEmpty(name, "name");
		try {
			const row = await this.db.family.update({
				where: { id },
				data: { name },
			});
			return toFamilyDto(row);
		} catch (error) {
			translatePrismaError(error, "rename family");
		}
	}

	public async delete(id: string): Promise<void> {
		requireNonEmpty(id, "id");
		try {
			// Members cascade-delete via the schema relation.
			await this.db.family.delete({ where: { id } });
		} catch (error) {
			translatePrismaError(error, "disband family");
		}
	}

	public async addMember(input: {
		guildId: SnowflakeId;
		familyId: string;
		userId: SnowflakeId;
		role?: FamilyRole;
	}): Promise<FamilyMemberDto> {
		requireNonEmpty(input.guildId, "guildId");
		requireNonEmpty(input.familyId, "familyId");
		requireNonEmpty(input.userId, "userId");
		try {
			const row = await this.db.familyMember.create({
				data: {
					guildId: input.guildId,
					familyId: input.familyId,
					userId: input.userId,
					role: input.role ?? "MEMBER",
				},
			});
			return toMemberDto(row);
		} catch (error) {
			translatePrismaError(error, "add family member");
		}
	}

	public async removeMember(
		familyId: string,
		userId: SnowflakeId,
	): Promise<void> {
		requireNonEmpty(familyId, "familyId");
		requireNonEmpty(userId, "userId");
		try {
			await this.db.familyMember.deleteMany({ where: { familyId, userId } });
		} catch (error) {
			translatePrismaError(error, "remove family member");
		}
	}

	public async listMembers(familyId: string): Promise<FamilyMemberDto[]> {
		requireNonEmpty(familyId, "familyId");
		const rows = await this.db.familyMember.findMany({
			where: { familyId },
			orderBy: { joinedAt: "asc" },
		});
		return rows.map(toMemberDto);
	}

	public async countMembers(familyId: string): Promise<number> {
		requireNonEmpty(familyId, "familyId");
		return this.db.familyMember.count({ where: { familyId } });
	}

	public async findMemberByUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<FamilyMemberDto | null> {
		requireNonEmpty(guildId, "guildId");
		requireNonEmpty(userId, "userId");
		const row = await this.db.familyMember.findUnique({
			where: { guildId_userId: { guildId, userId } },
		});
		return row ? toMemberDto(row) : null;
	}

	public async updateMemberRole(
		familyId: string,
		userId: SnowflakeId,
		role: FamilyRole,
	): Promise<FamilyMemberDto> {
		requireNonEmpty(familyId, "familyId");
		requireNonEmpty(userId, "userId");
		try {
			const existing = await this.db.familyMember.findFirst({
				where: { familyId, userId },
			});
			if (!existing) {
				throw new ValidationError("Member not found in family", "userId");
			}
			const row = await this.db.familyMember.update({
				where: { id: existing.id },
				data: { role },
			});
			return toMemberDto(row);
		} catch (error) {
			translatePrismaError(error, "update family member role");
		}
	}

	public async transferOwnership(
		familyId: string,
		newOwnerUserId: SnowflakeId,
	): Promise<FamilyDto> {
		requireNonEmpty(familyId, "familyId");
		requireNonEmpty(newOwnerUserId, "newOwnerUserId");
		try {
			const updated = await this.db.$transaction(async (tx) => {
				const family = await tx.family.findUnique({ where: { id: familyId } });
				if (!family) {
					throw new ValidationError("Family not found", "familyId");
				}
				// Demote previous owner to OFFICER, promote the new owner.
				await tx.familyMember.updateMany({
					where: { familyId, userId: family.ownerUserId },
					data: { role: "OFFICER" },
				});
				await tx.familyMember.updateMany({
					where: { familyId, userId: newOwnerUserId },
					data: { role: "OWNER" },
				});
				return tx.family.update({
					where: { id: familyId },
					data: { ownerUserId: newOwnerUserId },
				});
			});
			return toFamilyDto(updated);
		} catch (error) {
			translatePrismaError(error, "transfer family ownership");
		}
	}

	public async leaderboard(
		guildId: SnowflakeId,
		limit: number,
	): Promise<FamilyLeaderboardEntry[]> {
		requireNonEmpty(guildId, "guildId");
		const families = await this.db.family.findMany({
			where: { guildId },
			include: { members: true },
		});
		if (families.length === 0) return [];

		const userIds = families.flatMap((f) => f.members.map((m) => m.userId));
		const profiles = await this.db.profile.findMany({
			where: { guildId, userId: { in: userIds } },
			select: { userId: true, totalXp: true },
		});
		const xpByUser = new Map(profiles.map((p) => [p.userId, p.totalXp]));

		return families
			.map((f) => ({
				familyId: f.id,
				name: f.name,
				ownerUserId: f.ownerUserId,
				memberCount: f.members.length,
				totalXp: f.members.reduce(
					(sum, m) => sum + (xpByUser.get(m.userId) ?? 0),
					0,
				),
			}))
			.sort((a, b) => b.totalXp - a.totalXp)
			.slice(0, limit);
	}

	public async createJoinRequest(input: {
		guildId: SnowflakeId;
		familyId: string;
		userId: SnowflakeId;
	}): Promise<FamilyJoinRequestDto> {
		requireNonEmpty(input.guildId, "guildId");
		requireNonEmpty(input.familyId, "familyId");
		requireNonEmpty(input.userId, "userId");
		try {
			const row = await this.db.familyJoinRequest.create({
				data: {
					guildId: input.guildId,
					familyId: input.familyId,
					userId: input.userId,
				},
			});
			return toJoinRequestDto(row);
		} catch (error) {
			translatePrismaError(error, "create family join request");
		}
	}

	public async findJoinRequest(
		familyId: string,
		userId: SnowflakeId,
	): Promise<FamilyJoinRequestDto | null> {
		requireNonEmpty(familyId, "familyId");
		requireNonEmpty(userId, "userId");
		const row = await this.db.familyJoinRequest.findUnique({
			where: { familyId_userId: { familyId, userId } },
		});
		return row ? toJoinRequestDto(row) : null;
	}

	public async listJoinRequests(
		familyId: string,
	): Promise<FamilyJoinRequestDto[]> {
		requireNonEmpty(familyId, "familyId");
		const rows = await this.db.familyJoinRequest.findMany({
			where: { familyId },
			orderBy: { createdAt: "asc" },
		});
		return rows.map(toJoinRequestDto);
	}

	public async deleteJoinRequest(
		familyId: string,
		userId: SnowflakeId,
	): Promise<void> {
		requireNonEmpty(familyId, "familyId");
		requireNonEmpty(userId, "userId");
		try {
			await this.db.familyJoinRequest.deleteMany({
				where: { familyId, userId },
			});
		} catch (error) {
			translatePrismaError(error, "delete family join request");
		}
	}

	public async deleteJoinRequestsForUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<void> {
		requireNonEmpty(guildId, "guildId");
		requireNonEmpty(userId, "userId");
		try {
			await this.db.familyJoinRequest.deleteMany({
				where: { guildId, userId },
			});
		} catch (error) {
			translatePrismaError(error, "delete family join requests for user");
		}
	}
}
