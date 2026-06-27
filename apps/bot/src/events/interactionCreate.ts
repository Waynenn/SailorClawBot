import * as Sentry from '@sentry/node';
import type { Client, Interaction, ButtonInteraction, TextChannel } from 'discord.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../commands/index.js';
import type { Container } from '../container.js';
import type { Logger } from '@sailorclawbot/core';
import { ConflictError, ValidationError } from '@sailorclawbot/core';
import { EMBED_COLORS } from '../lib/embedColors.js';
import {
  bjSessions,
  handValue,
  dealerPlay,
  buildBjEmbed,
  bjButtons,
  type BlackjackSession,
} from '../commands/economy/blackjack.js';
import { buildShopEmbed, shopPageButtons, SHOP_PAGE_SIZE } from '../commands/economy/shop.js';
import { buildTicketEmbed, ticketActionButtons, ratingButtons, updateStatsEmbed, lockTicketChannel } from '../lib/ticketHelper.js';
import { consumeCommand, consumeButton, retryAfterSeconds } from '../lib/rateLimitConfig.js';

const PAGE_SIZE = 10;

async function resolveBlackjack(
  interaction: ButtonInteraction,
  container: Container,
  session: BlackjackSession,
  guildId: string,
): Promise<void> {
  const playerVal = handValue(session.playerCards);
  const dealerVal = handValue(session.dealerCards);
  const { userId, bet } = session;
  bjSessions.delete(session.id);

  let footer: string;
  if (playerVal > 21) {
    footer = `Bust! Lost ${bet.toLocaleString()} coins.`;
  } else if (dealerVal > 21 || playerVal > dealerVal) {
    await container.economyService.deposit(guildId, userId, bet * 2n, 'Blackjack win');
    footer = `You win! +${bet.toLocaleString()} coins.`;
  } else if (playerVal === dealerVal) {
    await container.economyService.deposit(guildId, userId, bet, 'Blackjack push');
    footer = 'Push! Bet returned.';
  } else {
    footer = `Dealer wins. Lost ${bet.toLocaleString()} coins.`;
  }

  const embed = buildBjEmbed(session, { footer });
  await interaction.update({ embeds: [embed], components: [] });
}

async function handleBlackjackButton(interaction: ButtonInteraction, container: Container): Promise<void> {
  // customId: bj_hit_{userId} | bj_stand_{userId} | bj_double_{userId}
  const parts = interaction.customId.split('_');
  const action = parts[1];
  const userId = parts[2];
  const sessionId = `bj_${interaction.guildId!}_${userId}`;

  if (interaction.user.id !== userId) {
    await interaction.reply({ content: 'This is not your game!', ephemeral: true });
    return;
  }

  const session = bjSessions.get(sessionId);
  if (!session) {
    await interaction.update({ content: 'Session expired. Start a new game with `/blackjack`.', embeds: [], components: [] });
    return;
  }

  const guildId = interaction.guildId!;

  if (action === 'hit') {
    session.playerCards.push(session.deck.pop()!);
    const playerVal = handValue(session.playerCards);

    if (playerVal > 21) {
      bjSessions.delete(sessionId);
      const embed = buildBjEmbed(session, { footer: `Bust! Lost ${session.bet.toLocaleString()} coins.` });
      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    if (playerVal === 21) {
      dealerPlay(session);
      await resolveBlackjack(interaction, container, session, guildId);
      return;
    }

    const embed = buildBjEmbed(session, { hideDealer: true });
    await interaction.update({ embeds: [embed], components: [bjButtons(userId, false)] });

  } else if (action === 'stand') {
    dealerPlay(session);
    await resolveBlackjack(interaction, container, session, guildId);

  } else if (action === 'double') {
    // Remove session before any await to prevent concurrent double-processing
    bjSessions.delete(sessionId);
    const wallet = await container.economyService.ensureWallet(guildId, userId);
    if (wallet.balance < session.bet) {
      // Not enough to double — fall back to stand
      dealerPlay(session);
      await resolveBlackjack(interaction, container, session, guildId);
      return;
    }
    await container.economyService.withdraw(guildId, userId, session.bet, 'Blackjack double down');
    session.bet *= 2n;
    session.playerCards.push(session.deck.pop()!);
    dealerPlay(session);
    await resolveBlackjack(interaction, container, session, guildId);
  }
}

async function handleShopButton(interaction: ButtonInteraction, container: Container): Promise<void> {
  // customId: shop_prev_{page} | shop_next_{page}
  const parts = interaction.customId.split('_');
  const direction = parts[1];
  const currentPage = parseInt(parts[2] ?? '1', 10);
  const rawPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
  const guildId = interaction.guildId!;

  const allItems = await container.shopService.listItems(guildId);
  const totalPages = Math.max(1, Math.ceil(allItems.length / SHOP_PAGE_SIZE));
  const newPage = Math.max(1, Math.min(rawPage, totalPages));
  const pageItems = allItems.slice((newPage - 1) * SHOP_PAGE_SIZE, newPage * SHOP_PAGE_SIZE);

  const embed = buildShopEmbed(pageItems, newPage, totalPages);
  const components = totalPages > 1 ? [shopPageButtons(newPage, totalPages)] : [];
  await interaction.update({ embeds: [embed], components });
}

async function handleLeaderboardButton(interaction: ButtonInteraction, container: Container): Promise<void> {
  const [, direction, rawPage] = interaction.customId.split('_');
  const currentPage = parseInt(rawPage ?? '1', 10);
  const newPage = Math.max(1, direction === 'next' ? currentPage + 1 : currentPage - 1);

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

async function handleTicketButton(interaction: ButtonInteraction, container: Container): Promise<void> {
  // customId: ticket_claim_{id} | ticket_close_{id} | ticket_rate_{id}_{rating}
  const parts = interaction.customId.split('_');
  const action = parts[1];
  const ticketId = parts[2];

  if (action === 'claim') {
    const ticket = await container.ticketService.claimTicket(ticketId, interaction.user.id);
    const embed = buildTicketEmbed(ticket, 0).setTitle('🎫 Ticket').setFooter({ text: `Ticket ID: ${ticket.id}` });
    await interaction.update({ embeds: [embed], components: [ticketActionButtons(ticketId)] });
    if (interaction.guild) await updateStatsEmbed(interaction.guild, container);
    return;
  }

  if (action === 'close') {
    await container.ticketService.closeTicketByUser(ticketId, interaction.user.id);
    if (interaction.guild) await updateStatsEmbed(interaction.guild, container);

    const ratingEmbed = new EmbedBuilder()
      .setColor(EMBED_COLORS.tickets)
      .setTitle('🔒 Ticket Closed')
      .setDescription('Please rate your support experience.\nThis channel will be deleted in 7 days.');
    await interaction.update({ embeds: [ratingEmbed], components: [ratingButtons(ticketId)] });

    await lockTicketChannel(interaction.channel as TextChannel);
    return;
  }

  if (action === 'rate') {
    const rating = parseInt(parts[3] ?? '0', 10);
    if (rating >= 1 && rating <= 5) {
      await container.ticketService.rateTicket(ticketId, rating);
    }
    const stars = '⭐'.repeat(rating);
    const doneEmbed = new EmbedBuilder()
      .setColor(EMBED_COLORS.tickets)
      .setTitle('✅ Thanks for your feedback!')
      .setDescription(`You rated this ticket: ${stars}`);
    await interaction.update({ embeds: [doneEmbed], components: [] });
  }
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

      const buttonRetry = await consumeButton(container.rateLimiter, interaction.guildId, interaction.user.id);
      if (buttonRetry > 0) {
        await interaction
          .reply({ content: `⏳ Слишком часто, подожди ${retryAfterSeconds(buttonRetry)}с.`, ephemeral: true })
          .catch(() => null);
        return;
      }

      try {
        if (interaction.customId.startsWith('lb_')) {
          await handleLeaderboardButton(interaction, container);
        } else if (interaction.customId.startsWith('bj_')) {
          await handleBlackjackButton(interaction, container);
        } else if (interaction.customId.startsWith('shop_')) {
          await handleShopButton(interaction, container);
        } else if (interaction.customId.startsWith('ticket_')) {
          await handleTicketButton(interaction, container);
        } else if (interaction.customId.startsWith('giveaway_join_')) {
          const giveawayId = interaction.customId.replace('giveaway_join_', '');
          try {
            await container.giveawayService.join(giveawayId, interaction.user.id);
            await interaction.reply({ content: '🎉 You have entered the giveaway!', ephemeral: true });
          } catch (joinError) {
            if (joinError instanceof ConflictError) {
              await interaction.reply({ content: '⚠️ You are already in this giveaway!', ephemeral: true });
            } else if (joinError instanceof ValidationError) {
              await interaction.reply({ content: `❌ ${(joinError as Error).message}`, ephemeral: true });
            } else {
              throw joinError;
            }
          }
        } else if (interaction.customId.startsWith('verify_')) {
          const settings = await container.guildSettingsRepo.findByGuild(interaction.guildId);
          if (!settings?.verificationRoleId) {
            await interaction.reply({ content: '⚠️ Verification role not configured.', ephemeral: true });
            return;
          }
          const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
          await member?.roles.add(settings.verificationRoleId).catch(() => null);
          await interaction.reply({ content: '✅ You have been verified!', ephemeral: true });
        }
      } catch (error) {
        logger.error('Button interaction error', { customId: interaction.customId, error: String(error) });
        Sentry.captureException(error, { extra: { customId: interaction.customId } });
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

    const cmdRetry = await consumeCommand(
      container.rateLimiter,
      interaction.commandName,
      interaction.guildId,
      interaction.user.id,
    );
    if (cmdRetry > 0) {
      await interaction.reply({
        content: `⏳ Слишком часто, подожди ${retryAfterSeconds(cmdRetry)}с.`,
        ephemeral: true,
      });
      return;
    }

    try {
      await command.execute(interaction, container);
    } catch (error) {
      logger.error('Unhandled command error', { command: interaction.commandName, error: String(error) });
      Sentry.captureException(error, { extra: { command: interaction.commandName } });
      const msg = '💥 An unexpected error occurred.';
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  });
}
