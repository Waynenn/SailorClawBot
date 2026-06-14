import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../index.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

const PAGE_SIZE = 10;

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Таблица лидеров по XP')
    .addIntegerOption((o) =>
      o.setName('page').setDescription('Страница').setMinValue(1)
    ),

  async execute(interaction, container) {
    await interaction.deferReply();

    const page = interaction.options.getInteger('page') ?? 1;
    const guildId = interaction.guildId!;

    const { entries, total } = await container.xpService.getLeaderboard(guildId, page, PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (entries.length === 0) {
      await interaction.editReply({ content: 'Пока никто не набрал XP.' });
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = entries.map(({ profile, rank }) => {
      const medal = medals[rank - 1] ?? `**#${rank}**`;
      return `${medal} <@${profile.userId}> — уровень **${profile.level}** | ${profile.totalXp} XP`;
    });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.xp)
      .setTitle('🏆 Таблица лидеров')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Страница ${page}/${totalPages} • Всего: ${total}` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`lb_prev_${page}`)
        .setLabel('◀ Назад')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`lb_next_${page}`)
        .setLabel('Вперёд ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
