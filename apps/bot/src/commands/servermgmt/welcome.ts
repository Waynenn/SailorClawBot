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

export const welcomeCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("welcome")
		.setDescription("Configure welcome and leave messages")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((s) =>
			s
				.setName("set")
				.setDescription("Set welcome message and channel")
				.addChannelOption((o) =>
					o
						.setName("channel")
						.setDescription("Welcome channel")
						.setRequired(true),
				)
				.addStringOption((o) =>
					o
						.setName("message")
						.setDescription(
							"Template: {username} {mention} {server} {memberCount} {date}",
						)
						.setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("leave")
				.setDescription("Set leave message and channel")
				.addChannelOption((o) =>
					o
						.setName("channel")
						.setDescription("Leave channel")
						.setRequired(true),
				)
				.addStringOption((o) =>
					o
						.setName("message")
						.setDescription("Message template")
						.setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s.setName("disable").setDescription("Disable welcome and leave messages"),
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const guildId = interaction.guildId!;
		const sub = interaction.options.getSubcommand();

		try {
			if (sub === "set") {
				const channel = interaction.options.getChannel("channel", true);
				const message = interaction.options.getString("message", true);
				await container.guildSettingsRepo.upsert(guildId, {
					welcomeChannelId: channel.id,
					welcomeMessage: message,
				});
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setTitle("✅ Welcome message configured")
							.addFields(
								{ name: "Channel", value: `<#${channel.id}>`, inline: true },
								{ name: "Message", value: message },
							),
					],
				});
			} else if (sub === "leave") {
				const channel = interaction.options.getChannel("channel", true);
				const message = interaction.options.getString("message", true);
				await container.guildSettingsRepo.upsert(guildId, {
					leaveChannelId: channel.id,
					leaveMessage: message,
				});
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setTitle("✅ Leave message configured")
							.addFields(
								{ name: "Channel", value: `<#${channel.id}>`, inline: true },
								{ name: "Message", value: message },
							),
					],
				});
			} else {
				await container.guildSettingsRepo.upsert(guildId, {
					welcomeChannelId: null,
					welcomeMessage: null,
					leaveChannelId: null,
					leaveMessage: null,
				});
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setDescription("✅ Welcome and leave messages disabled."),
					],
				});
			}
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
