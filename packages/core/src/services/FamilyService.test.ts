import assert from "node:assert/strict";
import { test } from "node:test";
import type {
	FamilyDto,
	FamilyLeaderboardEntry,
	FamilyMemberDto,
	FamilyRepository,
	FamilyRole,
} from "@sailorclawbot/contracts";
import type { Logger } from "../common/logging/Logger.js";
import { FAMILY_MAX_MEMBERS, FamilyService } from "./FamilyService.js";

const NOW = new Date("2024-01-01T00:00:00Z");

/** Stateful in-memory FamilyRepository for behaviour tests. */
function createRepo() {
	const families = new Map<string, FamilyDto>();
	const members: FamilyMemberDto[] = [];
	let seq = 0;

	const repo: FamilyRepository = {
		findById: async (id) => families.get(id) ?? null,
		findByName: async (guildId, name) =>
			[...families.values()].find(
				(f) => f.guildId === guildId && f.name === name,
			) ?? null,
		listByGuild: async (guildId) =>
			[...families.values()].filter((f) => f.guildId === guildId),
		create: async (input) => {
			const id = `fam_${++seq}`;
			const fam: FamilyDto = { id, ...input, createdAt: NOW, updatedAt: NOW };
			families.set(id, fam);
			members.push({
				id: `m_${++seq}`,
				guildId: input.guildId,
				familyId: id,
				userId: input.ownerUserId,
				role: "OWNER",
				joinedAt: NOW,
			});
			return fam;
		},
		rename: async (id, name) => {
			const fam = families.get(id)!;
			const updated = { ...fam, name };
			families.set(id, updated);
			return updated;
		},
		delete: async (id) => {
			families.delete(id);
			for (let i = members.length - 1; i >= 0; i--) {
				if (members[i].familyId === id) members.splice(i, 1);
			}
		},
		addMember: async (input) => {
			const m: FamilyMemberDto = {
				id: `m_${++seq}`,
				guildId: input.guildId,
				familyId: input.familyId,
				userId: input.userId,
				role: input.role ?? "MEMBER",
				joinedAt: NOW,
			};
			members.push(m);
			return m;
		},
		removeMember: async (familyId, userId) => {
			const i = members.findIndex(
				(m) => m.familyId === familyId && m.userId === userId,
			);
			if (i >= 0) members.splice(i, 1);
		},
		listMembers: async (familyId) =>
			members.filter((m) => m.familyId === familyId),
		countMembers: async (familyId) =>
			members.filter((m) => m.familyId === familyId).length,
		findMemberByUser: async (guildId, userId) =>
			members.find((m) => m.guildId === guildId && m.userId === userId) ?? null,
		updateMemberRole: async (familyId, userId, role) => {
			const m = members.find(
				(x) => x.familyId === familyId && x.userId === userId,
			)!;
			m.role = role;
			return m;
		},
		transferOwnership: async (familyId, newOwnerUserId) => {
			const fam = families.get(familyId)!;
			const oldOwner = members.find(
				(m) => m.familyId === familyId && m.userId === fam.ownerUserId,
			);
			if (oldOwner) oldOwner.role = "OFFICER";
			const newOwner = members.find(
				(m) => m.familyId === familyId && m.userId === newOwnerUserId,
			);
			if (newOwner) newOwner.role = "OWNER";
			const updated = { ...fam, ownerUserId: newOwnerUserId };
			families.set(familyId, updated);
			return updated;
		},
		leaderboard: async (guildId, limit): Promise<FamilyLeaderboardEntry[]> =>
			[...families.values()]
				.filter((f) => f.guildId === guildId)
				.map((f) => ({
					familyId: f.id,
					name: f.name,
					ownerUserId: f.ownerUserId,
					memberCount: members.filter((m) => m.familyId === f.id).length,
					totalXp: 0,
				}))
				.slice(0, limit),
	};

	const setRole = (userId: string, role: FamilyRole) => {
		const m = members.find((x) => x.userId === userId);
		if (m) m.role = role;
	};

	return { repo, members, families, setRole };
}

const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

async function expectError(
	fn: () => Promise<unknown>,
	code: string,
): Promise<void> {
	await assert.rejects(
		fn,
		(err: { code?: string }) => err.code === code,
		`expected code ${code}`,
	);
}

// ── createFamily ──────────────────────────────────────────────────────────────

test("createFamily — creates and enrolls owner as OWNER member", async () => {
	const { repo, members } = createRepo();
	const svc = new FamilyService(repo, logger);

	const fam = await svc.createFamily("g", "TestFamily", "u");
	assert.equal(fam.name, "TestFamily");
	assert.equal(members.length, 1);
	assert.equal(members[0].role, "OWNER");
	assert.equal(members[0].userId, "u");
});

test("createFamily — rejects when user already in a family", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "First", "u");

	await expectError(
		() => svc.createFamily("g", "Second", "u"),
		"ALREADY_IN_FAMILY",
	);
});

test("createFamily — rejects duplicate name", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Dupe", "owner1");

	await expectError(
		() => svc.createFamily("g", "Dupe", "owner2"),
		"FAMILY_NAME_TAKEN",
	);
});

test("createFamily — rejects too-short name", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await assert.rejects(
		() => svc.createFamily("g", "x", "u"),
		/2.32 characters/,
	);
});

test("createFamily — rejects mention-injection name (@everyone)", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await assert.rejects(
		() => svc.createFamily("g", "@everyone", "u"),
		/@, backticks or backslashes/,
	);
});

// ── invite ──────────────────────────────────────────────────────────────────

test("invite — owner adds a member", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");

	const added = await svc.invite("g", "owner", "newbie");
	assert.equal(added.role, "MEMBER");
	assert.equal(added.userId, "newbie");
});

test("invite — plain member cannot add", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "member");

	await assert.rejects(() => svc.invite("g", "member", "other"), /permission/);
});

test("invite — rejects when target already in a family", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "FamA", "ownerA");
	await svc.createFamily("g", "FamB", "ownerB");

	await expectError(
		() => svc.invite("g", "ownerA", "ownerB"),
		"TARGET_ALREADY_IN_FAMILY",
	);
});

test("invite — rejects when family is full", async () => {
	const { repo, members } = createRepo();
	const svc = new FamilyService(repo, logger);
	const fam = await svc.createFamily("g", "Fam", "owner");
	// Pad to capacity directly.
	for (let i = members.length; i < FAMILY_MAX_MEMBERS; i++) {
		await repo.addMember({
			guildId: "g",
			familyId: fam.id,
			userId: `pad_${i}`,
		});
	}
	await expectError(() => svc.invite("g", "owner", "overflow"), "FAMILY_FULL");
});

// ── kick / leave ──────────────────────────────────────────────────────────────

test("kick — owner removes a member", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "member");

	await svc.kick("g", "owner", "member");
	assert.equal(await repo.findMemberByUser("g", "member"), null);
});

test("kick — cannot kick the owner", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "officer");
	await svc.promote("g", "owner", "officer");

	await assert.rejects(() => svc.kick("g", "officer", "owner"), /owner/);
});

test("kick — officer cannot kick another officer", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "off1");
	await svc.invite("g", "owner", "off2");
	await svc.promote("g", "owner", "off1");
	await svc.promote("g", "owner", "off2");

	await assert.rejects(() => svc.kick("g", "off1", "off2"), /regular members/);
});

test("leave — owner cannot leave", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");

	await expectError(() => svc.leave("g", "owner"), "OWNER_CANNOT_LEAVE");
});

test("leave — member leaves", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "member");

	await svc.leave("g", "member");
	assert.equal(await repo.findMemberByUser("g", "member"), null);
});

// ── promote / demote / transfer ────────────────────────────────────────────────

test("promote — member to officer", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "member");

	const m = await svc.promote("g", "owner", "member");
	assert.equal(m.role, "OFFICER");
});

test("promote — only owner can promote", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "m1");
	await svc.invite("g", "owner", "m2");

	await assert.rejects(() => svc.promote("g", "m1", "m2"), /permission/);
});

test("transferOwnership — swaps roles", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "heir");

	const fam = await svc.transferOwnership("g", "owner", "heir");
	assert.equal(fam.ownerUserId, "heir");
	assert.equal((await repo.findMemberByUser("g", "heir"))?.role, "OWNER");
	assert.equal((await repo.findMemberByUser("g", "owner"))?.role, "OFFICER");
});

test("transferOwnership — target must be a member", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");

	await assert.rejects(
		() => svc.transferOwnership("g", "owner", "stranger"),
		/not a member/,
	);
});

// ── rename / disband / reads ────────────────────────────────────────────────────

test("renameFamily — owner renames", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "OldName", "owner");

	const fam = await svc.renameFamily("g", "owner", "NewName");
	assert.equal(fam.name, "NewName");
});

test("disbandFamily — owner disbands, members cleared", async () => {
	const { repo, members } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "member");

	await svc.disbandFamily("g", "owner");
	assert.equal(members.length, 0);
});

test("disbandFamily — non-owner blocked", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "member");

	await assert.rejects(() => svc.disbandFamily("g", "member"), /permission/);
});

test("getMyFamily — returns family with members or null", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");
	await svc.invite("g", "owner", "member");

	const mine = await svc.getMyFamily("g", "member");
	assert.equal(mine?.family.name, "Fam");
	assert.equal(mine?.members.length, 2);
	assert.equal(await svc.getMyFamily("g", "stranger"), null);
});

test("listFamilies — returns families by guild", async () => {
	const { repo } = createRepo();
	const svc = new FamilyService(repo, logger);
	await svc.createFamily("g", "Fam", "owner");

	const list = await svc.listFamilies("g");
	assert.equal(list.length, 1);
});
