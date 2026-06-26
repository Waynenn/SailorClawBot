import { PrismaClient } from '@prisma/client';
import { REST } from 'discord.js';
import {
  MuteRepositoryImpl,
  BanRepositoryImpl,
  GiveawayRepositoryImpl,
  GuildSettingsRepositoryImpl,
} from '@sailorclawbot/database';
import { ConsoleLogger } from './lib/ConsoleLogger.js';

function buildContainer() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is not configured');

  const prisma = new PrismaClient();
  const logger = new ConsoleLogger();
  const rest = new REST({ version: '10' }).setToken(token);

  const muteRepo = new MuteRepositoryImpl(prisma);
  const banRepo = new BanRepositoryImpl(prisma);
  const giveawayRepo = new GiveawayRepositoryImpl(prisma);
  const guildSettingsRepo = new GuildSettingsRepositoryImpl(prisma);

  return { prisma, logger, rest, muteRepo, banRepo, giveawayRepo, guildSettingsRepo };
}

export type Container = ReturnType<typeof buildContainer>;

let _container: Container | null = null;

export function getContainer(): Container {
  if (!_container) _container = buildContainer();
  return _container;
}
