import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';

export const unlockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Restore @everyone send permissions in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, _container: Container): Promise<void> {
    const channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { SendMessages: null });
    await interaction.reply('🔓 **Channel unlocked.**');
  },
};
