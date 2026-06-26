import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

const ALL_LOG_EVENTS = ['ban', 'unban', 'mute', 'unmute', 'warn', 'kick', 'join', 'leave', 'messageEdit', 'messageDelete', 'channelCreate', 'channelDelete'];

export const logCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('log')
    .setDescription('Configure the mod-log channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName('set')
        .setDescription('Set the log channel (logs all events)')
        .addChannelOption((o) => o.setName('channel').setDescription('Log channel').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('filter')
        .setDescription('Filter which events to log (comma-separated)')
        .addStringOption((o) => o.setName('events').setDescription(`Events: ${ALL_LOG_EVENTS.join(', ')}`).setRequired(true))
    )
    .addSubcommand((s) => s.setName('disable').setDescription('Disable logging')),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    try {
      if (sub === 'set') {
        const channel = interaction.options.getChannel('channel', true);
        await container.guildSettingsRepo.upsert(guildId, { logChannelId: channel.id, logEvents: [] });
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(EMBED_COLORS.info)
            .setTitle('✅ Log channel set')
            .setDescription(`Logging all events to <#${channel.id}>`)],
        });
      } else if (sub === 'filter') {
        const raw = interaction.options.getString('events', true);
        const events = raw.split(',').map((e) => e.trim()).filter((e) => ALL_LOG_EVENTS.includes(e));
        if (events.length === 0) {
          await interaction.editReply({ content: `No valid events. Valid: ${ALL_LOG_EVENTS.join(', ')}` });
          return;
        }
        await container.guildSettingsRepo.upsert(guildId, { logEvents: events });
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(EMBED_COLORS.info)
            .setTitle('✅ Log filter updated')
            .addFields({ name: 'Active events', value: events.join(', ') })],
        });
      } else {
        await container.guildSettingsRepo.upsert(guildId, { logChannelId: null, logEvents: [] });
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(EMBED_COLORS.info).setDescription('✅ Logging disabled.')],
        });
      }
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
