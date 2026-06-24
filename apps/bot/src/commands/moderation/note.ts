import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const noteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Add a private staff note about a user (not visible to them)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to note').setRequired(true))
    .addStringOption((o) => o.setName('text').setDescription('Note content').setRequired(true)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    if (!interaction.guildId) return;
    const target = interaction.options.getUser('user', true);
    const text = interaction.options.getString('text', true);

    const note = await container.moderationService.addNote(
      interaction.guildId,
      target.id,
      interaction.user.id,
      text
    );

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.info)
      .setTitle('📝 Staff Note Added')
      .setDescription(`Note saved for **${target.username}**.`)
      .addFields({ name: 'Content', value: note.content })
      .setTimestamp(note.createdAt);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
