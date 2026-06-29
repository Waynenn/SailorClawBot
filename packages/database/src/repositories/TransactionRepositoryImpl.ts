import type { PrismaClient } from "@prisma/client";
import type {
	TransactionDto,
	TransactionRepository,
} from "@sailorclawbot/contracts";
import { ValidationError } from "@sailorclawbot/core";
import { translatePrismaError } from "./prisma-errors.js";

function toTransactionDto(row: {
	id: string;
	walletId: string;
	amount: bigint;
	reason: string;
	createdAt: Date;
}): TransactionDto {
	return {
		id: row.id,
		walletId: row.walletId,
		amount: row.amount,
		reason: row.reason,
		createdAt: row.createdAt,
	};
}

export class TransactionRepositoryImpl implements TransactionRepository {
	public constructor(private readonly db: PrismaClient) {}

	public async create(
		input: Pick<TransactionDto, "walletId" | "amount" | "reason">,
	): Promise<TransactionDto> {
		if (!input.walletId || input.walletId.trim().length === 0) {
			throw new ValidationError("Wallet ID is required", "walletId");
		}
		if (!input.reason || input.reason.trim().length === 0) {
			throw new ValidationError("Reason is required", "reason");
		}
		if (input.amount === 0n) {
			throw new ValidationError("Transaction amount cannot be zero", "amount");
		}

		try {
			const row = await this.db.transaction.create({
				data: {
					walletId: input.walletId,
					amount: input.amount,
					reason: input.reason,
				},
			});
			return toTransactionDto(row);
		} catch (error) {
			translatePrismaError(error, "create transaction");
		}
	}

	public async listByWallet(walletId: string): Promise<TransactionDto[]> {
		if (!walletId || walletId.trim().length === 0) {
			throw new ValidationError("Wallet ID cannot be empty", "walletId");
		}
		const rows = await this.db.transaction.findMany({
			where: { walletId },
			orderBy: { createdAt: "desc" },
		});
		return rows.map(toTransactionDto);
	}
}
