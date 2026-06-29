import assert from "node:assert/strict";
import test from "node:test";
import type {
	BlackjackSessionDto,
	BlackjackSessionRepository,
} from "@sailorclawbot/contracts";
import type { Container } from "../../container.js";
import { recoverSessions } from "./blackjack.js";

function makeSession(
	overrides: Partial<BlackjackSessionDto> = {},
): BlackjackSessionDto {
	return {
		id: "bj_g_u",
		guildId: "g",
		userId: "u",
		walletId: "w",
		bet: 100n,
		playerCards: [],
		dealerCards: [],
		deck: [],
		createdAt: new Date(),
		...overrides,
	};
}

interface Harness {
	container: Container;
	deposits: Array<{ guildId: string; userId: string; amount: bigint }>;
	store: Map<string, BlackjackSessionDto>;
}

function createHarness(initial: BlackjackSessionDto[]): Harness {
	const store = new Map(initial.map((s) => [s.id, s]));
	const deposits: Harness["deposits"] = [];

	const repo: BlackjackSessionRepository = {
		findById: async (id) => store.get(id) ?? null,
		create: async (input) => {
			const row = { ...input, createdAt: new Date() };
			store.set(row.id, row);
			return row;
		},
		update: async (id, data) => {
			const row = store.get(id);
			if (!row) throw new Error("not found");
			const next = { ...row, ...data };
			store.set(id, next);
			return next;
		},
		// Atomic capture: only the first caller for a given id gets the row.
		deleteCapture: async (id) => {
			const row = store.get(id);
			if (!row) return null;
			store.delete(id);
			return row;
		},
		findAll: async () => [...store.values()],
		findStale: async (cutoff) =>
			[...store.values()].filter((s) => s.createdAt < cutoff),
	};

	const container = {
		blackjackSessionRepo: repo,
		economyService: {
			deposit: async (guildId: string, userId: string, amount: bigint) => {
				deposits.push({ guildId, userId, amount });
				return {} as never;
			},
		},
	} as unknown as Container;

	return { container, deposits, store };
}

test("recoverSessions — refunds every orphaned bet and clears the store", async () => {
	const { container, deposits, store } = createHarness([
		makeSession({ id: "bj_g_a", userId: "a", bet: 100n }),
		makeSession({ id: "bj_g_b", userId: "b", bet: 250n }),
	]);

	await recoverSessions(container);

	assert.equal(store.size, 0, "all sessions must be cleared");
	assert.equal(deposits.length, 2);
	const byUser = Object.fromEntries(deposits.map((d) => [d.userId, d.amount]));
	assert.equal(byUser.a, 100n);
	assert.equal(byUser.b, 250n);
});

test("recoverSessions — idempotent: a second run refunds nothing", async () => {
	const { container, deposits } = createHarness([
		makeSession({ id: "bj_g_a", userId: "a", bet: 100n }),
	]);

	await recoverSessions(container);
	await recoverSessions(container);

	assert.equal(deposits.length, 1, "bet must be refunded exactly once");
});
