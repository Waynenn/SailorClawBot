import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';

export const warnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a member')
    .addUserOption((o) => o.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for warning').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const guildId = interaction.guildId!;
    const moderatorId = interaction.user.id;

    try {
      const warning = await container.moderationService.warnUser(guildId, target.id, reason, moderatorId);
      await interaction.editReply(
        `⚠️ **${target.tag}** has been warned (case #${warning.caseNumber}).\nReason: ${reason}`
      );
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
