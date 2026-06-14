import { REST, Routes } from 'discord.js';
import { warnCommand } from './commands/moderation/warn.js';
import { muteCommand } from './commands/moderation/mute.js';
import { unmuteCommand } from './commands/moderation/unmute.js';
import { banCommand } from './commands/moderation/ban.js';
import { unbanCommand } from './commands/moderation/unban.js';
import { balanceCommand } from './commands/economy/balance.js';
import { transferCommand } from './commands/economy/transfer.js';
import { profileCommand } from './commands/profile/profile.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_DEV_GUILD_ID;

if (!token || !clientId) {
  console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set');
  process.exit(1);
}

const commands = [
  warnCommand, muteCommand, unmuteCommand, banCommand, unbanCommand,
  balanceCommand, transferCommand, profileCommand,
].map((c) => c.data.toJSON());

const rest = new REST().setToken(token);

const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

rest.put(route, { body: commands })
  .then(() => console.log(`Registered ${commands.length} commands${guildId ? ` to guild ${guildId}` : ' globally'}.`))
  .catch(console.error);
