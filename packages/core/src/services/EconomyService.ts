import type {
	SnowflakeId,
	TransactionDto,
	TransactionRepository,
	WalletDto,
	WalletRepository,
} from "@sailorclawbot/contracts";
import { EventNames } from "@sailorclawbot/contracts";
import { ConflictError } from "../common/errors/ConflictError.js";
import { CooldownError } from "../common/errors/CooldownError.js";
import { NotFoundError } from "../common/errors/NotFoundError.js";
import { ValidationError } from "../common/errors/ValidationError.js";
import type { EventBus } from "../common/events/EventBus.js";
import type { Logger } from "../common/logging/Logger.js";

// ─── Settings types ────────────────────────────────────────────────────────────

export interface DailySettings {
	dailyAmount: bigint;
}
export interface WorkSettings {
	workMin: bigint;
	workMax: bigint;
	dailyWorkLimit: number;
	workDiminishingFactor: number;
}
export interface CrimeSettings {
	crimeMin: bigint;
	crimeMax: bigint;
	dailyCrimeLimit: number;
	crimeDiminishingFactor: number;
}
export interface RobSettings {
	robMinTargetBalance: bigint;
}
export interface GamblingSettings {
	gamblingMinBet: bigint;
	gamblingMaxBet: bigint;
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface DailyResult {
	wallet: WalletDto;
	amount: bigint;
}
export interface WorkResult {
	wallet: WalletDto;
	earned: bigint;
	usesToday: number;
}
export interface CrimeResult {
	wallet: WalletDto;
	amount: bigint;
	success: boolean;
}
export interface RobResult {
	wallet: WalletDto;
	stolen: bigint;
	backfired: boolean;
	fined: bigint;
}
export interface CoinflipResult {
	wallet: WalletDto;
	won: boolean;
	result: "heads" | "tails";
}
export interface SlotsResult {
	wallet: WalletDto;
	reels: string[];
	multiplier: number;
	won: boolean;
	payout: bigint;
}
export interface RouletteResult {
	wallet: WalletDto;
	number: number;
	color: "red" | "black" | "green";
	won: boolean;
	payout: bigint;
	multiplier: number;
}

// ─── Slot helpers ─────────────────────────────────────────────────────────────

const SLOT_PAYOUTS: Record<string, number> = {
	"💎💎💎": 50,
	"🔔🔔🔔": 10,
	"🍇🍇🍇": 5,
	"🍋🍋🍋": 3,
	"🍒🍒🍒": 2,
};

function spinReel(): string {
	const r = Math.floor(Math.random() * 15);
	if (r < 5) return "🍒";
	if (r < 9) return "🍋";
	if (r < 12) return "🍇";
	if (r < 14) return "🔔";
	return "💎";
}

// ─── Roulette helpers ─────────────────────────────────────────────────────────

const RED_NUMBERS = new Set([
	1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function getRouletteColor(num: number): "red" | "black" | "green" {
	if (num === 0) return "green";
	return RED_NUMBERS.has(num) ? "red" : "black";
}

// ─── Daily limit helpers ──────────────────────────────────────────────────────

function isSameUtcDay(d1: Date, d2: Date): boolean {
	return (
		d1.getUTCFullYear() === d2.getUTCFullYear() &&
		d1.getUTCMonth() === d2.getUTCMonth() &&
		d1.getUTCDate() === d2.getUTCDate()
	);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class EconomyService {
	public constructor(
		private readonly wallets: WalletRepository,
		private readonly transactions: TransactionRepository,
		private readonly bus: EventBus,
		private readonly logger: Logger,
	) {}

	// ── Existing core methods ────────────────────────────────────────────────────

	public async ensureWallet(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<WalletDto> {
		const existing = await this.wallets.findByGuildAndUser(guildId, userId);
		if (existing) return existing;

		const wallet = await this.wallets.create({ guildId, userId });
		this.logger.info("Wallet created", { guildId, userId });
		await this.bus.publish({
			name: EventNames.WalletCreated,
			payload: { guildId, userId, walletId: wallet.id },
			occurredAt: new Date(),
		});
		return wallet;
	}

	public async getBalance(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<bigint> {
		const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
		if (!wallet) throw new NotFoundError("Wallet", `${guildId}:${userId}`);
		return wallet.balance;
	}

	public async deposit(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		amount: bigint,
		reason: string,
	): Promise<WalletDto> {
		if (amount <= 0n)
			throw new ValidationError("Deposit amount must be positive", "amount");
		if (!reason || reason.trim().length === 0)
			throw new ValidationError("Reason required", "reason");

		const wallet = await this.ensureWallet(guildId, userId);
		const updated = await this.wallets.adjustBalance(wallet.id, amount);
		await this.transactions.create({ walletId: wallet.id, amount, reason });
		this.logger.info("Deposit", { guildId, userId, amount: amount.toString() });
		await this.bus.publish({
			name: EventNames.WalletBalanceUpdated,
			payload: {
				guildId,
				userId,
				walletId: wallet.id,
				delta: amount,
				balance: updated.balance,
			},
			occurredAt: new Date(),
		});
		return updated;
	}

	public async withdraw(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		amount: bigint,
		reason: string,
	): Promise<WalletDto> {
		if (amount <= 0n)
			throw new ValidationError("Withdrawal amount must be positive", "amount");
		if (!reason || reason.trim().length === 0)
			throw new ValidationError("Reason required", "reason");

		const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
		if (!wallet) throw new NotFoundError("Wallet", `${guildId}:${userId}`);

		const updated = await this.wallets.tryDebit(wallet.id, amount);
		if (!updated)
			throw new ConflictError("Insufficient balance", "INSUFFICIENT_BALANCE");
		await this.transactions.create({
			walletId: wallet.id,
			amount: -amount,
			reason,
		});
		this.logger.info("Withdrawal", {
			guildId,
			userId,
			amount: amount.toString(),
		});
		await this.bus.publish({
			name: EventNames.WalletBalanceUpdated,
			payload: {
				guildId,
				userId,
				walletId: wallet.id,
				delta: -amount,
				balance: updated.balance,
			},
			occurredAt: new Date(),
		});
		return updated;
	}

	public async transfer(
		guildId: SnowflakeId,
		fromUserId: SnowflakeId,
		toUserId: SnowflakeId,
		amount: bigint,
		reason: string,
	): Promise<{ from: WalletDto; to: WalletDto }> {
		if (amount <= 0n)
			throw new ValidationError("Transfer amount must be positive", "amount");
		if (fromUserId === toUserId)
			throw new ValidationError("Cannot transfer to yourself", "toUserId");
		if (!reason || reason.trim().length === 0)
			throw new ValidationError("Reason required", "reason");

		const fromWallet = await this.wallets.findByGuildAndUser(
			guildId,
			fromUserId,
		);
		if (!fromWallet)
			throw new NotFoundError("Wallet", `${guildId}:${fromUserId}`);
		const toWallet = await this.ensureWallet(guildId, toUserId);

		const { from, to } = await this.wallets.atomicTransfer(
			fromWallet.id,
			toWallet.id,
			amount,
		);

		await Promise.allSettled([
			this.transactions.create({
				walletId: fromWallet.id,
				amount: -amount,
				reason: `Transfer to ${toUserId}: ${reason}`,
			}),
			this.transactions.create({
				walletId: toWallet.id,
				amount,
				reason: `Transfer from ${fromUserId}: ${reason}`,
			}),
		]);

		this.logger.info("Transfer", {
			guildId,
			fromUserId,
			toUserId,
			amount: amount.toString(),
		});
		await this.bus.publish({
			name: EventNames.EconomyTransferred,
			payload: { guildId, fromUserId, toUserId, amount, reason },
			occurredAt: new Date(),
		});
		return { from, to };
	}

	public async getTransactionHistory(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<TransactionDto[]> {
		const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
		if (!wallet) throw new NotFoundError("Wallet", `${guildId}:${userId}`);
		return this.transactions.listByWallet(wallet.id);
	}

	// ── Income commands ──────────────────────────────────────────────────────────

	public async claimDaily(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		settings: DailySettings,
	): Promise<DailyResult> {
		const wallet = await this.ensureWallet(guildId, userId);

		const cooldownMs = 24 * 60 * 60 * 1000;
		const cutoff = new Date(Date.now() - cooldownMs);
		// Atomically claim the daily slot; a losing concurrent call gets null.
		const claimed = await this.wallets.tryStampCooldown(
			wallet.id,
			"lastDailyAt",
			cutoff,
		);
		if (!claimed) {
			const elapsed = wallet.lastDailyAt
				? Date.now() - wallet.lastDailyAt.getTime()
				: 0;
			throw new CooldownError(Math.max(cooldownMs - elapsed, 1000));
		}

		const now = new Date();
		const updated = await this.wallets.adjustBalance(
			wallet.id,
			settings.dailyAmount,
		);
		await this.transactions.create({
			walletId: wallet.id,
			amount: settings.dailyAmount,
			reason: "Daily reward",
		});

		this.logger.info("Daily claimed", {
			guildId,
			userId,
			amount: settings.dailyAmount.toString(),
		});
		await this.bus.publish({
			name: EventNames.EconomyDailyRewardClaimed,
			payload: { guildId, userId, amount: settings.dailyAmount },
			occurredAt: now,
		});

		return { wallet: updated, amount: settings.dailyAmount };
	}

	public async work(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		settings: WorkSettings,
	): Promise<WorkResult> {
		const wallet = await this.ensureWallet(guildId, userId);

		const now = new Date();
		const needsReset =
			!wallet.dailyLimitReset || !isSameUtcDay(wallet.dailyLimitReset, now);
		const currentUses = needsReset ? 0 : wallet.workUsesToday;

		if (currentUses >= settings.dailyWorkLimit) {
			throw new ConflictError(
				"Daily work limit reached",
				"DAILY_LIMIT_REACHED",
			);
		}

		const cooldownMs = 60 * 60 * 1000;
		const claimed = await this.wallets.tryStampCooldown(
			wallet.id,
			"lastWorkAt",
			new Date(Date.now() - cooldownMs),
		);
		if (!claimed) {
			const elapsed = wallet.lastWorkAt
				? Date.now() - wallet.lastWorkAt.getTime()
				: 0;
			throw new CooldownError(Math.max(cooldownMs - elapsed, 1000));
		}

		const range = Number(settings.workMax - settings.workMin);
		const base = settings.workMin + BigInt(Math.floor(Math.random() * range));
		const diminish = settings.workDiminishingFactor ** currentUses;
		const earned = BigInt(Math.floor(Number(base) * diminish));

		await this.wallets.updateCooldowns(wallet.id, {
			workUsesToday: currentUses + 1,
			...(needsReset ? { dailyLimitReset: now, crimeUsesToday: 0 } : {}),
		});
		const updated = await this.wallets.adjustBalance(wallet.id, earned);
		await this.transactions.create({
			walletId: wallet.id,
			amount: earned,
			reason: "Work",
		});

		return { wallet: updated, earned, usesToday: currentUses + 1 };
	}

	public async crime(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		settings: CrimeSettings,
	): Promise<CrimeResult> {
		const wallet = await this.ensureWallet(guildId, userId);

		const now = new Date();
		const needsReset =
			!wallet.dailyLimitReset || !isSameUtcDay(wallet.dailyLimitReset, now);
		const currentUses = needsReset ? 0 : wallet.crimeUsesToday;

		if (currentUses >= settings.dailyCrimeLimit) {
			throw new ConflictError(
				"Daily crime limit reached",
				"DAILY_LIMIT_REACHED",
			);
		}

		const cooldownMs = 2 * 60 * 60 * 1000;
		const claimed = await this.wallets.tryStampCooldown(
			wallet.id,
			"lastCrimeAt",
			new Date(Date.now() - cooldownMs),
		);
		if (!claimed) {
			const elapsed = wallet.lastCrimeAt
				? Date.now() - wallet.lastCrimeAt.getTime()
				: 0;
			throw new CooldownError(Math.max(cooldownMs - elapsed, 1000));
		}

		const success = Math.random() > 0.25;
		let amount: bigint;

		if (success) {
			const range = Number(settings.crimeMax - settings.crimeMin);
			const base =
				settings.crimeMin + BigInt(Math.floor(Math.random() * range));
			const diminish = settings.crimeDiminishingFactor ** currentUses;
			amount = BigInt(Math.floor(Number(base) * diminish));
		} else {
			amount =
				wallet.balance < settings.crimeMin ? wallet.balance : settings.crimeMin;
		}

		const afterCooldown = await this.wallets.updateCooldowns(wallet.id, {
			crimeUsesToday: currentUses + 1,
			...(needsReset ? { dailyLimitReset: now, workUsesToday: 0 } : {}),
		});

		let updatedWallet = afterCooldown;
		if (success) {
			updatedWallet = await this.wallets.adjustBalance(wallet.id, amount);
			await this.transactions.create({
				walletId: wallet.id,
				amount,
				reason: "Crime",
			});
		} else if (amount > 0n) {
			// Debit the fine atomically; if the balance fell below it concurrently,
			// take nothing rather than driving the wallet negative.
			const debited = await this.wallets.tryDebit(wallet.id, amount);
			if (debited) {
				updatedWallet = debited;
				await this.transactions.create({
					walletId: wallet.id,
					amount: -amount,
					reason: "Crime fine",
				});
			} else {
				amount = 0n;
			}
		}

		return { wallet: updatedWallet, amount, success };
	}

	public async rob(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		targetId: SnowflakeId,
		settings: RobSettings,
	): Promise<RobResult> {
		if (userId === targetId)
			throw new ValidationError("Cannot rob yourself", "targetId");

		const [robberWallet, targetWallet] = await Promise.all([
			this.ensureWallet(guildId, userId),
			this.wallets.findByGuildAndUser(guildId, targetId),
		]);

		if (!targetWallet)
			throw new NotFoundError("Wallet", `${guildId}:${targetId}`);
		if (targetWallet.balance < settings.robMinTargetBalance) {
			throw new ConflictError(
				"Target has insufficient balance to rob",
				"TARGET_BALANCE_TOO_LOW",
			);
		}

		const backfired = Math.random() < 0.3;
		let stolen = 0n;
		let fined = 0n;

		// Atomically claim the rob cooldown before transferring; a losing concurrent
		// call gets null and is rejected (prevents double-rob).
		const cooldownMs = 4 * 60 * 60 * 1000;
		const claimed = await this.wallets.tryStampCooldown(
			robberWallet.id,
			"lastRobAt",
			new Date(Date.now() - cooldownMs),
		);
		if (!claimed) {
			const elapsed = robberWallet.lastRobAt
				? Date.now() - robberWallet.lastRobAt.getTime()
				: 0;
			throw new CooldownError(Math.max(cooldownMs - elapsed, 1000));
		}
		let updatedWallet = claimed;

		// The cooldown is already claimed. If a transfer fails (e.g. the source
		// balance dropped concurrently below the computed amount), roll the
		// cooldown stamp back to its previous value so the attempt isn't burned
		// for 4h on a transient failure, then re-throw.
		try {
			if (backfired) {
				const finePercent = 10 + Math.floor(Math.random() * 11);
				fined = (robberWallet.balance * BigInt(finePercent)) / 100n;
				if (fined > 0n) {
					const { from } = await this.wallets.atomicTransfer(
						robberWallet.id,
						targetWallet.id,
						fined,
					);
					updatedWallet = from;
					await Promise.allSettled([
						this.transactions.create({
							walletId: robberWallet.id,
							amount: -fined,
							reason: `Rob backfire (paid to ${targetId})`,
						}),
						this.transactions.create({
							walletId: targetWallet.id,
							amount: fined,
							reason: `Rob backfire (received from ${userId})`,
						}),
					]);
				}
			} else {
				const stealPercent = 10 + Math.floor(Math.random() * 21);
				stolen = (targetWallet.balance * BigInt(stealPercent)) / 100n;
				if (stolen > 0n) {
					const { to } = await this.wallets.atomicTransfer(
						targetWallet.id,
						robberWallet.id,
						stolen,
					);
					updatedWallet = to;
					await Promise.allSettled([
						this.transactions.create({
							walletId: targetWallet.id,
							amount: -stolen,
							reason: `Robbed by ${userId}`,
						}),
						this.transactions.create({
							walletId: robberWallet.id,
							amount: stolen,
							reason: `Robbed ${targetId}`,
						}),
					]);
				}
			}
		} catch (err) {
			await this.wallets
				.updateCooldowns(robberWallet.id, {
					lastRobAt: robberWallet.lastRobAt ?? null,
				})
				.catch(() => null);
			throw err;
		}

		return { wallet: updatedWallet, stolen, backfired, fined };
	}

	// ── Gambling ─────────────────────────────────────────────────────────────────

	public async coinflip(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		choice: "heads" | "tails",
		amount: bigint,
		settings: GamblingSettings,
	): Promise<CoinflipResult> {
		if (amount < settings.gamblingMinBet) {
			throw new ValidationError(
				`Minimum bet is ${settings.gamblingMinBet}`,
				"amount",
			);
		}
		if (amount > settings.gamblingMaxBet) {
			throw new ValidationError(
				`Maximum bet is ${settings.gamblingMaxBet}`,
				"amount",
			);
		}

		const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
		if (!wallet) throw new NotFoundError("Wallet", `${guildId}:${userId}`);

		// Reserve the stake atomically up front so concurrent bets can't overspend.
		const debited = await this.wallets.tryDebit(wallet.id, amount);
		if (!debited)
			throw new ConflictError("Insufficient balance", "INSUFFICIENT_BALANCE");

		const result: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails";
		const won = result === choice;
		const delta = won ? amount : -amount;

		let updated = debited;
		if (won) {
			// Return the staked amount plus equal winnings.
			updated = await this.wallets.adjustBalance(wallet.id, amount * 2n);
		}
		await this.transactions.create({
			walletId: wallet.id,
			amount: delta,
			reason: won
				? `Coinflip win (${choice})`
				: `Coinflip loss (chose ${choice}, got ${result})`,
		});

		return { wallet: updated, won, result };
	}

	public async slots(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		amount: bigint,
		settings: GamblingSettings,
	): Promise<SlotsResult> {
		if (amount < settings.gamblingMinBet) {
			throw new ValidationError(
				`Minimum bet is ${settings.gamblingMinBet}`,
				"amount",
			);
		}
		if (amount > settings.gamblingMaxBet) {
			throw new ValidationError(
				`Maximum bet is ${settings.gamblingMaxBet}`,
				"amount",
			);
		}

		const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
		if (!wallet) throw new NotFoundError("Wallet", `${guildId}:${userId}`);

		const debited = await this.wallets.tryDebit(wallet.id, amount);
		if (!debited)
			throw new ConflictError("Insufficient balance", "INSUFFICIENT_BALANCE");

		const reels = [spinReel(), spinReel(), spinReel()];
		const key = reels.join("");
		const multiplier = SLOT_PAYOUTS[key] ?? 0;
		const payout = amount * BigInt(multiplier);
		const net = multiplier > 0 ? payout - amount : -amount;

		let updated = debited;
		if (multiplier > 0) {
			updated = await this.wallets.adjustBalance(wallet.id, payout);
		}
		await this.transactions.create({
			walletId: wallet.id,
			amount: net,
			reason:
				multiplier > 0
					? `Slots win ${key} (${multiplier}x)`
					: `Slots loss ${key}`,
		});

		return { wallet: updated, reels, multiplier, won: multiplier > 0, payout };
	}

	public async roulette(
		guildId: SnowflakeId,
		userId: SnowflakeId,
		bet: string,
		amount: bigint,
		settings: GamblingSettings,
	): Promise<RouletteResult> {
		if (amount < settings.gamblingMinBet) {
			throw new ValidationError(
				`Minimum bet is ${settings.gamblingMinBet}`,
				"amount",
			);
		}
		if (amount > settings.gamblingMaxBet) {
			throw new ValidationError(
				`Maximum bet is ${settings.gamblingMaxBet}`,
				"amount",
			);
		}

		// Validate the bet BEFORE debiting so an invalid bet can't lose the stake.
		const lowerBet = bet.toLowerCase();
		const isColor = lowerBet === "red" || lowerBet === "black";
		const isParity = lowerBet === "even" || lowerBet === "odd";
		let betNum = -1;
		if (!isColor && !isParity) {
			betNum = parseInt(lowerBet, 10);
			if (Number.isNaN(betNum) || betNum < 0 || betNum > 36) {
				throw new ValidationError(
					"Bet must be: red, black, even, odd, or a number 0–36",
					"bet",
				);
			}
		}

		const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
		if (!wallet) throw new NotFoundError("Wallet", `${guildId}:${userId}`);

		const debited = await this.wallets.tryDebit(wallet.id, amount);
		if (!debited)
			throw new ConflictError("Insufficient balance", "INSUFFICIENT_BALANCE");

		const number = Math.floor(Math.random() * 37);
		const color = getRouletteColor(number);

		let won = false;
		let multiplier = 0;

		if (isColor) {
			won = color === lowerBet;
			multiplier = won ? 2 : 0;
		} else if (isParity) {
			if (number !== 0)
				won = lowerBet === "even" ? number % 2 === 0 : number % 2 !== 0;
			multiplier = won ? 2 : 0;
		} else {
			won = betNum === number;
			multiplier = won ? 36 : 0;
		}

		const payout = amount * BigInt(multiplier);
		const net = won ? payout - amount : -amount;

		let updated = debited;
		if (won) {
			updated = await this.wallets.adjustBalance(wallet.id, payout);
		}
		await this.transactions.create({
			walletId: wallet.id,
			amount: net,
			reason: won
				? `Roulette win on ${number} (${color}, bet: ${bet}, ${multiplier}x)`
				: `Roulette loss (${number} ${color}, bet: ${bet})`,
		});

		return { wallet: updated, number, color, won, payout, multiplier };
	}
}
