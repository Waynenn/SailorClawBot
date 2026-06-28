import assert from "node:assert/strict";
import { test } from "node:test";
import type {
	TransactionDto,
	TransactionRepository,
	WalletCooldownUpdate,
	WalletDto,
	WalletRepository,
} from "@sailorclawbot/contracts";
import { ConflictError } from "../common/errors/ConflictError.js";
import { CooldownError } from "../common/errors/CooldownError.js";
import { NotFoundError } from "../common/errors/NotFoundError.js";
import { ValidationError } from "../common/errors/ValidationError.js";
import type { DomainEvent, EventBus } from "../common/events/EventBus.js";
import type { Logger } from "../common/logging/Logger.js";
import { EconomyService } from "./EconomyService.js";

const NOW = new Date("2024-01-01T00:00:00Z");

function makeWallet(overrides: Partial<WalletDto> = {}): WalletDto {
	return {
		id: "wallet_1",
		guildId: "g",
		userId: "u",
		balance: 100n,
		lastDailyAt: null,
		lastWorkAt: null,
		lastCrimeAt: null,
		lastRobAt: null,
		workUsesToday: 0,
		crimeUsesToday: 0,
		dailyLimitReset: null,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function createHarness(existingWallet: WalletDto | null = null) {
	const events: DomainEvent[] = [];
	let wallet: WalletDto | null = existingWallet;
	const txs: TransactionDto[] = [];

	const wallets: WalletRepository = {
		findByGuildAndUser: async () => wallet,
		create: async (input) => {
			wallet = makeWallet({
				guildId: input.guildId,
				userId: input.userId,
				balance: 0n,
			});
			return wallet;
		},
		adjustBalance: async (_walletId, amount) => {
			if (!wallet) throw new Error("no wallet");
			wallet = { ...wallet, balance: wallet.balance + amount };
			return wallet;
		},
		atomicTransfer: async () => {
			throw new Error("atomicTransfer not stubbed");
		},
		updateCooldowns: async (_walletId, data: WalletCooldownUpdate) => {
			if (!wallet) throw new Error("no wallet");
			wallet = { ...wallet, ...(data as Partial<WalletDto>) };
			return wallet;
		},
		tryDebit: async (_walletId, amount) => {
			if (!wallet) throw new Error("no wallet");
			if (wallet.balance < amount) return null;
			wallet = { ...wallet, balance: wallet.balance - amount };
			return wallet;
		},
		tryStampCooldown: async (_walletId, field, cutoff) => {
			if (!wallet) throw new Error("no wallet");
			const cur = wallet[field] as Date | null | undefined;
			if (cur && cur.getTime() >= cutoff.getTime()) return null;
			wallet = { ...wallet, [field]: new Date() };
			return wallet;
		},
	};

	const transactions: TransactionRepository = {
		create: async (input) => {
			const tx: TransactionDto = {
				id: `tx_${txs.length + 1}`,
				createdAt: NOW,
				...input,
			};
			txs.push(tx);
			return tx;
		},
		listByWallet: async () => txs,
	};

	const bus: EventBus = {
		publish: async (e) => {
			events.push(e);
		},
	};
	const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

	return {
		wallets,
		transactions,
		bus,
		logger,
		events,
		txs,
		getWallet: () => wallet,
	};
}

// ─── ensureWallet ────────────────────────────────────────────────────────────

test("ensureWallet — returns existing wallet", async () => {
	const existing = makeWallet();
	const { wallets, transactions, bus, logger, events } =
		createHarness(existing);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const result = await svc.ensureWallet("g", "u");
	assert.deepEqual(result, existing);
	assert.equal(events.length, 0);
});

test("ensureWallet — creates wallet and publishes event", async () => {
	const { wallets, transactions, bus, logger, events } = createHarness(null);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const result = await svc.ensureWallet("g", "u");
	assert.equal(result.balance, 0n);
	assert.equal(events.length, 1);
	assert.equal(events[0].name, "wallet.created");
});

// ─── deposit ─────────────────────────────────────────────────────────────────

test("deposit — adds balance and creates transaction", async () => {
	const { wallets, transactions, bus, logger, txs } = createHarness(
		makeWallet({ balance: 0n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const result = await svc.deposit("g", "u", 50n, "gift");
	assert.equal(result.balance, 50n);
	assert.equal(txs.length, 1);
	assert.equal(txs[0].amount, 50n);
});

test("deposit — rejects non-positive amount", async () => {
	const { wallets, transactions, bus, logger } = createHarness(makeWallet());
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.deposit("g", "u", 0n, "r"),
		(e) => {
			assert.ok(e instanceof ValidationError);
			return true;
		},
	);
	await assert.rejects(
		() => svc.deposit("g", "u", -1n, "r"),
		(e) => {
			assert.ok(e instanceof ValidationError);
			return true;
		},
	);
});

// ─── withdraw ────────────────────────────────────────────────────────────────

test("withdraw — deducts balance and creates transaction", async () => {
	const { wallets, transactions, bus, logger, txs } = createHarness(
		makeWallet({ balance: 100n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const result = await svc.withdraw("g", "u", 30n, "spend");
	assert.equal(result.balance, 70n);
	assert.equal(txs[0].amount, -30n);
});

test("withdraw — throws ConflictError on insufficient balance", async () => {
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ balance: 10n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.withdraw("g", "u", 50n, "spend"),
		(e) => {
			assert.ok(e instanceof ConflictError);
			return true;
		},
	);
});

test("withdraw — throws NotFoundError when no wallet", async () => {
	const { wallets, transactions, bus, logger } = createHarness(null);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.withdraw("g", "u", 10n, "r"),
		(e) => {
			assert.ok(e instanceof NotFoundError);
			return true;
		},
	);
});

// ─── transfer ────────────────────────────────────────────────────────────────

test("transfer — moves funds between wallets", async () => {
	let walletA: WalletDto = makeWallet({
		id: "w_a",
		userId: "u_a",
		balance: 100n,
	});
	let walletB: WalletDto | null = null;

	const wallets: WalletRepository = {
		findByGuildAndUser: async (_, userId) =>
			userId === "u_a" ? walletA : walletB,
		create: async (input) => {
			walletB = makeWallet({ id: "w_b", userId: input.userId, balance: 0n });
			return walletB;
		},
		adjustBalance: async (walletId, amount) => {
			if (walletId === "w_a") {
				walletA = { ...walletA, balance: walletA.balance + amount };
				return walletA;
			}
			if (walletB) {
				walletB = { ...walletB, balance: walletB.balance + amount };
				return walletB;
			}
			throw new Error("wallet not found");
		},
		atomicTransfer: async (_fromId, _toId, amount) => {
			if (walletA.balance < amount)
				throw new ConflictError("Insufficient balance", "INSUFFICIENT_BALANCE");
			walletA = { ...walletA, balance: walletA.balance - amount };
			if (!walletB)
				walletB = makeWallet({ id: "w_b", userId: "u_b", balance: 0n });
			walletB = { ...walletB, balance: walletB.balance + amount };
			return { from: walletA, to: walletB };
		},
		tryDebit: async (walletId, amount) => {
			if (walletId === "w_a") {
				if (walletA.balance < amount) return null;
				walletA = { ...walletA, balance: walletA.balance - amount };
				return walletA;
			}
			if (walletB && walletB.balance >= amount) {
				walletB = { ...walletB, balance: walletB.balance - amount };
				return walletB;
			}
			return null;
		},
		tryStampCooldown: async () => walletA,
		updateCooldowns: async () => walletA,
	};
	const txs: TransactionDto[] = [];
	const transactions: TransactionRepository = {
		create: async (input) => {
			const tx: TransactionDto = {
				id: `tx_${txs.length + 1}`,
				createdAt: NOW,
				...input,
			};
			txs.push(tx);
			return tx;
		},
		listByWallet: async () => txs,
	};
	const events: DomainEvent[] = [];
	const bus: EventBus = {
		publish: async (e) => {
			events.push(e);
		},
	};
	const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

	const svc = new EconomyService(wallets, transactions, bus, logger);
	const { from, to } = await svc.transfer("g", "u_a", "u_b", 40n, "gift");

	assert.equal(from.balance, 60n);
	assert.equal(to.balance, 40n);
	assert.ok(events.some((e) => e.name === "economy.transferred"));
});

test("transfer — rejects self-transfer", async () => {
	const { wallets, transactions, bus, logger } = createHarness(makeWallet());
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.transfer("g", "u", "u", 10n, "r"),
		(e) => {
			assert.ok(e instanceof ValidationError);
			return true;
		},
	);
});

// ─── getBalance ──────────────────────────────────────────────────────────────

test("getBalance — returns wallet balance", async () => {
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ balance: 250n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	assert.equal(await svc.getBalance("g", "u"), 250n);
});

test("getBalance — throws NotFoundError when no wallet", async () => {
	const { wallets, transactions, bus, logger } = createHarness(null);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.getBalance("g", "u"),
		(e) => {
			assert.ok(e instanceof NotFoundError);
			return true;
		},
	);
});

// ─── claimDaily ──────────────────────────────────────────────────────────────

test("claimDaily — awards daily amount and sets cooldown", async () => {
	const { wallets, transactions, bus, logger, txs, getWallet } = createHarness(
		makeWallet({ balance: 0n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const { wallet, amount } = await svc.claimDaily("g", "u", {
		dailyAmount: 100n,
	});
	assert.equal(amount, 100n);
	assert.equal(wallet.balance, 100n);
	assert.equal(txs.length, 1);
	assert.ok(getWallet()?.lastDailyAt instanceof Date);
});

test("claimDaily — throws CooldownError within 24h", async () => {
	const recentDaily = new Date(Date.now() - 10 * 60 * 1000);
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ lastDailyAt: recentDaily }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.claimDaily("g", "u", { dailyAmount: 100n }),
		(e) => {
			assert.ok(e instanceof CooldownError);
			assert.ok(e.remainingMs > 0);
			return true;
		},
	);
});

test("claimDaily — allows claim after 24h cooldown", async () => {
	const oldDaily = new Date(Date.now() - 25 * 60 * 60 * 1000);
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ balance: 50n, lastDailyAt: oldDaily }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const { amount } = await svc.claimDaily("g", "u", { dailyAmount: 100n });
	assert.equal(amount, 100n);
});

// ─── work ────────────────────────────────────────────────────────────────────

const WORK_SETTINGS = {
	workMin: 50n,
	workMax: 200n,
	dailyWorkLimit: 3,
	workDiminishingFactor: 0.5,
};

test("work — earns coins and sets cooldown", async () => {
	const { wallets, transactions, bus, logger, txs } = createHarness(
		makeWallet({ balance: 0n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const { earned, usesToday } = await svc.work("g", "u", WORK_SETTINGS);
	assert.ok(earned >= 50n && earned <= 200n);
	assert.equal(usesToday, 1);
	assert.equal(txs.length, 1);
});

test("work — throws CooldownError within 1h", async () => {
	const recentWork = new Date(Date.now() - 30 * 60 * 1000);
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ lastWorkAt: recentWork }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.work("g", "u", WORK_SETTINGS),
		(e) => {
			assert.ok(e instanceof CooldownError);
			return true;
		},
	);
});

test("work — throws ConflictError when daily limit reached", async () => {
	const today = new Date();
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ workUsesToday: 3, dailyLimitReset: today }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.work("g", "u", WORK_SETTINGS),
		(e) => {
			assert.ok(e instanceof ConflictError);
			assert.equal((e as ConflictError).code, "DAILY_LIMIT_REACHED");
			return true;
		},
	);
});

// ─── crime ───────────────────────────────────────────────────────────────────

const CRIME_SETTINGS = {
	crimeMin: 100n,
	crimeMax: 500n,
	dailyCrimeLimit: 2,
	crimeDiminishingFactor: 0.5,
};

test("crime — throws CooldownError within 2h", async () => {
	const recentCrime = new Date(Date.now() - 60 * 60 * 1000);
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ lastCrimeAt: recentCrime }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.crime("g", "u", CRIME_SETTINGS),
		(e) => {
			assert.ok(e instanceof CooldownError);
			return true;
		},
	);
});

test("crime — throws ConflictError when daily crime limit reached", async () => {
	const today = new Date();
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ crimeUsesToday: 2, dailyLimitReset: today }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.crime("g", "u", CRIME_SETTINGS),
		(e) => {
			assert.ok(e instanceof ConflictError);
			assert.equal((e as ConflictError).code, "DAILY_LIMIT_REACHED");
			return true;
		},
	);
});

test("crime — returns success or caught result", async () => {
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ balance: 1000n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const result = await svc.crime("g", "u", CRIME_SETTINGS);
	assert.ok(typeof result.success === "boolean");
	assert.ok(result.amount >= 0n);
});

// ─── rob ─────────────────────────────────────────────────────────────────────

test("rob — throws ValidationError when targeting self", async () => {
	const { wallets, transactions, bus, logger } = createHarness(makeWallet());
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.rob("g", "u", "u", { robMinTargetBalance: 100n }),
		(e) => {
			assert.ok(e instanceof ValidationError);
			return true;
		},
	);
});

test("rob — throws CooldownError within 4h", async () => {
	const recentRob = new Date(Date.now() - 2 * 60 * 60 * 1000);
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ lastRobAt: recentRob }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.rob("g", "target", "u", { robMinTargetBalance: 100n }),
		(e) => {
			assert.ok(e instanceof CooldownError);
			return true;
		},
	);
});

test("rob — throws ConflictError when target balance too low", async () => {
	const targetWallet: WalletDto = makeWallet({
		id: "w_target",
		userId: "target",
		balance: 10n,
	});
	const robberWallet = makeWallet({
		id: "w_robber",
		userId: "robber",
		balance: 500n,
	});

	const wallets: WalletRepository = {
		findByGuildAndUser: async (_, userId) =>
			userId === "robber" ? robberWallet : targetWallet,
		create: async () => robberWallet,
		adjustBalance: async () => robberWallet,
		tryDebit: async () => robberWallet,
		tryStampCooldown: async () => robberWallet,
		atomicTransfer: async () => {
			throw new Error("not called");
		},
		updateCooldowns: async () => robberWallet,
	};
	const transactions: TransactionRepository = {
		create: async () => ({
			id: "t1",
			walletId: "w",
			amount: 0n,
			reason: "",
			createdAt: NOW,
		}),
		listByWallet: async () => [],
	};
	const bus: EventBus = { publish: async () => {} };
	const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

	const svc = new EconomyService(wallets, transactions, bus, logger);
	await assert.rejects(
		() => svc.rob("g", "robber", "target", { robMinTargetBalance: 100n }),
		(e) => {
			assert.ok(e instanceof ConflictError);
			assert.equal((e as ConflictError).code, "TARGET_BALANCE_TOO_LOW");
			return true;
		},
	);
});

// ─── coinflip ────────────────────────────────────────────────────────────────

const GAMBLE = { gamblingMinBet: 10n, gamblingMaxBet: 10000n };

test("coinflip — win or lose based on random result", async () => {
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ balance: 1000n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const result = await svc.coinflip("g", "u", "heads", 100n, GAMBLE);
	assert.ok(typeof result.won === "boolean");
	assert.ok(result.result === "heads" || result.result === "tails");
});

test("coinflip — throws ValidationError below min bet", async () => {
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ balance: 1000n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.coinflip("g", "u", "heads", 1n, GAMBLE),
		(e) => {
			assert.ok(e instanceof ValidationError);
			return true;
		},
	);
});

test("coinflip — throws ConflictError on insufficient balance", async () => {
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ balance: 5n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.coinflip("g", "u", "heads", 100n, GAMBLE),
		(e) => {
			assert.ok(e instanceof ConflictError);
			return true;
		},
	);
});

// ─── slots ───────────────────────────────────────────────────────────────────

test("slots — returns 3 reels and win/lose result", async () => {
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ balance: 1000n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const result = await svc.slots("g", "u", 50n, GAMBLE);
	assert.equal(result.reels.length, 3);
	assert.ok(typeof result.won === "boolean");
	assert.ok(result.multiplier >= 0);
});

test("slots — throws ValidationError on invalid bet amount", async () => {
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ balance: 1000n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.slots("g", "u", 1n, GAMBLE),
		(e) => {
			assert.ok(e instanceof ValidationError);
			return true;
		},
	);
});

// ─── roulette ────────────────────────────────────────────────────────────────

test("roulette — accepts red/black/even/odd bets", async () => {
	for (const bet of ["red", "black", "even", "odd"]) {
		const w = makeWallet({ id: `w_${bet}`, balance: 10000n });
		const h = createHarness(w);
		const s = new EconomyService(h.wallets, h.transactions, h.bus, h.logger);
		const result = await s.roulette("g", "u", bet, 100n, GAMBLE);
		assert.ok(typeof result.won === "boolean");
		assert.ok(result.number >= 0 && result.number <= 36);
	}
});

test("roulette — accepts number bets 0-36", async () => {
	const w = makeWallet({ balance: 10000n });
	const { wallets, transactions, bus, logger } = createHarness(w);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const result = await svc.roulette("g", "u", "17", 10n, GAMBLE);
	assert.ok(typeof result.won === "boolean");
	assert.equal(result.multiplier, result.won ? 36 : 0);
});

test("roulette — throws ValidationError on invalid bet type", async () => {
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({ balance: 1000n }),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	await assert.rejects(
		() => svc.roulette("g", "u", "purple", 50n, GAMBLE),
		(e) => {
			assert.ok(e instanceof ValidationError);
			return true;
		},
	);
});

// BUG-R16: work() diminishing factor — when workUsesToday=1 and factor=0,
// earned must be 0n (Math.pow(0,1)=0). Validates the diminish formula is applied.
test("work — BUG-R16: diminishing factor of 0 produces 0 earnings on subsequent uses", async () => {
	const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
	const { wallets, transactions, bus, logger } = createHarness(
		makeWallet({
			workUsesToday: 1,
			dailyLimitReset: new Date(),
			lastWorkAt: twoHoursAgo,
			balance: 0n,
		}),
	);
	const svc = new EconomyService(wallets, transactions, bus, logger);

	const { earned } = await svc.work("g", "u", {
		workMin: 100n,
		workMax: 200n,
		dailyWorkLimit: 3,
		workDiminishingFactor: 0,
	});
	assert.equal(earned, 0n);
});

// BUG-R17: rob() uses strict < for balance check — target balance exactly equal to
// robMinTargetBalance must be allowed (not throw TARGET_BALANCE_TOO_LOW)
test("rob — BUG-R17: target balance exactly at minimum is allowed (strict < boundary)", async () => {
	const NOW_LOCAL = new Date("2024-01-01T00:00:00Z");
	let robberWallet: WalletDto = makeWallet({
		id: "w_rob",
		userId: "u_rob",
		balance: 1000n,
	});
	const targetWallet: WalletDto = makeWallet({
		id: "w_tgt",
		userId: "u_tgt",
		balance: 100n,
	});

	const wallets: WalletRepository = {
		findByGuildAndUser: async (_, userId) =>
			userId === "u_rob" ? robberWallet : targetWallet,
		create: async () => robberWallet,
		adjustBalance: async () => robberWallet,
		tryDebit: async () => robberWallet,
		tryStampCooldown: async () => robberWallet,
		atomicTransfer: async (_fromId, _toId, amount) => ({
			from: { ...robberWallet, balance: robberWallet.balance - amount },
			to: { ...targetWallet, balance: targetWallet.balance + amount },
		}),
		updateCooldowns: async () => {
			robberWallet = { ...robberWallet };
			return robberWallet;
		},
	};
	const txs: TransactionDto[] = [];
	const transactions: TransactionRepository = {
		create: async (input) => {
			const tx: TransactionDto = {
				id: `t${txs.length + 1}`,
				createdAt: NOW_LOCAL,
				...input,
			};
			txs.push(tx);
			return tx;
		},
		listByWallet: async () => txs,
	};
	const bus: EventBus = { publish: async () => {} };
	const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

	const svc = new EconomyService(wallets, transactions, bus, logger);
	// target balance (100n) === robMinTargetBalance (100n) → strict < is false → no throw
	await assert.doesNotReject(() =>
		svc.rob("g", "u_rob", "u_tgt", { robMinTargetBalance: 100n }),
	);
});

test("rob — target balance one below minimum throws TARGET_BALANCE_TOO_LOW", async () => {
	const robberWallet = makeWallet({
		id: "w_rob",
		userId: "u_rob",
		balance: 1000n,
	});
	const targetWallet = makeWallet({
		id: "w_tgt",
		userId: "u_tgt",
		balance: 99n,
	});

	const wallets: WalletRepository = {
		findByGuildAndUser: async (_, userId) =>
			userId === "u_rob" ? robberWallet : targetWallet,
		create: async () => robberWallet,
		adjustBalance: async () => robberWallet,
		tryDebit: async () => robberWallet,
		tryStampCooldown: async () => robberWallet,
		atomicTransfer: async () => {
			throw new Error("should not reach");
		},
		updateCooldowns: async () => robberWallet,
	};
	const transactions: TransactionRepository = {
		create: async () => ({
			id: "t1",
			walletId: "w",
			amount: 0n,
			reason: "",
			createdAt: NOW,
		}),
		listByWallet: async () => [],
	};
	const bus: EventBus = { publish: async () => {} };
	const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

	const svc = new EconomyService(wallets, transactions, bus, logger);
	await assert.rejects(
		() => svc.rob("g", "u_rob", "u_tgt", { robMinTargetBalance: 100n }),
		(e) => {
			assert.ok(e instanceof ConflictError);
			assert.equal((e as ConflictError).code, "TARGET_BALANCE_TOO_LOW");
			return true;
		},
	);
});

// BUG-B regression: a failed transfer after the cooldown was stamped burned the
// 4h rob cooldown. Fixed: rob() rolls the stamp back to its previous value.
test("rob — BUG-B: transfer failure rolls back the cooldown stamp", async () => {
	const robberWallet = makeWallet({
		id: "w_rob",
		userId: "u_rob",
		balance: 1000n,
	});
	const targetWallet = makeWallet({
		id: "w_tgt",
		userId: "u_tgt",
		balance: 1000n,
	});
	let rollback: WalletCooldownUpdate | null = null;

	const wallets: WalletRepository = {
		findByGuildAndUser: async (_, userId) =>
			userId === "u_rob" ? robberWallet : targetWallet,
		create: async () => robberWallet,
		adjustBalance: async () => robberWallet,
		tryDebit: async () => robberWallet,
		// Cooldown is successfully claimed (stamped to NOW)...
		tryStampCooldown: async () => ({ ...robberWallet, lastRobAt: NOW }),
		// ...but the transfer then fails for both branches.
		atomicTransfer: async () => {
			throw new ConflictError("Insufficient balance", "INSUFFICIENT_BALANCE");
		},
		updateCooldowns: async (_id, data) => {
			rollback = data;
			return robberWallet;
		},
	};
	const transactions: TransactionRepository = {
		create: async () => ({
			id: "t1",
			walletId: "w",
			amount: 0n,
			reason: "",
			createdAt: NOW,
		}),
		listByWallet: async () => [],
	};
	const bus: EventBus = { publish: async () => {} };
	const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

	const svc = new EconomyService(wallets, transactions, bus, logger);
	await assert.rejects(() =>
		svc.rob("g", "u_rob", "u_tgt", { robMinTargetBalance: 100n }),
	);
	assert.ok(rollback, "cooldown rollback must be attempted on transfer failure");
	assert.equal(
		(rollback as WalletCooldownUpdate).lastRobAt ?? null,
		robberWallet.lastRobAt ?? null,
		"cooldown must be restored to its previous value",
	);
});
