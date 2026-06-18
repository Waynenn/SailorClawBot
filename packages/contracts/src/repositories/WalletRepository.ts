import type { SnowflakeId, WalletDto } from '../types/index.js';

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
  findByGuildAndUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<WalletDto | null>;
  create(input: Pick<WalletDto, 'guildId' | 'userId'>): Promise<WalletDto>;
  adjustBalance(walletId: string, amount: bigint): Promise<WalletDto>;
  atomicTransfer(fromWalletId: string, toWalletId: string, amount: bigint): Promise<{ from: WalletDto; to: WalletDto }>;
  updateCooldowns(walletId: string, data: WalletCooldownUpdate): Promise<WalletDto>;
}
