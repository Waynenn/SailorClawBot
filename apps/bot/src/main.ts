import * as Sentry from '@sentry/node';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { getContainer } from './container.js';
import type { Command } from './commands/index.js';
import { warnCommand } from './commands/moderation/warn.js';
import { muteCommand } from './commands/moderation/mute.js';
import { unmuteCommand } from './commands/moderation/unmute.js';
import { banCommand } from './commands/moderation/ban.js';
import { unbanCommand } from './commands/moderation/unban.js';
import { kickCommand } from './commands/moderation/kick.js';
import { casesCommand } from './commands/moderation/cases.js';
import { balanceCommand } from './commands/economy/balance.js';
import { transferCommand } from './commands/economy/transfer.js';
import { dailyCommand } from './commands/economy/daily.js';
import { workCommand } from './commands/economy/work.js';
import { crimeCommand } from './commands/economy/crime.js';
import { robCommand } from './commands/economy/rob.js';
import { coinflipCommand } from './commands/economy/coinflip.js';
import { slotsCommand } from './commands/economy/slots.js';
import { rouletteCommand } from './commands/economy/roulette.js';
import { blackjackCommand, startSessionCleaner } from './commands/economy/blackjack.js';
import { startTicketCleaner } from './lib/ticketHelper.js';
import { shopCommand } from './commands/economy/shop.js';
import { buyCommand } from './commands/economy/buy.js';
import { sellCommand } from './commands/economy/sell.js';
import { inventoryCommand } from './commands/economy/inventory.js';
import { ticketCommand } from './commands/tickets/ticket.js';
import { profileCommand } from './commands/profile/profile.js';
import { rankCommand } from './commands/xp/rank.js';
import { leaderboardCommand } from './commands/xp/leaderboard.js';
import { xpCommand } from './commands/xp/xp.js';
import { twitchCommand } from './commands/twitch/twitch.js';
import { automodCommand } from './commands/moderation/automod.js';
import { purgeCommand } from './commands/moderation/purge.js';
import { slowmodeCommand } from './commands/moderation/slowmode.js';
import { lockdownCommand } from './commands/moderation/lockdown.js';
import { unlockCommand } from './commands/moderation/unlock.js';
import { softbanCommand } from './commands/moderation/softban.js';
import { noteCommand } from './commands/moderation/note.js';
import { registerReadyHandler } from './events/ready.js';
import { registerGuildCreateHandler } from './events/guildCreate.js';
import { registerGuildDeleteHandler } from './events/guildDelete.js';
import { registerInteractionHandler } from './events/interactionCreate.js';
import { registerMessageCreateHandler } from './events/messageCreate.js';
import { registerGuildMemberAddHandler } from './events/guildMemberAdd.js';
import { TwitchPoller } from './lib/TwitchPoller.js';

const ALL_COMMANDS: Command[] = [
  warnCommand,
  muteCommand,
  unmuteCommand,
  banCommand,
  unbanCommand,
  kickCommand,
  casesCommand,
  balanceCommand,
  transferCommand,
  dailyCommand,
  workCommand,
  crimeCommand,
  robCommand,
  coinflipCommand,
  slotsCommand,
  rouletteCommand,
  blackjackCommand,
  shopCommand,
  buyCommand,
  sellCommand,
  inventoryCommand,
  ticketCommand,
  profileCommand,
  rankCommand,
  leaderboardCommand,
  xpCommand,
  twitchCommand,
  automodCommand,
  purgeCommand,
  slowmodeCommand,
  lockdownCommand,
  unlockCommand,
  softbanCommand,
  noteCommand,
];

export async function startBot(): Promise<void> {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'production',
    });
  }

  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is not set');

  const container = getContainer();
  const { logger, guildService } = container;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const commands = new Collection<string, Command>();
  for (const cmd of ALL_COMMANDS) {
    commands.set(cmd.data.name, cmd);
  }

  registerReadyHandler(client, logger);
  registerGuildCreateHandler(client, guildService, logger);
  registerGuildDeleteHandler(client, logger);
  registerInteractionHandler(client, commands, container, logger);
  registerMessageCreateHandler(client, container);
  registerGuildMemberAddHandler(client, container);

  // Twitch poller (only if credentials configured)
  const twitchClientId = process.env.TWITCH_CLIENT_ID;
  const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (twitchClientId && twitchClientSecret) {
    const poller = new TwitchPoller(client, container.twitchSubRepo, logger, twitchClientId, twitchClientSecret);
    client.once('ready', () => poller.start());
    logger.info('Twitch poller enabled');
  } else {
    logger.warn('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set — Twitch notifications disabled');
  }

  startSessionCleaner();
  startTicketCleaner(client, container);
  await client.login(token);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startBot().catch((err) => {
    Sentry.captureException(err);
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
