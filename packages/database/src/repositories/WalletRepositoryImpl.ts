import type { PrismaClient } from '@prisma/client';
import type { WalletRepository, WalletDto, SnowflakeId } from '@sailorclawbot/contracts';
import { ValidationError } from '@sailorclawbot/core';
import { translatePrismaError } from './prisma-errors.js';

function toWalletDto(row: { id: string; guildId: string; userId: string; balance: bigint; createdAt: Date; updatedAt: Date }): WalletDto {
  return {
    id: row.id,
    guildId: row.guildId,
    userId: row.userId,
    balance: row.balance,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class WalletRepositoryImpl implements WalletRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findByGuildAndUser(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<WalletDto | null> {
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID cannot be empty', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID cannot be empty', 'userId');
    }
    const row = await this.db.wallet.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    return row ? toWalletDto(row) : null;
  }

  public async create(input: Pick<WalletDto, 'guildId' | 'userId'>): Promise<WalletDto> {
    if (!input.guildId || input.guildId.trim().length === 0) {
      throw new ValidationError('Guild ID is required', 'guildId');
    }
    if (!input.userId || input.userId.trim().length === 0) {
      throw new ValidationError('User ID is required', 'userId');
    }

    try {
      const row = await this.db.wallet.create({
        data: { guildId: input.guildId, userId: input.userId },
      });
      return toWalletDto(row);
    } catch (error) {
      translatePrismaError(error, 'create wallet');
    }
  }

  public async adjustBalance(walletId: string, amount: bigint): Promise<WalletDto> {
    if (!walletId || walletId.trim().length === 0) {
      throw new ValidationError('Wallet ID cannot be empty', 'walletId');
    }

    try {
      const row = await this.db.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: amount } },
      });
      return toWalletDto(row);
    } catch (error) {
      translatePrismaError(error, 'adjust wallet balance');
    }
  }
}
