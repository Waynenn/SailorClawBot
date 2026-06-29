import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import type { Command } from "../index.js";

export const softbanCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("softban")
		.setDescription(
			"Ban then immediately unban a user (purges messages without permanent ban)",
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.addUserOption((o) =>
			o.setName("user").setDescription("User to softban").setRequired(true),
		)
		.addStringOption((o) =>
			o.setName("reason").setDescription("Reason"),
		) as SlashCommandBuilder,

	async execute(
		interaction: ChatInputCommandInteraction,
		_container: Container,
	): Promise<void> {
		const target = interaction.options.getUser("user", true);
		const reason = interaction.options.getString("reason") ?? "Softban";

		await interaction.deferReply({ ephemeral: true });

		await interaction.guild!.members.ban(target.id, {
			reason,
			deleteMessageSeconds: 604800,
		});
		const unbanned = await interaction
			.guild!.members.unban(target.id, "Softban — automatic unban")
			.then(() => true)
			.catch(() => false);

		const embed = new EmbedBuilder()
			.setColor(EMBED_COLORS.punitive)
			.setTitle("🔨 Softban")
			.setDescription(
				`**${target.username}** was softbanned.\nReason: ${reason}`,
			);

		if (!unbanned) {
			embed.addFields({
				name: "⚠️ Warning",
				value:
					"Auto-unban failed — user may still be banned. Please unban manually.",
			});
		}

		await interaction.editReply({ embeds: [embed] });
	},
};
