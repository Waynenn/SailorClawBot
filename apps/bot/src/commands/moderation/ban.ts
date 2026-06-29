import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

export const banCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("ban")
		.setDescription("Ban a member from the server")
		.addUserOption((o) =>
			o.setName("user").setDescription("Member to ban").setRequired(true),
		)
		.addStringOption((o) =>
			o.setName("reason").setDescription("Reason for ban").setRequired(true),
		)
		.addIntegerOption((o) =>
			o
				.setName("duration")
				.setDescription("Duration in days (omit for permanent)")
				.setMinValue(1)
				.setMaxValue(365),
		)
		.setDefaultMemberPermissions(0n),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const target = interaction.options.getUser("user", true);
		const reason = interaction.options.getString("reason", true);
		const duration = interaction.options.getInteger("duration") ?? undefined;
		const guildId = interaction.guildId!;
		const guild = interaction.guild!;
		const moderatorId = interaction.user.id;
		const selfMember = interaction.member as GuildMember;

		const canBan = await container.permissionService.hasPermission(
			guildId,
			moderatorId,
			"can_ban",
			{
				discordRoleIds: selfMember.roles.cache.map((r) => r.id),
				isGuildOwner: guild.ownerId === moderatorId,
			},
		);
		if (!canBan) {
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(EMBED_COLORS.punitive)
						.setDescription("🚫 You lack permission to ban members."),
				],
			});
			return;
		}

		try {
			const ban = await container.moderationService.banUser(
				guildId,
				target.id,
				reason,
				moderatorId,
				duration,
			);

			const discordOk = await guild.members
				.ban(target.id, { reason: `[Case #${ban.caseNumber}] ${reason}` })
				.then(() => true)
				.catch(() => false);

			const expiry =
				ban.expiresAt instanceof Date
					? `until <t:${Math.floor(ban.expiresAt.getTime() / 1000)}:R>`
					: "permanently";

			const embed = new EmbedBuilder()
				.setColor(EMBED_COLORS.punitive)
				.setTitle("🔨 Member Banned")
				.addFields(
					{
						name: "User",
						value: `${target.username} (${target.id})`,
						inline: true,
					},
					{ name: "Duration", value: expiry, inline: true },
					{ name: "Case", value: `#${ban.caseNumber}`, inline: true },
					{ name: "Reason", value: reason },
				)
				.setTimestamp();

			if (!discordOk) {
				embed.addFields({
					name: "⚠️ Warning",
					value: "Logged in DB but Discord ban failed — check bot permissions.",
				});
			}

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
