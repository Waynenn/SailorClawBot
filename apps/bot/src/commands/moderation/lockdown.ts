import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import type { GuildChannel } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';

export const lockdownCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Prevent @everyone from sending messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((o) => o.setName('reason').setDescription('Reason for lockdown')) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, _container: Container): Promise<void> {
    const reason = interaction.options.getString('reason') ?? 'Lockdown';
    if (!interaction.channel?.isTextBased() || interaction.channel.isDMBased()) {
      await interaction.reply({ content: 'This command can only be used in a server text channel.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel as GuildChannel;
    try {
      await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { SendMessages: false }, { reason });
      await interaction.editReply({ content: `🔒 **Locked down.** Reason: ${reason}` });
    } catch {
      await interaction.editReply({ content: '❌ Failed to lock down — check my permissions.' });
    }
  },
};
