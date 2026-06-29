import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

export const robCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("rob")
		.setDescription("Attempt to rob another member (4h cooldown)")
		.addUserOption((o) =>
			o.setName("target").setDescription("Member to rob").setRequired(true),
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply();
		const guildId = interaction.guildId!;
		const userId = interaction.user.id;
		const target = interaction.options.getUser("target", true);

		try {
			const settings = await container.guildSettingsRepo.findByGuild(guildId);
			const { stolen, backfired, fined, wallet } =
				await container.economyService.rob(guildId, userId, target.id, {
					robMinTargetBalance: settings?.robMinTargetBalance ?? 100n,
				});

			const embed = new EmbedBuilder();
			if (backfired) {
				embed
					.setColor(EMBED_COLORS.punitive)
					.setTitle("Rob Backfired!")
					.setDescription(
						`You tried to rob ${target} but got caught!\nYou were fined **${fined.toLocaleString()} coins**.`,
					)
					.addFields({
						name: "Your Balance",
						value: `${wallet.balance.toLocaleString()} coins`,
						inline: true,
					});
			} else {
				embed
					.setColor(EMBED_COLORS.economy)
					.setTitle("Successful Rob!")
					.setDescription(
						`You robbed ${target} and stole **${stolen.toLocaleString()} coins**!`,
					)
					.addFields({
						name: "Your Balance",
						value: `${wallet.balance.toLocaleString()} coins`,
						inline: true,
					});
			}

			embed.setFooter({ text: "Cooldown: 4 hours" });
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
