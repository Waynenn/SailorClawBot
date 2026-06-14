import type { Client } from 'discord.js';
import type { Logger } from '@sailorclawbot/core';

export function registerReadyHandler(client: Client, logger: Logger): void {
  client.once('ready', (c) => {
    logger.info('Bot online', { tag: c.user.tag, guilds: c.guilds.cache.size });
  });
}
