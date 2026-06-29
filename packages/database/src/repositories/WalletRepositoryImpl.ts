import type { PrismaClient } from "@prisma/client";
import type {
	SnowflakeId,
	WalletCooldownUpdate,
	WalletDto,
	WalletRepository,
} from "@sailorclawbot/contracts";
import { ConflictError, ValidationError } from "@sailorclawbot/core";
import { toWalletDto } from "./mappers.js";
import { translatePrismaError } from "./prisma-errors.js";

export class WalletRepositoryImpl implements WalletRepository {
	public constructor(private readonly db: PrismaClient) {}

	public async findByGuildAndUser(
		guildId: SnowflakeId,
		userId: SnowflakeId,
	): Promise<WalletDto | null> {
		if (!guildId || guildId.trim().length === 0) {
			throw new ValidationError("Guild ID cannot be empty", "guildId");
		}
		if (!userId || userId.trim().length === 0) {
			throw new ValidationError("User ID cannot be empty", "userId");
		}
		const row = await this.db.wallet.findUnique({
			where: { guildId_userId: { guildId, userId } },
		});
		return row ? toWalletDto(row) : null;
	}

	public async create(
		input: Pick<WalletDto, "guildId" | "userId">,
	): Promise<WalletDto> {
		if (!input.guildId || input.guildId.trim().length === 0) {
			throw new ValidationError("Guild ID is required", "guildId");
		}
		if (!input.userId || input.userId.trim().length === 0) {
			throw new ValidationError("User ID is required", "userId");
		}

		try {
			const row = await this.db.wallet.create({
				data: { guildId: input.guildId, userId: input.userId },
			});
			return toWalletDto(row);
		} catch (error) {
			translatePrismaError(error, "create wallet");
		}
	}

	public async adjustBalance(
		walletId: string,
		amount: bigint,
	): Promise<WalletDto> {
		if (!walletId || walletId.trim().length === 0) {
			throw new ValidationError("Wallet ID cannot be empty", "walletId");
		}

		try {
			const row = await this.db.wallet.update({
				where: { id: walletId },
				data: { balance: { increment: amount } },
			});
			return toWalletDto(row);
		} catch (error) {
			translatePrismaError(error, "adjust wallet balance");
		}
	}

	public async tryDebit(
		walletId: string,
		amount: bigint,
	): Promise<WalletDto | null> {
		if (!walletId || walletId.trim().length === 0) {
			throw new ValidationError("Wallet ID cannot be empty", "walletId");
		}
		if (amount <= 0n) {
			throw new ValidationError("Debit amount must be positive", "amount");
		}
		try {
			// Single conditional UPDATE → atomic, row-locked, no overspend race.
			const res = await this.db.wallet.updateMany({
				where: { id: walletId, balance: { gte: amount } },
				data: { balance: { decrement: amount } },
			});
			if (res.count === 0) return null;
			const row = await this.db.wallet.findUnique({ where: { id: walletId } });
			return row ? toWalletDto(row) : null;
		} catch (error) {
			translatePrismaError(error, "debit wallet balance");
		}
	}

	public async tryStampCooldown(
		walletId: string,
		field: "lastDailyAt" | "lastWorkAt" | "lastCrimeAt" | "lastRobAt",
		cutoff: Date,
	): Promise<WalletDto | null> {
		if (!walletId || walletId.trim().length === 0) {
			throw new ValidationError("Wallet ID cannot be empty", "walletId");
		}
		try {
			const now = new Date();
			// Claim only if the slot is unset or older than the cutoff. Atomic.
			const res = await this.db.wallet.updateMany({
				where: {
					id: walletId,
					OR: [{ [field]: null }, { [field]: { lt: cutoff } }],
				},
				data: { [field]: now },
			});
			if (res.count === 0) return null;
			const row = await this.db.wallet.findUnique({ where: { id: walletId } });
			return row ? toWalletDto(row) : null;
		} catch (error) {
			translatePrismaError(error, "stamp wallet cooldown");
		}
	}

	public async atomicTransfer(
		fromWalletId: string,
		toWalletId: string,
		amount: bigint,
	): Promise<{ from: WalletDto; to: WalletDto }> {
		return this.db.$transaction(async (tx) => {
			const from = await tx.wallet.findUnique({ where: { id: fromWalletId } });
			if (!from || from.balance < amount) {
				throw new ConflictError("Insufficient balance", "INSUFFICIENT_BALANCE");
			}
			const [updatedFrom, updatedTo] = await Promise.all([
				tx.wallet.update({
					where: { id: fromWalletId },
					data: { balance: { decrement: amount } },
				}),
				tx.wallet.update({
					where: { id: toWalletId },
					data: { balance: { increment: amount } },
				}),
			]);
			return { from: toWalletDto(updatedFrom), to: toWalletDto(updatedTo) };
		});
	}

	public async updateCooldowns(
		walletId: string,
		data: WalletCooldownUpdate,
	): Promise<WalletDto> {
		try {
			const update: Record<string, unknown> = {};
			if (data.lastDailyAt !== undefined) update.lastDailyAt = data.lastDailyAt;
			if (data.lastWorkAt !== undefined) update.lastWorkAt = data.lastWorkAt;
			if (data.lastCrimeAt !== undefined) update.lastCrimeAt = data.lastCrimeAt;
			if (data.lastRobAt !== undefined) update.lastRobAt = data.lastRobAt;
			if (data.workUsesToday !== undefined)
				update.workUsesToday = data.workUsesToday;
			if (data.crimeUsesToday !== undefined)
				update.crimeUsesToday = data.crimeUsesToday;
			if (data.dailyLimitReset !== undefined)
				update.dailyLimitReset = data.dailyLimitReset;

			const row = await this.db.wallet.update({
				where: { id: walletId },
				data: update,
			});
			return toWalletDto(row);
		} catch (error) {
			translatePrismaError(error, "update wallet cooldowns");
		}
	}
}
