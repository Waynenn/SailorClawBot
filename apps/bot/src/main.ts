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
import { profileCommand } from './commands/profile/profile.js';
import { registerReadyHandler } from './events/ready.js';
import { registerGuildCreateHandler } from './events/guildCreate.js';
import { registerGuildDeleteHandler } from './events/guildDelete.js';
import { registerInteractionHandler } from './events/interactionCreate.js';

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
  profileCommand,
];

export async function startBot(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is not set');

  const container = getContainer();
  const { logger, guildService } = container;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
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

  await client.login(token);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startBot().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
