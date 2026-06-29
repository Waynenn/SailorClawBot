import { NotFoundError } from "@sailorclawbot/core";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import type { Command } from "../index.js";

export const rankCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("rank")
		.setDescription("Показать уровень и XP пользователя")
		.addUserOption((o) =>
			o.setName("user").setDescription("Пользователь (по умолчанию — вы)"),
		),

	async execute(interaction, container) {
		await interaction.deferReply();

		const target = interaction.options.getUser("user") ?? interaction.user;
		const guildId = interaction.guildId!;

		let profile: Awaited<
			ReturnType<typeof container.profileService.getProfile>
		>;
		try {
			profile = await container.profileService.getProfile(guildId, target.id);
		} catch (e) {
			if (e instanceof NotFoundError) {
				await interaction.editReply({
					content: `У ${target.username} ещё нет профиля.`,
				});
				return;
			}
			throw e;
		}

		const rank = await container.xpService.getRank(guildId, target.id);
		const xpNeeded = container.xpService.xpNeededForLevel(profile.level);
		const xpPct = Math.min(100, Math.floor((profile.xp / xpNeeded) * 100));
		const barLen = 20;
		const filled = Math.round((xpPct / 100) * barLen);
		const bar = "█".repeat(filled) + "░".repeat(barLen - filled);

		const embed = new EmbedBuilder()
			.setColor(EMBED_COLORS.xp)
			.setTitle(`🏅 ${target.username}`)
			.setThumbnail(target.displayAvatarURL())
			.addFields(
				{ name: "Уровень", value: String(profile.level), inline: true },
				{ name: "Ранг", value: `#${rank}`, inline: true },
				{ name: "Всего XP", value: String(profile.totalXp), inline: true },
				{
					name: `XP [${xpPct}%]`,
					value: `\`${bar}\` ${profile.xp}/${xpNeeded}`,
				},
			);

		await interaction.editReply({ embeds: [embed] });
	},
};
