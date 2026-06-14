import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';

export const banCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption((o) => o.setName('user').setDescription('Member to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for ban').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('duration').setDescription('Duration in days (omit for permanent)').setMinValue(1).setMaxValue(365)
    ),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const duration = interaction.options.getInteger('duration') ?? undefined;
    const guildId = interaction.guildId!;
    const moderatorId = interaction.user.id;

    try {
      const ban = await container.moderationService.banUser(guildId, target.id, reason, moderatorId, duration);
      const expiry = ban.expiresAt instanceof Date
        ? ` until <t:${Math.floor(ban.expiresAt.getTime() / 1000)}:R>`
        : ' permanently';
      await interaction.editReply(
        `🔨 **${target.tag}** has been banned${expiry} (case #${ban.caseNumber}).\nReason: ${reason}`
      );
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
