import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';

export const slowmodeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode for this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((o) =>
      o.setName('seconds').setDescription('Cooldown in seconds (0 = disable)').setRequired(true).setMinValue(0).setMaxValue(21600)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, _container: Container): Promise<void> {
    const seconds = interaction.options.getInteger('seconds', true);
    await (interaction.channel as TextChannel).setRateLimitPerUser(seconds);
    const msg = seconds === 0 ? '✅ Slowmode disabled.' : `✅ Slowmode set to **${seconds}s**.`;
    await interaction.reply({ content: msg, ephemeral: true });
  },
};
