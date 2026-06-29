import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

export const inventoryCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("inventory")
		.setDescription("View your inventory"),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const guildId = interaction.guildId!;
		const userId = interaction.user.id;

		try {
			const items = await container.inventoryService.listInventory(
				guildId,
				userId,
			);

			if (items.length === 0) {
				await interaction.editReply(
					"Your inventory is empty. Visit the `/shop` to buy items!",
				);
				return;
			}

			const lines = items.map((inv) => {
				const name = inv.item?.name ?? inv.itemId;
				const emoji = inv.item?.emoji ?? "🎁";
				return `${emoji} **${name}** ×${inv.quantity}`;
			});

			const embed = new EmbedBuilder()
				.setColor(EMBED_COLORS.economy)
				.setTitle(`${interaction.user.displayName}'s Inventory`)
				.setDescription(lines.join("\n"))
				.setFooter({ text: "Use /sell <name> to sell items" });

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
