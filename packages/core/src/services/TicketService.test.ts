import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TicketRepository, TicketDto, TicketStats } from '@sailorclawbot/contracts';
import type { EventBus, DomainEvent } from '../common/events/EventBus.js';
import type { Logger } from '../common/logging/Logger.js';
import { TicketService } from './TicketService.js';
import { NotFoundError } from '../common/errors/NotFoundError.js';
import { ConflictError } from '../common/errors/ConflictError.js';

const NOW = new Date('2024-01-01T00:00:00Z');

function makeTicket(overrides: Partial<TicketDto> = {}): TicketDto {
  return {
    id: 'ticket_1',
    guildId: 'g',
    openedByUserId: 'u',
    channelId: null,
    claimedById: null,
    claimedAt: null,
    closedById: null,
    rating: null,
    subject: null,
    status: 'open',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createHarness(stored: TicketDto | null = null) {
  const events: DomainEvent[] = [];
  let ticket = stored;

  const tickets: TicketRepository = {
    findById: async () => ticket,
    findByChannel: async (channelId) => (ticket?.channelId === channelId ? ticket : null),
    listOpenByGuild: async () => (ticket?.status === 'open' || ticket?.status === 'claimed' ? [ticket] : []),
    countByStatus: async (): Promise<TicketStats> => ({
      open: ticket?.status === 'open' ? 1 : 0,
      claimed: ticket?.status === 'claimed' ? 1 : 0,
      closed: ticket?.status === 'closed' ? 1 : 0,
    }),
    countAll: async () => (ticket ? 1 : 0),
    create: async (input) => {
      ticket = makeTicket({ guildId: input.guildId, openedByUserId: input.openedByUserId, channelId: input.channelId, subject: input.subject });
      return ticket;
    },
    claim: async (id, claimedById) => {
      if (!ticket) throw new Error('not found');
      ticket = { ...ticket, status: 'claimed', claimedById, claimedAt: NOW };
      return ticket;
    },
    close: async () => {
      if (!ticket) throw new Error('not found');
      ticket = { ...ticket, status: 'closed' };
      return ticket;
    },
    closeWithDetails: async (id, closedById) => {
      if (!ticket) throw new Error('not found');
      ticket = { ...ticket, status: 'closed', closedById };
      return ticket;
    },
    setRating: async (id, rating) => {
      if (!ticket) throw new Error('not found');
      ticket = { ...ticket, rating };
      return ticket;
    },
    listClosedWithChannelBefore: async () => (ticket?.status === 'closed' && ticket.channelId ? [ticket] : []),
    clearChannelId: async () => { if (ticket) ticket = { ...ticket, channelId: null }; },
  };

  const bus: EventBus = { publish: async (e) => { events.push(e); } };
  const logger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

  return { tickets, bus, logger, events, getTicket: () => ticket };
}

test('openTicket — creates and publishes ticket.opened', async () => {
  const { tickets, bus, logger, events, getTicket } = createHarness();
  const svc = new TicketService(tickets, bus, logger);

  const result = await svc.openTicket('g', 'u', null);
  assert.equal(result.status, 'open');
  assert.equal(getTicket()?.openedByUserId, 'u');
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'ticket.opened');
});

test('closeTicket — closes open ticket and publishes event', async () => {
  const { tickets, bus, logger, events } = createHarness(makeTicket());
  const svc = new TicketService(tickets, bus, logger);

  const result = await svc.closeTicket('ticket_1');
  assert.equal(result.status, 'closed');
  assert.equal(events[0].name, 'ticket.closed');
});

test('closeTicket — throws NotFoundError when ticket missing', async () => {
  const { tickets, bus, logger } = createHarness(null);
  const svc = new TicketService(tickets, bus, logger);

  await assert.rejects(() => svc.closeTicket('nonexistent'), (e) => { assert.ok(e instanceof NotFoundError); return true; });
});

test('closeTicket — throws ConflictError on already closed ticket', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket({ status: 'closed' }));
  const svc = new TicketService(tickets, bus, logger);

  await assert.rejects(() => svc.closeTicket('ticket_1'), (e) => { assert.ok(e instanceof ConflictError); return true; });
});

test('listOpenByGuild — returns open tickets', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket());
  const svc = new TicketService(tickets, bus, logger);

  const result = await svc.listOpenByGuild('g');
  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'open');
});

test('claimTicket — sets status to claimed', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket());
  const svc = new TicketService(tickets, bus, logger);

  const result = await svc.claimTicket('ticket_1', 'staff_1');
  assert.equal(result.status, 'claimed');
  assert.equal(result.claimedById, 'staff_1');
});

test('claimTicket — throws ConflictError on closed ticket', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket({ status: 'closed' }));
  const svc = new TicketService(tickets, bus, logger);

  await assert.rejects(() => svc.claimTicket('ticket_1', 'staff_1'), (e) => { assert.ok(e instanceof ConflictError); return true; });
});

test('claimTicket — throws ConflictError on already claimed ticket', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket({ status: 'claimed', claimedById: 'staff_1' }));
  const svc = new TicketService(tickets, bus, logger);

  await assert.rejects(() => svc.claimTicket('ticket_1', 'staff_2'), (e) => { assert.ok(e instanceof ConflictError); return true; });
});

test('rateTicket — saves rating', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket({ status: 'closed' }));
  const svc = new TicketService(tickets, bus, logger);

  const result = await svc.rateTicket('ticket_1', 5);
  assert.equal(result.rating, 5);
});

test('getStats — returns counts by status', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket());
  const svc = new TicketService(tickets, bus, logger);

  const stats = await svc.getStats('g');
  assert.equal(stats.open, 1);
  assert.equal(stats.claimed, 0);
  assert.equal(stats.closed, 0);
});

test('nextTicketNumber — returns count + 1', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket());
  const svc = new TicketService(tickets, bus, logger);

  const num = await svc.nextTicketNumber('g');
  assert.equal(num, 2);
});

// BUG-R13: closeTicketByUser was untested — must record closedById via closeWithDetails
test('closeTicketByUser — BUG-R13: records closedById and publishes ticket.closed', async () => {
  const { tickets, bus, logger, events, getTicket } = createHarness(makeTicket());
  const svc = new TicketService(tickets, bus, logger);

  const result = await svc.closeTicketByUser('ticket_1', 'staff_1');
  assert.equal(result.status, 'closed');
  assert.equal(result.closedById, 'staff_1');
  assert.equal(getTicket()?.closedById, 'staff_1');
  assert.ok(events.some((e) => e.name === 'ticket.closed'));
});

test('closeTicketByUser — throws NotFoundError when ticket missing', async () => {
  const { tickets, bus, logger } = createHarness(null);
  const svc = new TicketService(tickets, bus, logger);

  await assert.rejects(
    () => svc.closeTicketByUser('nonexistent', 'staff_1'),
    (e) => { assert.ok(e instanceof NotFoundError); return true; }
  );
});

test('closeTicketByUser — throws ConflictError when already closed', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket({ status: 'closed' }));
  const svc = new TicketService(tickets, bus, logger);

  await assert.rejects(
    () => svc.closeTicketByUser('ticket_1', 'staff_1'),
    (e) => { assert.ok(e instanceof ConflictError); return true; }
  );
});

// BUG-R14: findByChannel was untested — must return ticket when channelId matches
test('findByChannel — BUG-R14: returns ticket when channelId matches', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket({ channelId: 'ch_99' }));
  const svc = new TicketService(tickets, bus, logger);

  const result = await svc.findByChannel('ch_99');
  assert.ok(result !== null);
  assert.equal(result!.channelId, 'ch_99');
});

test('findByChannel — returns null when channelId does not match', async () => {
  const { tickets, bus, logger } = createHarness(makeTicket({ channelId: 'ch_99' }));
  const svc = new TicketService(tickets, bus, logger);

  const result = await svc.findByChannel('ch_other');
  assert.equal(result, null);
});

// BUG-R15: rateTicket NotFoundError path was untested
test('rateTicket — BUG-R15: throws NotFoundError when ticket missing', async () => {
  const { tickets, bus, logger } = createHarness(null);
  const svc = new TicketService(tickets, bus, logger);

  await assert.rejects(
    () => svc.rateTicket('nonexistent', 5),
    (e) => { assert.ok(e instanceof NotFoundError); return true; }
  );
});
