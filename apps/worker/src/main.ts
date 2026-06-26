import * as Sentry from '@sentry/node';
import { getContainer } from './container.js';
import { processBanExpiry } from './jobs/ProcessBanExpiry.js';
import { processMuteExpiry } from './jobs/ProcessMuteExpiry.js';
import { processGiveawayEnd } from './jobs/ProcessGiveawayEnd.js';

/** How often the durable-action jobs run. ≤60s keeps temp-ban lift within SLA. */
const TICK_INTERVAL_MS = 30_000;

export async function runTick(): Promise<void> {
  const c = getContainer();
  // Jobs are independent; one failing must not block the others.
  await Promise.allSettled([processBanExpiry(c), processMuteExpiry(c), processGiveawayEnd(c)]);
}

export function startWorker(): () => Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) Sentry.init({ dsn, tracesSampleRate: 0.1 });

  const c = getContainer();
  c.logger.info('Worker started', { intervalMs: TICK_INTERVAL_MS });

  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return; // skip if previous tick still in flight
    running = true;
    try {
      await runTick();
    } catch (error) {
      Sentry.captureException(error);
      c.logger.error('Tick failed', { error: String(error) });
    } finally {
      running = false;
    }
  };

  void tick(); // run once immediately on boot
  const timer = setInterval(() => void tick(), TICK_INTERVAL_MS);

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(timer);
    c.logger.info('Worker shutting down');
    await c.prisma.$disconnect().catch(() => undefined);
    await Sentry.close(2000).catch(() => undefined);
  };

  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));

  return shutdown;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker();
}
