import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

export const slotsCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("slots")
		.setDescription("Spin the slot machine")
		.addIntegerOption((o) =>
			o
				.setName("amount")
				.setDescription("Amount to bet")
				.setRequired(true)
				.setMinValue(1),
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply();
		const guildId = interaction.guildId!;
		const userId = interaction.user.id;
		const amount = BigInt(interaction.options.getInteger("amount", true));

		try {
			const settings = await container.guildSettingsRepo.findByGuild(guildId);
			const { reels, multiplier, won, payout, wallet } =
				await container.economyService.slots(guildId, userId, amount, {
					gamblingMinBet: settings?.gamblingMinBet ?? 10n,
					gamblingMaxBet: settings?.gamblingMaxBet ?? 50000n,
				});

			const reelDisplay = `[ ${reels.join(" | ")} ]`;
			const embed = new EmbedBuilder()
				.setColor(won ? EMBED_COLORS.economy : EMBED_COLORS.punitive)
				.setTitle("Slot Machine")
				.setDescription(reelDisplay)
				.addFields(
					{
						name: won ? `Winner! (${multiplier}x)` : "No match",
						value: won
							? `+${(payout - amount).toLocaleString()} coins`
							: `-${amount.toLocaleString()} coins`,
						inline: true,
					},
					{
						name: "Balance",
						value: `${wallet.balance.toLocaleString()} coins`,
						inline: true,
					},
				);

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
