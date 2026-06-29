import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

export const buyCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("buy")
		.setDescription("Buy an item from the shop")
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
			const allItems = await container.shopService.listItems(guildId);
			const item = allItems.find((i) => i.name.toLowerCase().includes(query));

			if (!item) {
				await interaction.editReply({
					content: `No item found matching **"${query}"**.`,
					allowedMentions: { parse: [] },
				});
				return;
			}

			const settings = await container.guildSettingsRepo.findByGuild(guildId);
			const { wallet, totalPaid } = await container.shopService.buyItem(
				guildId,
				userId,
				item.id,
				{ shopTaxPercent: settings?.shopTaxPercent ?? 0 },
			);

			const embed = new EmbedBuilder()
				.setColor(EMBED_COLORS.economy)
				.setTitle("Purchase Successful")
				.setDescription(
					`You bought **${item.emoji ?? "🎁"} ${item.name}** for **${totalPaid.toLocaleString()} coins**.`,
				)
				.addFields({
					name: "New Balance",
					value: `${wallet.balance.toLocaleString()} coins`,
					inline: true,
				});

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
