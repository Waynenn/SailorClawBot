import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';

export const unbanCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Remove a ban from a user')
    .addUserOption((o) => o.setName('user').setDescription('User to unban').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const guildId = interaction.guildId!;
    const moderatorId = interaction.user.id;

    try {
      await container.moderationService.unbanUser(guildId, target.id, moderatorId);
      await interaction.editReply(`✅ **${target.tag}** has been unbanned.`);
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
