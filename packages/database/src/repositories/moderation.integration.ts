import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { ConflictError, ValidationError } from "@sailorclawbot/core";
import { BanRepositoryImpl } from "./BanRepositoryImpl.js";
import { CaseRepositoryImpl } from "./CaseRepositoryImpl.js";
import { MuteRepositoryImpl } from "./MuteRepositoryImpl.js";
import { PermissionRepositoryImpl } from "./PermissionRepositoryImpl.js";
import { WarningRepositoryImpl } from "./WarningRepositoryImpl.js";

// Integration tests run against a real Postgres (docker compose up -d postgres).
// They are excluded from `pnpm test` (unit) and run via `pnpm test:integration`.
process.env.DATABASE_URL ??=
	"postgresql://sailorclaw:change_me@localhost:5432/sailorclawbot?schema=public";

const db = new PrismaClient();
const guildId = "guild_itest";
const userId = "user_itest";
const modId = "mod_itest";

const warnings = new WarningRepositoryImpl(db);
const mutes = new MuteRepositoryImpl(db);
const bans = new BanRepositoryImpl(db);
const cases = new CaseRepositoryImpl(db);
const permissions = new PermissionRepositoryImpl(db);

before(async () => {
	await db.$connect();
	await db.guild.deleteMany({});
	await db.guild.create({
		data: { id: guildId, name: "Integration Test Guild" },
	});
});

after(async () => {
	await db.guild.deleteMany({});
	await db.$disconnect();
});

beforeEach(async () => {
	await db.warning.deleteMany({});
	await db.mute.deleteMany({});
	await db.ban.deleteMany({});
	await db.case.deleteMany({});
	await db.permissionOverride.deleteMany({});
	await db.guildCaseCounter.deleteMany({});
});

test("CaseRepository.getNextCaseNumber increments atomically from 1", async () => {
	assert.equal(await cases.getNextCaseNumber(guildId), 1);
	assert.equal(await cases.getNextCaseNumber(guildId), 2);
	assert.equal(await cases.getNextCaseNumber(guildId), 3);
});

test("WarningRepository create / findByGuildAndUser / count", async () => {
	await warnings.create({
		guildId,
		userId,
		reason: "spam",
		moderatorId: modId,
		caseNumber: 1,
	});
	await warnings.create({
		guildId,
		userId,
		reason: "flood",
		moderatorId: modId,
		caseNumber: 2,
	});

	const found = await warnings.findByGuildAndUser(guildId, userId);
	assert.equal(found.length, 2);
	// ordered most-recent-first
	assert.equal(found[0]?.reason, "flood");
	assert.equal(await warnings.count(guildId, userId), 2);
});

test("WarningRepository create rejects a missing guild (FK -> ValidationError)", async () => {
	await assert.rejects(
		() =>
			warnings.create({
				guildId: "guild_does_not_exist",
				userId,
				reason: "x",
				moderatorId: modId,
				caseNumber: 1,
			}),
		ValidationError,
	);
});

test("WarningRepository rejects duplicate case number (unique -> ConflictError)", async () => {
	await warnings.create({
		guildId,
		userId,
		reason: "a",
		moderatorId: modId,
		caseNumber: 7,
	});
	await assert.rejects(
		() =>
			warnings.create({
				guildId,
				userId: "other",
				reason: "b",
				moderatorId: modId,
				caseNumber: 7,
			}),
		ConflictError,
	);
});

test("MuteRepository create / findByGuildAndUser (latest) / deactivate", async () => {
	const mute = await mutes.create({
		guildId,
		userId,
		reason: "cooldown",
		moderatorId: modId,
		caseNumber: 1,
		duration: 60,
		expiresAt: new Date(Date.now() + 3_600_000),
		isActive: true,
	});

	const found = await mutes.findByGuildAndUser(guildId, userId);
	assert.equal(found?.id, mute.id);
	assert.equal(found?.isActive, true);

	const deactivated = await mutes.deactivate(mute.id);
	assert.equal(deactivated.isActive, false);
});

test("BanRepository permanent ban maps null expiresAt to undefined; deactivate works", async () => {
	const ban = await bans.create({
		guildId,
		userId,
		reason: "raiding",
		moderatorId: modId,
		caseNumber: 1,
		isActive: true,
		// no expiresAt -> permanent
	});
	assert.equal(ban.expiresAt, undefined);
	assert.equal(ban.isActive, true);

	const active = await bans.findActive(guildId);
	assert.equal(active.length, 1);

	const deactivated = await bans.deactivate(ban.id);
	assert.equal(deactivated.isActive, false);
	assert.equal((await bans.findActive(guildId)).length, 0);
});

test("CaseRepository create / findByGuildAndNumber / listByUser", async () => {
	const num = await cases.getNextCaseNumber(guildId);
	await cases.create({
		guildId,
		caseNumber: num,
		type: "warning",
		userId,
		moderatorId: modId,
		action: "warn_x",
		reason: "spam",
		isAppealed: false,
		metadata: { warningId: "warn_x" },
	});

	const byNumber = await cases.findByGuildAndNumber(guildId, num);
	assert.equal(byNumber?.type, "warning");
	assert.deepEqual(byNumber?.metadata, { warningId: "warn_x" });

	const byUser = await cases.listByUser(guildId, userId);
	assert.equal(byUser.length, 1);
});

test("PermissionRepository create / find / update / deleteByGuildAndUser", async () => {
	const created = await permissions.create({
		guildId,
		userId: modId,
		permission: "can_moderate",
		allowed: true,
	});
	assert.equal(created.allowed, true);

	const found = await permissions.findByGuildUserPermission(
		guildId,
		modId,
		"can_moderate",
	);
	assert.equal(found?.id, created.id);

	const updated = await permissions.update(created.id, false);
	assert.equal(updated.allowed, false);

	const deleted = await permissions.deleteByGuildAndUser(guildId, modId);
	assert.equal(deleted, 1);
	assert.equal(
		await permissions.findByGuildUserPermission(guildId, modId, "can_moderate"),
		null,
	);
});
