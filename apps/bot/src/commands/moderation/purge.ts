import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';

export const purgeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) =>
      o.setName('count').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user'))
    .addStringOption((o) => o.setName('contains').setDescription('Only delete messages containing this text'))
    .addBooleanOption((o) => o.setName('bots').setDescription('Only delete bot messages')) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, _container: Container): Promise<void> {
    const count = interaction.options.getInteger('count', true);
    const targetUser = interaction.options.getUser('user');
    const contains = interaction.options.getString('contains');
    const botsOnly = interaction.options.getBoolean('bots') ?? false;
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    const fetched = await channel.messages.fetch({ limit: 100 });
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

    let filtered = [...fetched.values()].filter((m) => m.createdTimestamp > cutoff);
    if (targetUser) filtered = filtered.filter((m) => m.author.id === targetUser.id);
    if (contains) filtered = filtered.filter((m) => m.content.includes(contains));
    if (botsOnly) filtered = filtered.filter((m) => m.author.bot);
    filtered = filtered.slice(0, count);

    if (filtered.length === 0) {
      await interaction.editReply('No eligible messages found (messages must be < 14 days old).');
      return;
    }

    const deleted = await channel.bulkDelete(filtered, true);
    await interaction.editReply(`🗑️ Deleted **${deleted.size}** messages.`);
  },
};
