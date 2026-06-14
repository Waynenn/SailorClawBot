import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WalletRepository, TransactionRepository, WalletDto, TransactionDto } from '@sailorclawbot/contracts';
import type { EventBus, DomainEvent } from '../common/events/EventBus.js';
import type { Logger } from '../common/logging/Logger.js';
import { EconomyService } from './EconomyService.js';
import { ValidationError } from '../common/errors/ValidationError.js';
import { NotFoundError } from '../common/errors/NotFoundError.js';
import { ConflictError } from '../common/errors/ConflictError.js';


const NOW = new Date('2024-01-01T00:00:00Z');

function makeWallet(overrides: Partial<WalletDto> = {}): WalletDto {
  return { id: 'wallet_1', guildId: 'g', userId: 'u', balance: 100n, createdAt: NOW, updatedAt: NOW, ...overrides };
}

function createHarness(existingWallet: WalletDto | null = null) {
  const events: DomainEvent[] = [];
  let wallet: WalletDto | null = existingWallet;
  const txs: TransactionDto[] = [];

  const wallets: WalletRepository = {
    findByGuildAndUser: async () => wallet,
    create: async (input) => {
      wallet = makeWallet({ guildId: input.guildId, userId: input.userId, balance: 0n });
      return wallet;
    },
    adjustBalance: async (walletId, amount) => {
      if (!wallet) throw new Error('no wallet');
      wallet = { ...wallet, balance: wallet.balance + amount };
      return wallet;
    },
    atomicTransfer: async () => { throw new Error('atomicTransfer not stubbed'); },
  };

  const transactions: TransactionRepository = {
    create: async (input) => {
      const tx: TransactionDto = { id: `tx_${txs.length + 1}`, createdAt: NOW, ...input };
      txs.push(tx);
      return tx;
    },
    listByWallet: async () => txs,
  };

  const bus: EventBus = { publish: async (e) => { events.push(e); } };
  const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

  return { wallets, transactions, bus, logger, events, txs, getWallet: () => wallet };
}

test('ensureWallet — returns existing wallet', async () => {
  const existing = makeWallet();
  const { wallets, transactions, bus, logger, events } = createHarness(existing);
  const svc = new EconomyService(wallets, transactions, bus, logger);

  const result = await svc.ensureWallet('g', 'u');
  assert.deepEqual(result, existing);
  assert.equal(events.length, 0);
});

test('ensureWallet — creates wallet and publishes event', async () => {
  const { wallets, transactions, bus, logger, events } = createHarness(null);
  const svc = new EconomyService(wallets, transactions, bus, logger);

  const result = await svc.ensureWallet('g', 'u');
  assert.equal(result.balance, 0n);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'wallet.created');
});

test('deposit — adds balance and creates transaction', async () => {
  const { wallets, transactions, bus, logger, txs, getWallet } = createHarness(makeWallet({ balance: 0n }));
  const svc = new EconomyService(wallets, transactions, bus, logger);

  const result = await svc.deposit('g', 'u', 50n, 'gift');
  assert.equal(result.balance, 50n);
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 50n);
});

test('deposit — rejects non-positive amount', async () => {
  const { wallets, transactions, bus, logger } = createHarness(makeWallet());
  const svc = new EconomyService(wallets, transactions, bus, logger);

  await assert.rejects(() => svc.deposit('g', 'u', 0n, 'r'), (e) => { assert.ok(e instanceof ValidationError); return true; });
  await assert.rejects(() => svc.deposit('g', 'u', -1n, 'r'), (e) => { assert.ok(e instanceof ValidationError); return true; });
});

test('withdraw — deducts balance and creates transaction', async () => {
  const { wallets, transactions, bus, logger, txs } = createHarness(makeWallet({ balance: 100n }));
  const svc = new EconomyService(wallets, transactions, bus, logger);

  const result = await svc.withdraw('g', 'u', 30n, 'spend');
  assert.equal(result.balance, 70n);
  assert.equal(txs[0].amount, -30n);
});

test('withdraw — throws ConflictError on insufficient balance', async () => {
  const { wallets, transactions, bus, logger } = createHarness(makeWallet({ balance: 10n }));
  const svc = new EconomyService(wallets, transactions, bus, logger);

  await assert.rejects(() => svc.withdraw('g', 'u', 50n, 'spend'), (e) => { assert.ok(e instanceof ConflictError); return true; });
});

test('withdraw — throws NotFoundError when no wallet', async () => {
  const { wallets, transactions, bus, logger } = createHarness(null);
  const svc = new EconomyService(wallets, transactions, bus, logger);

  await assert.rejects(() => svc.withdraw('g', 'u', 10n, 'r'), (e) => { assert.ok(e instanceof NotFoundError); return true; });
});

test('transfer — moves funds between wallets', async () => {
  let walletA: WalletDto = makeWallet({ id: 'w_a', userId: 'u_a', balance: 100n });
  let walletB: WalletDto | null = null;

  const wallets: WalletRepository = {
    findByGuildAndUser: async (_, userId) => userId === 'u_a' ? walletA : walletB,
    create: async (input) => { walletB = makeWallet({ id: 'w_b', userId: input.userId, balance: 0n }); return walletB; },
    adjustBalance: async (walletId, amount) => {
      if (walletId === 'w_a') { walletA = { ...walletA, balance: walletA.balance + amount }; return walletA; }
      if (walletB) { walletB = { ...walletB, balance: walletB.balance + amount }; return walletB; }
      throw new Error('wallet not found');
    },
    atomicTransfer: async (_fromId, _toId, amount) => {
      if (walletA.balance < amount) throw new ConflictError('Insufficient balance', 'INSUFFICIENT_BALANCE');
      walletA = { ...walletA, balance: walletA.balance - amount };
      if (!walletB) walletB = makeWallet({ id: 'w_b', userId: 'u_b', balance: 0n });
      walletB = { ...walletB, balance: walletB.balance + amount };
      return { from: walletA, to: walletB };
    },
  };
  const txs: TransactionDto[] = [];
  const transactions: TransactionRepository = {
    create: async (input) => { const tx: TransactionDto = { id: `tx_${txs.length + 1}`, createdAt: NOW, ...input }; txs.push(tx); return tx; },
    listByWallet: async () => txs,
  };
  const events: DomainEvent[] = [];
  const bus: EventBus = { publish: async (e) => { events.push(e); } };
  const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

  const svc = new EconomyService(wallets, transactions, bus, logger);
  const { from, to } = await svc.transfer('g', 'u_a', 'u_b', 40n, 'gift');

  assert.equal(from.balance, 60n);
  assert.equal(to.balance, 40n);
  assert.ok(events.some((e) => e.name === 'economy.transferred'));
});

test('transfer — rejects self-transfer', async () => {
  const { wallets, transactions, bus, logger } = createHarness(makeWallet());
  const svc = new EconomyService(wallets, transactions, bus, logger);

  await assert.rejects(() => svc.transfer('g', 'u', 'u', 10n, 'r'), (e) => { assert.ok(e instanceof ValidationError); return true; });
});

test('getBalance — returns wallet balance', async () => {
  const { wallets, transactions, bus, logger } = createHarness(makeWallet({ balance: 250n }));
  const svc = new EconomyService(wallets, transactions, bus, logger);

  assert.equal(await svc.getBalance('g', 'u'), 250n);
});

test('getBalance — throws NotFoundError when no wallet', async () => {
  const { wallets, transactions, bus, logger } = createHarness(null);
  const svc = new EconomyService(wallets, transactions, bus, logger);

  await assert.rejects(() => svc.getBalance('g', 'u'), (e) => { assert.ok(e instanceof NotFoundError); return true; });
});
