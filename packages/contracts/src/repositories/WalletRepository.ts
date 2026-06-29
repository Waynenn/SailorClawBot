import type { SnowflakeId, WalletDto } from "../types/index.js";

export interface WalletCooldownUpdate {
	lastDailyAt?: Date | null;
	lastWorkAt?: Date | null;
	lastCrimeAt?: Date | null;
	lastRobAt?: Date | null;
	workUsesToday?: number;
	crimeUsesToday?: number;
	dailyLimitReset?: Date | null;
}

export interface WalletRepository {
	findByGuildAndUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<WalletDto | null>;
	create(input: Pick<WalletDto, "guildId" | "userId">): Promise<WalletDto>;
	adjustBalance(walletId: string, amount: bigint): Promise<WalletDto>;
	/**
	 * Atomically debit `amount` only if the balance covers it, via a single
	 * conditional UPDATE (row-locked). Returns the updated wallet, or null when
	 * the balance is insufficient. Use for all spend paths to prevent concurrent
	 * overspend / negative balances.
	 */
	tryDebit(walletId: string, amount: bigint): Promise<WalletDto | null>;
	/**
	 * Atomically claim a cooldown slot: set `field` to now only if it is null or
	 * older than `cutoff`, via a single conditional UPDATE. Returns the updated
	 * wallet, or null when the cooldown is still active. Prevents concurrent
	 * double-claims of timed rewards (daily/work/crime/rob).
	 */
	tryStampCooldown(
		walletId: string,
		field: "lastDailyAt" | "lastWorkAt" | "lastCrimeAt" | "lastRobAt",
		cutoff: Date,
	): Promise<WalletDto | null>;
	atomicTransfer(
		fromWalletId: string,
		toWalletId: string,
		amount: bigint,
	): Promise<{ from: WalletDto; to: WalletDto }>;
	updateCooldowns(
		walletId: string,
		data: WalletCooldownUpdate,
	): Promise<WalletDto>;
}
