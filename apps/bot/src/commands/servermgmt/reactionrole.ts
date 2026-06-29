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

export const reactionroleCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("reactionrole")
		.setDescription("Manage reaction roles")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
		.addSubcommand((s) =>
			s
				.setName("add")
				.setDescription("Add a reaction role to a message")
				.addStringOption((o) =>
					o
						.setName("message_id")
						.setDescription("Message ID")
						.setRequired(true),
				)
				.addChannelOption((o) =>
					o
						.setName("channel")
						.setDescription("Channel with the message")
						.setRequired(true),
				)
				.addStringOption((o) =>
					o
						.setName("emoji")
						.setDescription("Emoji (Unicode or custom)")
						.setRequired(true),
				)
				.addRoleOption((o) =>
					o.setName("role").setDescription("Role to assign").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("remove")
				.setDescription("Remove a reaction role")
				.addStringOption((o) =>
					o
						.setName("message_id")
						.setDescription("Message ID")
						.setRequired(true),
				)
				.addStringOption((o) =>
					o.setName("emoji").setDescription("Emoji").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("list")
				.setDescription("List reaction roles on a message")
				.addStringOption((o) =>
					o
						.setName("message_id")
						.setDescription("Message ID")
						.setRequired(true),
				),
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const guildId = interaction.guildId!;
		const sub = interaction.options.getSubcommand();

		try {
			if (sub === "add") {
				const messageId = interaction.options.getString("message_id", true);
				const channel = interaction.options.getChannel("channel", true);
				const emoji = interaction.options.getString("emoji", true);
				const role = interaction.options.getRole("role", true);

				await container.reactionRoleRepo.create({
					guildId,
					messageId,
					channelId: channel.id,
					emoji,
					roleId: role.id,
				});

				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setTitle("✅ Reaction role added")
							.addFields(
								{ name: "Message", value: messageId, inline: true },
								{ name: "Emoji", value: emoji, inline: true },
								{ name: "Role", value: `<@&${role.id}>`, inline: true },
							),
					],
				});
			} else if (sub === "remove") {
				const messageId = interaction.options.getString("message_id", true);
				const emoji = interaction.options.getString("emoji", true);
				await container.reactionRoleRepo.deleteByMessageAndEmoji(
					guildId,
					messageId,
					emoji,
				);
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setDescription(
								`✅ Reaction role for ${emoji} on message \`${messageId}\` removed.`,
							),
					],
				});
			} else {
				const messageId = interaction.options.getString("message_id", true);
				const entries = await container.reactionRoleRepo.findByMessage(
					guildId,
					messageId,
				);
				if (entries.length === 0) {
					await interaction.editReply({
						content: "No reaction roles on that message.",
					});
					return;
				}
				const lines = entries.map((e) => `${e.emoji} → <@&${e.roleId}>`);
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setTitle("Reaction Roles")
							.setDescription(lines.join("\n")),
					],
				});
			}
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
