import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TicketRepository, TicketDto } from '@sailorclawbot/contracts';
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
    listOpenByGuild: async () => (ticket?.status === 'open' ? [ticket] : []),
    create: async (input) => {
      ticket = makeTicket({ guildId: input.guildId, openedByUserId: input.openedByUserId, channelId: input.channelId });
      return ticket;
    },
    close: async () => {
      if (!ticket) throw new Error('not found');
      ticket = { ...ticket, status: 'closed' };
      return ticket;
    },
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
