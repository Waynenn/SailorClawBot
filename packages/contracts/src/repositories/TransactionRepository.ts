import type { TransactionDto } from '../types/index.js';

export interface TransactionRepository {
  create(input: Pick<TransactionDto, 'walletId' | 'amount' | 'reason'>): Promise<TransactionDto>;
  listByWallet(walletId: string): Promise<TransactionDto[]>;
}
