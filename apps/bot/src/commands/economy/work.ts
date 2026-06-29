import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

const WORK_MESSAGES = [
	"You worked as a baker",
	"You delivered packages across town",
	"You fixed computers all day",
	"You drove a taxi",
	"You mowed lawns in the neighbourhood",
	"You worked a shift at the coffee shop",
	"You coded for a startup",
];

export const workCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("work")
		.setDescription("Work to earn coins (1h cooldown)"),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply();
		const guildId = interaction.guildId!;
		const userId = interaction.user.id;

		try {
			const settings = await container.guildSettingsRepo.findByGuild(guildId);
			const { earned, usesToday, wallet } = await container.economyService.work(
				guildId,
				userId,
				{
					workMin: settings?.workMin ?? 50n,
					workMax: settings?.workMax ?? 200n,
					dailyWorkLimit: settings?.dailyWorkLimit ?? 5,
					workDiminishingFactor: settings?.workDiminishingFactor ?? 0.8,
				},
			);

			const msg =
				WORK_MESSAGES[Math.floor(Math.random() * WORK_MESSAGES.length)];
			const limit = settings?.dailyWorkLimit ?? 5;

			const embed = new EmbedBuilder()
				.setColor(EMBED_COLORS.economy)
				.setTitle("Work")
				.setDescription(
					`${msg} and earned **+${earned.toLocaleString()} coins**!`,
				)
				.addFields(
					{
						name: "Balance",
						value: `${wallet.balance.toLocaleString()} coins`,
						inline: true,
					},
					{ name: "Uses Today", value: `${usesToday}/${limit}`, inline: true },
				)
				.setFooter({ text: "Cooldown: 1 hour" });

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
