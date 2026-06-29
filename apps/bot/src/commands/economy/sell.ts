import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

export const sellCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("sell")
		.setDescription("Sell an item from your inventory (50% refund)")
		.addStringOption((o) =>
			o
				.setName("item")
				.setDescription("Item name (partial match)")
				.setRequired(true),
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const guildId = interaction.guildId!;
		const userId = interaction.user.id;
		const query = interaction.options.getString("item", true).toLowerCase();

		try {
			const invItems = await container.inventoryService.listInventory(
				guildId,
				userId,
			);
			const invItem = invItems.find((i) =>
				i.item?.name.toLowerCase().includes(query),
			);

			if (!invItem?.item) {
				await interaction.editReply({
					content: `You don't have an item matching **"${query}"** in your inventory.`,
					allowedMentions: { parse: [] },
				});
				return;
			}

			const { balance, refund, item } = await container.shopService.sellItem(
				guildId,
				userId,
				invItem.itemId,
			);

			const embed = new EmbedBuilder()
				.setColor(EMBED_COLORS.economy)
				.setTitle("Item Sold")
				.setDescription(
					`You sold **${item.emoji ?? "🎁"} ${item.name}** for **${refund.toLocaleString()} coins** (50% of original price).`,
				)
				.addFields({
					name: "New Balance",
					value: `${balance.toLocaleString()} coins`,
					inline: true,
				});

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
