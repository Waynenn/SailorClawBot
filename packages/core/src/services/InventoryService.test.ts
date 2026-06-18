import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { InventoryItemRepository, InventoryItemDto, ItemDto } from '@sailorclawbot/contracts';
import type { Logger } from '../common/logging/Logger.js';
import { InventoryService } from './InventoryService.js';
import { NotFoundError } from '../common/errors/NotFoundError.js';

const NOW = new Date('2024-01-01T00:00:00Z');

function makeItem(overrides: Partial<ItemDto> = {}): ItemDto {
  return {
    id: 'item_1',
    guildId: 'g',
    name: 'Test Item',
    description: 'desc',
    price: 100n,
    emoji: '🎁',
    type: 'cosmetic',
    effect: null,
    stock: null,
    createdAt: NOW,
    ...overrides,
  };
}

function makeInvItem(overrides: Partial<InventoryItemDto> = {}): InventoryItemDto {
  return {
    id: 'inv_1',
    guildId: 'g',
    userId: 'u',
    itemId: 'item_1',
    quantity: 1,
    acquiredAt: NOW,
    item: makeItem(),
    ...overrides,
  };
}

function createHarness(invItems: InventoryItemDto[] = []) {
  const store: InventoryItemDto[] = [...invItems];

  const repo: InventoryItemRepository = {
    findByUser: async () => store,
    findByUserAndItem: async (_, __, itemId) => store.find((i) => i.itemId === itemId) ?? null,
    addItem: async (guildId, userId, itemId) => {
      const entry: InventoryItemDto = { id: `inv_${store.length + 1}`, guildId, userId, itemId, quantity: 1, acquiredAt: NOW };
      store.push(entry);
      return entry;
    },
    removeItem: async (_, __, itemId) => {
      const idx = store.findIndex((i) => i.itemId === itemId);
      if (idx === -1) return null;
      const entry = store[idx];
      if (entry.quantity <= 1) { store.splice(idx, 1); return { ...entry, quantity: 0 }; }
      entry.quantity -= 1;
      return entry;
    },
  };

  const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
  const svc = new InventoryService(repo, logger);
  return { svc, store };
}

// ─── listInventory ───────────────────────────────────────────────────────────

test('listInventory — returns all user items', async () => {
  const items = [makeInvItem(), makeInvItem({ id: 'inv_2', itemId: 'item_2', quantity: 3 })];
  const { svc } = createHarness(items);

  const result = await svc.listInventory('g', 'u');
  assert.equal(result.length, 2);
});

test('listInventory — returns empty array when no items', async () => {
  const { svc } = createHarness();
  const result = await svc.listInventory('g', 'u');
  assert.equal(result.length, 0);
});

// ─── useItem ─────────────────────────────────────────────────────────────────

test('useItem — removes item and returns remaining quantity 0', async () => {
  const invItem = makeInvItem({ quantity: 1 });
  const { svc, store } = createHarness([invItem]);

  const result = await svc.useItem('g', 'u', 'item_1');
  assert.equal(result.remainingQuantity, 0);
  assert.equal(result.item.id, 'item_1');
  assert.equal(store.length, 0);
});

test('useItem — decrements quantity when more than 1', async () => {
  const invItem = makeInvItem({ quantity: 3 });
  const { svc, store } = createHarness([invItem]);

  const result = await svc.useItem('g', 'u', 'item_1');
  assert.equal(result.remainingQuantity, 2);
  assert.equal(store[0].quantity, 2);
});

test('useItem — throws NotFoundError when item not in inventory', async () => {
  const { svc } = createHarness();
  await assert.rejects(
    () => svc.useItem('g', 'u', 'item_1'),
    (e) => { assert.ok(e instanceof NotFoundError); return true; }
  );
});

test('useItem — throws NotFoundError when inventory item has no item data', async () => {
  const invItem = makeInvItem({ item: undefined });
  const { svc } = createHarness([invItem]);

  await assert.rejects(
    () => svc.useItem('g', 'u', 'item_1'),
    (e) => { assert.ok(e instanceof NotFoundError); return true; }
  );
});
