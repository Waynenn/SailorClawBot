import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const softbanCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban then immediately unban a user (purges messages without permanent ban)')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to softban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason')) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, _container: Container): Promise<void> {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'Softban';

    await interaction.deferReply({ ephemeral: true });

    await interaction.guild!.members.ban(target.id, { reason, deleteMessageSeconds: 604800 });
    await new Promise((r) => setTimeout(r, 1000));
    await interaction.guild!.members.unban(target.id, 'Softban — automatic unban');

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.punitive)
      .setTitle('🔨 Softban')
      .setDescription(`**${target.username}** was softbanned.\nReason: ${reason}`);
    await interaction.editReply({ embeds: [embed] });
  },
};
