import assert from "node:assert/strict";
import { test } from "node:test";
import type {
	PermissionOverrideDto,
	PermissionRepository,
	SnowflakeId,
} from "@sailorclawbot/contracts";
import { NotFoundError } from "../common/errors/NotFoundError.js";
import { ValidationError } from "../common/errors/ValidationError.js";
import { PermissionService } from "./PermissionService.js";

function makeOverride(
	id: string,
	guildId: SnowflakeId,
	userId: SnowflakeId,
	permission: string,
	allowed: boolean,
): PermissionOverrideDto {
	return { id, guildId, userId, permission, allowed };
}

function createRepo(store: PermissionOverrideDto[] = []): PermissionRepository {
	return {
		findByGuildUserPermission: async (guildId, userId, permission) =>
			store.find(
				(o) =>
					o.guildId === guildId &&
					o.userId === userId &&
					o.permission === permission,
			) ?? null,
		findByGuildUser: async (guildId, userId) =>
			store.filter((o) => o.guildId === guildId && o.userId === userId),
		create: async (input) => {
			const dto: PermissionOverrideDto = {
				id: `ov_${store.length + 1}`,
				...input,
			};
			store.push(dto);
			return dto;
		},
		update: async (id, allowed) => {
			const idx = store.findIndex((o) => o.id === id);
			if (idx === -1) throw new Error("not found");
			store[idx] = { ...store[idx]!, allowed };
			return store[idx]!;
		},
		delete: async (id) => {
			const idx = store.findIndex((o) => o.id === id);
			if (idx !== -1) store.splice(idx, 1);
		},
		deleteByGuildAndUser: async (guildId, userId) => {
			const before = store.length;
			const keep = store.filter(
				(o) => !(o.guildId === guildId && o.userId === userId),
			);
			store.length = 0;
			store.push(...keep);
			return before - store.length;
		},
	};
}

test("hasPermission returns false when no override exists", async () => {
	const svc = new PermissionService(createRepo());
	assert.equal(await svc.hasPermission("g1", "u1", "can_moderate"), false);
});

test("hasPermission returns true for an allow override", async () => {
	const store = [makeOverride("o1", "g1", "u1", "can_moderate", true)];
	const svc = new PermissionService(createRepo(store));
	assert.equal(await svc.hasPermission("g1", "u1", "can_moderate"), true);
});

test("hasPermission returns false for a deny override", async () => {
	const store = [makeOverride("o1", "g1", "u1", "can_moderate", false)];
	const svc = new PermissionService(createRepo(store));
	assert.equal(await svc.hasPermission("g1", "u1", "can_moderate"), false);
});

test("setPermission creates a new override", async () => {
	const repo = createRepo();
	const svc = new PermissionService(repo);
	const result = await svc.setPermission("g1", "u1", "can_moderate", true);

	assert.equal(result.allowed, true);
	assert.equal(result.guildId, "g1");
	assert.equal(result.userId, "u1");
	assert.equal(result.permission, "can_moderate");
});

test("setPermission updates an existing override", async () => {
	const store = [makeOverride("o1", "g1", "u1", "can_moderate", true)];
	const svc = new PermissionService(createRepo(store));
	const result = await svc.setPermission("g1", "u1", "can_moderate", false);

	assert.equal(result.id, "o1");
	assert.equal(result.allowed, false);
});

test("listPermissions returns all overrides for a user", async () => {
	const store = [
		makeOverride("o1", "g1", "u1", "can_moderate", true),
		makeOverride("o2", "g1", "u1", "can_ban", false),
		makeOverride("o3", "g1", "u2", "can_moderate", true),
	];
	const svc = new PermissionService(createRepo(store));
	const result = await svc.listPermissions("g1", "u1");

	assert.equal(result.length, 2);
});

test("revokePermission removes an existing override", async () => {
	const store = [makeOverride("o1", "g1", "u1", "can_moderate", true)];
	const svc = new PermissionService(createRepo(store));
	await svc.revokePermission("g1", "u1", "can_moderate");

	assert.equal(store.length, 0);
});

test("revokePermission throws NotFoundError when override does not exist", async () => {
	const svc = new PermissionService(createRepo());
	await assert.rejects(
		() => svc.revokePermission("g1", "u1", "can_moderate"),
		NotFoundError,
	);
});

test("clearPermissions removes all overrides for a user", async () => {
	const store = [
		makeOverride("o1", "g1", "u1", "can_moderate", true),
		makeOverride("o2", "g1", "u1", "can_ban", false),
	];
	const svc = new PermissionService(createRepo(store));
	const count = await svc.clearPermissions("g1", "u1");

	assert.equal(count, 2);
	assert.equal(store.length, 0);
});

test("hasPermission throws ValidationError for empty guildId", async () => {
	const svc = new PermissionService(createRepo());
	await assert.rejects(
		() => svc.hasPermission("", "u1", "can_moderate"),
		ValidationError,
	);
});

test("setPermission throws ValidationError for empty permission", async () => {
	const svc = new PermissionService(createRepo());
	await assert.rejects(
		() => svc.setPermission("g1", "u1", "", true),
		ValidationError,
	);
});

// BUG-R12: isGuildOwner=true must bypass all overrides, including deny overrides.
// This is the guild owner fast-path at line 33 in PermissionService.ts.
test("hasPermission — BUG-R12: isGuildOwner=true returns true even with a deny override", async () => {
	const store = [makeOverride("o1", "g1", "owner_u", "can_moderate", false)];
	const svc = new PermissionService(createRepo(store));
	const result = await svc.hasPermission("g1", "owner_u", "can_moderate", {
		isGuildOwner: true,
	});
	assert.equal(result, true);
});

test("hasPermission — isGuildOwner=true returns true with no override at all", async () => {
	const svc = new PermissionService(createRepo());
	const result = await svc.hasPermission("g1", "owner_u", "can_ban", {
		isGuildOwner: true,
	});
	assert.equal(result, true);
});

test("hasPermission — isGuildOwner=false still reads override normally", async () => {
	const store = [makeOverride("o1", "g1", "u1", "can_moderate", true)];
	const svc = new PermissionService(createRepo(store));
	const result = await svc.hasPermission("g1", "u1", "can_moderate", {
		isGuildOwner: false,
	});
	assert.equal(result, true);
});
