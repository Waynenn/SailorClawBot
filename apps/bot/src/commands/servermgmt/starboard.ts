import type { ChatInputCommandInteraction } from "discord.js";
import {
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

export const starboardCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("starboard")
		.setDescription("Configure the starboard")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((s) =>
			s
				.setName("setup")
				.setDescription("Enable starboard")
				.addChannelOption((o) =>
					o
						.setName("channel")
						.setDescription("Starboard channel")
						.setRequired(true),
				)
				.addIntegerOption((o) =>
					o
						.setName("threshold")
						.setDescription("Stars needed (default: 3)")
						.setMinValue(1)
						.setMaxValue(100),
				),
		)
		.addSubcommand((s) =>
			s.setName("disable").setDescription("Disable starboard"),
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const guildId = interaction.guildId!;
		const sub = interaction.options.getSubcommand();

		try {
			if (sub === "setup") {
				const channel = interaction.options.getChannel("channel", true);
				const threshold = interaction.options.getInteger("threshold") ?? 3;
				await container.guildSettingsRepo.upsert(guildId, {
					starboardEnabled: true,
					starboardChannelId: channel.id,
					starboardThreshold: threshold,
				});
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.starboard)
							.setTitle("⭐ Starboard enabled")
							.addFields(
								{ name: "Channel", value: `<#${channel.id}>`, inline: true },
								{ name: "Threshold", value: `${threshold} ⭐`, inline: true },
							),
					],
				});
			} else {
				await container.guildSettingsRepo.upsert(guildId, {
					starboardEnabled: false,
					starboardChannelId: null,
				});
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setDescription("⭐ Starboard disabled."),
					],
				});
			}
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
