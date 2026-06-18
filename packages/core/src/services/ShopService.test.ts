import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  ItemRepository,
  InventoryItemRepository,
  WalletRepository,
  TransactionRepository,
  ItemDto,
  InventoryItemDto,
  CreateItemDto,
  WalletDto,
  TransactionDto,
} from '@sailorclawbot/contracts';
import type { EventBus } from '../common/events/EventBus.js';
import type { Logger } from '../common/logging/Logger.js';
import { ShopService } from './ShopService.js';
import { NotFoundError } from '../common/errors/NotFoundError.js';
import { ConflictError } from '../common/errors/ConflictError.js';

const NOW = new Date('2024-01-01T00:00:00Z');

function makeItem(overrides: Partial<ItemDto> = {}): ItemDto {
  return {
    id: 'item_1',
    guildId: 'g',
    name: 'Test Item',
    description: 'A test item',
    price: 100n,
    emoji: '🎁',
    type: 'cosmetic',
    effect: null,
    stock: null,
    createdAt: NOW,
    ...overrides,
  };
}

function makeWallet(overrides: Partial<WalletDto> = {}): WalletDto {
  return {
    id: 'wallet_1',
    guildId: 'g',
    userId: 'u',
    balance: 1000n,
    lastDailyAt: null,
    lastWorkAt: null,
    lastCrimeAt: null,
    lastRobAt: null,
    workUsesToday: 0,
    crimeUsesToday: 0,
    dailyLimitReset: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeInvItem(item: ItemDto, quantity = 1): InventoryItemDto {
  return { id: 'inv_1', guildId: 'g', userId: 'u', itemId: item.id, quantity, acquiredAt: NOW, item };
}

function createHarness(opts: {
  items?: ItemDto[];
  wallet?: WalletDto | null;
  invItems?: InventoryItemDto[];
} = {}) {
  const { items = [], wallet = makeWallet(), invItems = [] } = opts;
  const itemsStore: ItemDto[] = [...items];
  let walletState: WalletDto | null = wallet;
  const invStore: InventoryItemDto[] = [...invItems];
  const txs: TransactionDto[] = [];

  const itemRepo: ItemRepository = {
    findById: async (id) => itemsStore.find((i) => i.id === id) ?? null,
    findByGuild: async (guildId) => itemsStore.filter((i) => i.guildId === guildId),
    create: async (data: CreateItemDto) => {
      const item = makeItem({ ...data, id: `item_${itemsStore.length + 1}` });
      itemsStore.push(item);
      return item;
    },
    update: async (id, data) => {
      const idx = itemsStore.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error('item not found');
      itemsStore[idx] = { ...itemsStore[idx], ...data } as ItemDto;
      return itemsStore[idx];
    },
    delete: async (id) => {
      const idx = itemsStore.findIndex((i) => i.id === id);
      if (idx !== -1) itemsStore.splice(idx, 1);
    },
    decrementStockIfAvailable: async (id) => {
      const item = itemsStore.find((i) => i.id === id);
      if (!item || item.stock === null || item.stock <= 0) return false;
      item.stock -= 1;
      return true;
    },
  };

  const invRepo: InventoryItemRepository = {
    findByUser: async () => invStore,
    findByUserAndItem: async (_, __, itemId) => invStore.find((i) => i.itemId === itemId) ?? null,
    addItem: async (guildId, userId, itemId) => {
      const existing = invStore.find((i) => i.itemId === itemId);
      if (existing) { existing.quantity += 1; return existing; }
      const newEntry: InventoryItemDto = { id: `inv_${invStore.length + 1}`, guildId, userId, itemId, quantity: 1, acquiredAt: NOW };
      invStore.push(newEntry);
      return newEntry;
    },
    removeItem: async (_, __, itemId) => {
      const idx = invStore.findIndex((i) => i.itemId === itemId);
      if (idx === -1) return null;
      const entry = invStore[idx];
      if (entry.quantity <= 1) { invStore.splice(idx, 1); return { ...entry, quantity: 0 }; }
      entry.quantity -= 1;
      return entry;
    },
  };

  const walletRepo: WalletRepository = {
    findByGuildAndUser: async () => walletState,
    create: async (input) => { walletState = makeWallet({ guildId: input.guildId, userId: input.userId, balance: 0n }); return walletState; },
    adjustBalance: async (_id, amount) => {
      if (!walletState) throw new Error('no wallet');
      walletState = { ...walletState, balance: walletState.balance + amount };
      return walletState;
    },
    atomicTransfer: async () => { throw new Error('not stubbed'); },
    updateCooldowns: async () => { if (!walletState) throw new Error('no wallet'); return walletState; },
  };

  const txRepo: TransactionRepository = {
    create: async (input) => { const tx: TransactionDto = { id: `tx_${txs.length + 1}`, createdAt: NOW, ...input }; txs.push(tx); return tx; },
    listByWallet: async () => txs,
  };

  const bus: EventBus = { publish: async () => {} };
  const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

  const svc = new ShopService(itemRepo, invRepo, walletRepo, txRepo, bus, logger);
  return { svc, itemsStore, invStore, txs, getWallet: () => walletState };
}

// ─── listItems ───────────────────────────────────────────────────────────────

test('listItems — returns guild items', async () => {
  const item = makeItem();
  const { svc } = createHarness({ items: [item] });

  const result = await svc.listItems('g');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'item_1');
});

test('listItems — returns empty array when no items', async () => {
  const { svc } = createHarness();
  const result = await svc.listItems('g');
  assert.equal(result.length, 0);
});

// ─── buyItem ─────────────────────────────────────────────────────────────────

test('buyItem — deducts balance including tax', async () => {
  const item = makeItem({ price: 100n });
  const { svc, getWallet, txs } = createHarness({ items: [item], wallet: makeWallet({ balance: 200n }) });

  const result = await svc.buyItem('g', 'u', 'item_1', { shopTaxPercent: 10 });
  assert.equal(result.totalPaid, 110n);
  assert.equal(getWallet()?.balance, 90n);
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, -110n);
});

test('buyItem — adds item to inventory', async () => {
  const item = makeItem({ price: 50n });
  const { svc, invStore } = createHarness({ items: [item], wallet: makeWallet({ balance: 500n }) });

  await svc.buyItem('g', 'u', 'item_1', { shopTaxPercent: 0 });
  assert.equal(invStore.length, 1);
  assert.equal(invStore[0].itemId, 'item_1');
  assert.equal(invStore[0].quantity, 1);
});

test('buyItem — throws NotFoundError for unknown item', async () => {
  const { svc } = createHarness();
  await assert.rejects(
    () => svc.buyItem('g', 'u', 'nonexistent', { shopTaxPercent: 0 }),
    (e) => { assert.ok(e instanceof NotFoundError); return true; }
  );
});

test('buyItem — throws ConflictError when out of stock', async () => {
  const item = makeItem({ stock: 0 });
  const { svc } = createHarness({ items: [item] });

  await assert.rejects(
    () => svc.buyItem('g', 'u', 'item_1', { shopTaxPercent: 0 }),
    (e) => { assert.ok(e instanceof ConflictError); assert.equal((e as ConflictError).code, 'OUT_OF_STOCK'); return true; }
  );
});

test('buyItem — throws ConflictError on insufficient balance', async () => {
  const item = makeItem({ price: 1000n });
  const { svc } = createHarness({ items: [item], wallet: makeWallet({ balance: 10n }) });

  await assert.rejects(
    () => svc.buyItem('g', 'u', 'item_1', { shopTaxPercent: 0 }),
    (e) => { assert.ok(e instanceof ConflictError); assert.equal((e as ConflictError).code, 'INSUFFICIENT_BALANCE'); return true; }
  );
});

test('buyItem — decrements limited stock', async () => {
  const item = makeItem({ price: 10n, stock: 5 });
  const { svc, itemsStore } = createHarness({ items: [item], wallet: makeWallet({ balance: 500n }) });

  await svc.buyItem('g', 'u', 'item_1', { shopTaxPercent: 0 });
  assert.equal(itemsStore[0].stock, 4);
});

// ─── sellItem ────────────────────────────────────────────────────────────────

test('sellItem — refunds 50% of item price', async () => {
  const item = makeItem({ price: 200n });
  const invItem = makeInvItem(item);
  const { svc, getWallet, txs } = createHarness({
    items: [item],
    wallet: makeWallet({ balance: 100n }),
    invItems: [invItem],
  });

  const result = await svc.sellItem('g', 'u', 'item_1');
  assert.equal(result.refund, 100n);
  assert.equal(getWallet()?.balance, 200n);
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 100n);
});

test('sellItem — throws NotFoundError when item not in inventory', async () => {
  const { svc } = createHarness();
  await assert.rejects(
    () => svc.sellItem('g', 'u', 'item_1'),
    (e) => { assert.ok(e instanceof NotFoundError); return true; }
  );
});

test('sellItem — removes item from inventory', async () => {
  const item = makeItem({ price: 100n });
  const invItem = makeInvItem(item);
  const { svc, invStore } = createHarness({ items: [item], wallet: makeWallet(), invItems: [invItem] });

  await svc.sellItem('g', 'u', 'item_1');
  assert.equal(invStore.length, 0);
});

// ─── createItem / deleteItem ──────────────────────────────────────────────────

test('createItem — adds item to guild store', async () => {
  const { svc, itemsStore } = createHarness();

  const data: Omit<CreateItemDto, 'guildId'> = {
    name: 'Sword',
    description: 'Sharp',
    price: 500n,
    emoji: '⚔️',
    type: 'cosmetic',
    effect: null,
    stock: null,
  };
  const item = await svc.createItem('g', data);
  assert.equal(item.name, 'Sword');
  assert.equal(item.guildId, 'g');
  assert.equal(itemsStore.length, 1);
});

test('deleteItem — removes item from store', async () => {
  const item = makeItem();
  const { svc, itemsStore } = createHarness({ items: [item] });

  await svc.deleteItem('g', 'item_1');
  assert.equal(itemsStore.length, 0);
});

test('deleteItem — throws NotFoundError for unknown item', async () => {
  const { svc } = createHarness();
  await assert.rejects(
    () => svc.deleteItem('g', 'nonexistent'),
    (e) => { assert.ok(e instanceof NotFoundError); return true; }
  );
});
