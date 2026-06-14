import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

const TYPE_EMOJI: Record<string, string> = {
  warning: '⚠️',
  mute: '🔇',
  ban: '🔨',
  kick: '👢',
};

export const casesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription('View moderation cases for a user or guild')
    .addUserOption((o) => o.setName('user').setDescription('Filter by user (omit for all recent cases)'))
    .addIntegerOption((o) =>
      o.setName('limit').setDescription('Number of cases to show (default 10, max 25)').setMinValue(1).setMaxValue(25)
    ),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user') ?? undefined;
    const limit = interaction.options.getInteger('limit') ?? 10;
    const guildId = interaction.guildId!;

    try {
      const cases = await container.moderationService.listCases(guildId, target?.id, limit);

      if (cases.length === 0) {
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor(EMBED_COLORS.info).setDescription('No cases found.')] });
        return;
      }

      const lines = cases.map((c) => {
        const emoji = TYPE_EMOJI[c.type] ?? '📋';
        const ts = Math.floor(new Date(c.createdAt).getTime() / 1000);
        return `${emoji} **#${c.caseNumber}** • <@${c.userId}> • <t:${ts}:d>\n> ${c.reason ?? 'No reason'}`;
      });

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.info)
        .setTitle(target ? `Cases for ${target.tag}` : 'Recent Cases')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Showing ${cases.length} case(s)` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
