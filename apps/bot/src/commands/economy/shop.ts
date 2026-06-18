import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { ItemDto } from '@sailorclawbot/contracts';
import type { Command } from '../index.js';
import type { Container } from '../../container.js';
import { handleCommandError } from '../../middleware/errorHandler.js';
import { EMBED_COLORS } from '../../lib/embedColors.js';

export const SHOP_PAGE_SIZE = 5;

export function buildShopEmbed(items: ItemDto[], page: number, totalPages: number): EmbedBuilder {
  const lines = items.map((item) => {
    const stock = item.stock === null ? '∞' : item.stock;
    return `${item.emoji ?? '🎁'} **${item.name}** — ${item.price.toLocaleString()} coins (stock: ${stock})\n  ${item.description ?? ''}`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.economy)
    .setTitle('Shop')
    .setDescription(lines.join('\n\n') || 'No items available.')
    .setFooter({ text: `Page ${page}/${totalPages} • Use /buy <name> to purchase` });
}

export function shopPageButtons(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop_prev_${page}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`shop_next_${page}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
  );
}

export const shopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse the server shop'),

  async execute(interaction: ChatInputCommandInteraction, container: Container): Promise<void> {
    await interaction.deferReply();
    const guildId = interaction.guildId!;

    try {
      const allItems = await container.shopService.listItems(guildId);
      const totalPages = Math.max(1, Math.ceil(allItems.length / SHOP_PAGE_SIZE));
      const pageItems = allItems.slice(0, SHOP_PAGE_SIZE);

      const embed = buildShopEmbed(pageItems, 1, totalPages);
      const components = totalPages > 1 ? [shopPageButtons(1, totalPages)] : [];

      await interaction.editReply({ embeds: [embed], components });
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};
