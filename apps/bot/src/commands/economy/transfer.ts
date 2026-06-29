import type { ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import type { Container } from "../../container.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

export const transferCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("transfer")
		.setDescription("Transfer coins to another member")
		.addUserOption((o) =>
			o.setName("user").setDescription("Recipient").setRequired(true),
		)
		.addIntegerOption((o) =>
			o
				.setName("amount")
				.setDescription("Amount to transfer")
				.setRequired(true)
				.setMinValue(1),
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const target = interaction.options.getUser("user", true);
		const amount = BigInt(interaction.options.getInteger("amount", true));
		const guildId = interaction.guildId!;
		const fromUserId = interaction.user.id;

		try {
			await container.economyService.transfer(
				guildId,
				fromUserId,
				target.id,
				amount,
				"slash command transfer",
			);
			await interaction.editReply(
				`✅ Transferred **${amount.toLocaleString()}** coins to **${target.tag}**.`,
			);
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
