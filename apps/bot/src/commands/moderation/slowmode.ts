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
    if (!interaction.channel?.isTextBased() || interaction.channel.isDMBased()) {
      await interaction.reply({ content: 'This command can only be used in a server text channel.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    await (interaction.channel as TextChannel).setRateLimitPerUser(seconds);
    const msg = seconds === 0 ? '✅ Slowmode disabled.' : `✅ Slowmode set to **${seconds}s**.`;
    await interaction.editReply({ content: msg });
  },
};
