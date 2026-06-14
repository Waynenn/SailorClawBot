import type { SnowflakeId, WalletDto } from '../types/index.js';

export interface WalletRepository {
  findByGuildAndUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<WalletDto | null>;
  create(input: Pick<WalletDto, 'guildId' | 'userId'>): Promise<WalletDto>;
  adjustBalance(walletId: string, amount: bigint): Promise<WalletDto>;
  atomicTransfer(fromWalletId: string, toWalletId: string, amount: bigint): Promise<{ from: WalletDto; to: WalletDto }>;
}
