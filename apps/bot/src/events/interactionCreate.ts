import type { Client, Interaction, ButtonInteraction } from 'discord.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../commands/index.js';
import type { Container } from '../container.js';
import type { Logger } from '@sailorclawbot/core';
import { EMBED_COLORS } from '../lib/embedColors.js';

const PAGE_SIZE = 10;

async function handleLeaderboardButton(interaction: ButtonInteraction, container: Container): Promise<void> {
  const [, direction, rawPage] = interaction.customId.split('_');
  const currentPage = parseInt(rawPage ?? '1', 10);
  const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;

  const guildId = interaction.guildId;
  if (!guildId) return;

  const { entries, total } = await container.xpService.getLeaderboard(guildId, newPage, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const medals = ['🥇', '🥈', '🥉'];
  const lines = entries.map(({ profile, rank }) => {
    const medal = medals[rank - 1] ?? `**#${rank}**`;
    return `${medal} <@${profile.userId}> — уровень **${profile.level}** | ${profile.totalXp} XP`;
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.xp)
    .setTitle('🏆 Таблица лидеров')
    .setDescription(lines.join('\n') || 'Нет данных.')
    .setFooter({ text: `Страница ${newPage}/${totalPages} • Всего: ${total}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb_prev_${newPage}`)
      .setLabel('◀ Назад')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage <= 1),
    new ButtonBuilder()
      .setCustomId(`lb_next_${newPage}`)
      .setLabel('Вперёд ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage >= totalPages),
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

export function registerInteractionHandler(
  client: Client,
  commands: Map<string, Command>,
  container: Container,
  logger: Logger
): void {
  client.on('interactionCreate', async (interaction: Interaction) => {
    // Button interactions
    if (interaction.isButton()) {
      if (!interaction.guildId) return;
      try {
        if (interaction.customId.startsWith('lb_')) {
          await handleLeaderboardButton(interaction, container);
        }
      } catch (error) {
        logger.error('Button interaction error', { customId: interaction.customId, error: String(error) });
        await interaction.reply({ content: '💥 Ошибка при обработке кнопки.', ephemeral: true }).catch(() => null);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Commands only work inside a server.', ephemeral: true });
      return;
    }

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, container);
    } catch (error) {
      logger.error('Unhandled command error', { command: interaction.commandName, error: String(error) });
      const msg = '💥 An unexpected error occurred.';
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  });
}
