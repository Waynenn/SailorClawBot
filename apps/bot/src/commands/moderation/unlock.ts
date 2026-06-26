import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import type { GuildChannel } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';

export const unlockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Restore @everyone send permissions in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, _container: Container): Promise<void> {
    if (!interaction.channel?.isTextBased() || interaction.channel.isDMBased()) {
      await interaction.reply({ content: 'This command can only be used in a server text channel.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel as GuildChannel;
    try {
      await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { SendMessages: null });
      await interaction.editReply({ content: '🔓 **Channel unlocked.**' });
    } catch {
      await interaction.editReply({ content: '❌ Failed to unlock — check my permissions.' });
    }
  },
};
