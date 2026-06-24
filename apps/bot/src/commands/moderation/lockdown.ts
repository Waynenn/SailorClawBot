import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
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
    const channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { SendMessages: false }, { reason });
    await interaction.reply(`🔒 **Locked down.** Reason: ${reason}`);
  },
};
