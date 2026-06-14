import type {
  WalletRepository,
  TransactionRepository,
  WalletDto,
  TransactionDto,
  SnowflakeId,
} from '@sailorclawbot/contracts';
import { EventNames } from '@sailorclawbot/contracts';
import type { EventBus } from '../common/events/EventBus.js';
import type { Logger } from '../common/logging/Logger.js';
import { ValidationError } from '../common/errors/ValidationError.js';
import { NotFoundError } from '../common/errors/NotFoundError.js';
import { ConflictError } from '../common/errors/ConflictError.js';

export class EconomyService {
  public constructor(
    private readonly wallets: WalletRepository,
    private readonly transactions: TransactionRepository,
    private readonly bus: EventBus,
    private readonly logger: Logger
  ) {}

  public async ensureWallet(guildId: SnowflakeId, userId: SnowflakeId): Promise<WalletDto> {
    const existing = await this.wallets.findByGuildAndUser(guildId, userId);
    if (existing) return existing;

    const wallet = await this.wallets.create({ guildId, userId });
    this.logger.info('Wallet created', { guildId, userId });
    await this.bus.publish({
      name: EventNames.WalletCreated,
      payload: { guildId, userId, walletId: wallet.id },
      occurredAt: new Date(),
    });
    return wallet;
  }

  public async getBalance(guildId: SnowflakeId, userId: SnowflakeId): Promise<bigint> {
    const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
    if (!wallet) throw new NotFoundError('Wallet', `${guildId}:${userId}`);
    return wallet.balance;
  }

  public async deposit(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    amount: bigint,
    reason: string
  ): Promise<WalletDto> {
    if (amount <= 0n) throw new ValidationError('Deposit amount must be positive', 'amount');
    if (!reason || reason.trim().length === 0) throw new ValidationError('Reason required', 'reason');

    const wallet = await this.ensureWallet(guildId, userId);
    const updated = await this.wallets.adjustBalance(wallet.id, amount);

    await this.transactions.create({ walletId: wallet.id, amount, reason });
    this.logger.info('Deposit', { guildId, userId, amount: amount.toString() });
    await this.bus.publish({
      name: EventNames.WalletBalanceUpdated,
      payload: { guildId, userId, walletId: wallet.id, delta: amount, balance: updated.balance },
      occurredAt: new Date(),
    });
    return updated;
  }

  public async withdraw(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    amount: bigint,
    reason: string
  ): Promise<WalletDto> {
    if (amount <= 0n) throw new ValidationError('Withdrawal amount must be positive', 'amount');
    if (!reason || reason.trim().length === 0) throw new ValidationError('Reason required', 'reason');

    const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
    if (!wallet) throw new NotFoundError('Wallet', `${guildId}:${userId}`);
    if (wallet.balance < amount) {
      throw new ConflictError('Insufficient balance', 'INSUFFICIENT_BALANCE');
    }

    const updated = await this.wallets.adjustBalance(wallet.id, -amount);
    await this.transactions.create({ walletId: wallet.id, amount: -amount, reason });
    this.logger.info('Withdrawal', { guildId, userId, amount: amount.toString() });
    await this.bus.publish({
      name: EventNames.WalletBalanceUpdated,
      payload: { guildId, userId, walletId: wallet.id, delta: -amount, balance: updated.balance },
      occurredAt: new Date(),
    });
    return updated;
  }

  public async transfer(
    guildId: SnowflakeId,
    fromUserId: SnowflakeId,
    toUserId: SnowflakeId,
    amount: bigint,
    reason: string
  ): Promise<{ from: WalletDto; to: WalletDto }> {
    if (amount <= 0n) throw new ValidationError('Transfer amount must be positive', 'amount');
    if (fromUserId === toUserId) throw new ValidationError('Cannot transfer to yourself', 'toUserId');
    if (!reason || reason.trim().length === 0) throw new ValidationError('Reason required', 'reason');

    const from = await this.withdraw(guildId, fromUserId, amount, `Transfer to ${toUserId}: ${reason}`);
    const to = await this.deposit(guildId, toUserId, amount, `Transfer from ${fromUserId}: ${reason}`);

    await this.bus.publish({
      name: EventNames.EconomyTransferred,
      payload: { guildId, fromUserId, toUserId, amount, reason },
      occurredAt: new Date(),
    });
    return { from, to };
  }

  public async getTransactionHistory(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<TransactionDto[]> {
    const wallet = await this.wallets.findByGuildAndUser(guildId, userId);
    if (!wallet) throw new NotFoundError('Wallet', `${guildId}:${userId}`);
    return this.transactions.listByWallet(wallet.id);
  }
}
