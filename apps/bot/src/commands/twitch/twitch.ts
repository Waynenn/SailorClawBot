import {
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import type { Command } from "../index.js";

export const twitchCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("twitch")
		.setDescription("Управление уведомлениями о стримах Twitch")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((s) =>
			s
				.setName("add")
				.setDescription("Добавить Twitch-канал для отслеживания")
				.addStringOption((o) =>
					o
						.setName("login")
						.setDescription("Логин Twitch-канала")
						.setRequired(true),
				)
				.addChannelOption((o) =>
					o
						.setName("channel")
						.setDescription("Discord-канал для уведомлений")
						.setRequired(true),
				)
				.addRoleOption((o) =>
					o.setName("role").setDescription("Роль для пинга (необязательно)"),
				)
				.addStringOption((o) =>
					o
						.setName("message")
						.setDescription(
							"Шаблон сообщения: {streamer}, {title}, {game}, {url}",
						),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("remove")
				.setDescription("Удалить Twitch-канал")
				.addStringOption((o) =>
					o
						.setName("login")
						.setDescription("Логин Twitch-канала")
						.setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s.setName("list").setDescription("Список отслеживаемых Twitch-каналов"),
		),

	async execute(interaction, container) {
		await interaction.deferReply({ ephemeral: true });

		const sub = interaction.options.getSubcommand();
		const guildId = interaction.guildId!;

		if (sub === "add") {
			const login = interaction.options.getString("login", true).toLowerCase();
			const discordChannel = interaction.options.getChannel("channel", true);
			const role = interaction.options.getRole("role");
			const customMessage =
				interaction.options.getString("message") ?? undefined;

			const existing = await container.twitchSubRepo.findByLogin(
				guildId,
				login,
			);
			if (existing) {
				await interaction.editReply({
					content: `❌ Канал \`${login}\` уже отслеживается.`,
				});
				return;
			}

			await container.twitchSubRepo.create({
				guildId,
				twitchLogin: login,
				notifyChannelId: discordChannel.id,
				mentionRoleId: role?.id,
				customMessage,
			});

			const embed = new EmbedBuilder()
				.setColor(EMBED_COLORS.info)
				.setDescription(
					`✅ Twitch-канал **${login}** добавлен. Уведомления → <#${discordChannel.id}>${role ? ` (пинг ${role})` : ""}`,
				);
			await interaction.editReply({ embeds: [embed] });
		} else if (sub === "remove") {
			const login = interaction.options.getString("login", true).toLowerCase();
			const sub_ = await container.twitchSubRepo.findByLogin(guildId, login);
			if (!sub_) {
				await interaction.editReply({
					content: `❌ Канал \`${login}\` не найден.`,
				});
				return;
			}
			await container.twitchSubRepo.delete(sub_.id);
			await interaction.editReply({ content: `✅ Канал \`${login}\` удалён.` });
		} else {
			const subs = await container.twitchSubRepo.findByGuild(guildId);
			if (subs.length === 0) {
				await interaction.editReply({
					content: "Нет отслеживаемых Twitch-каналов.",
				});
				return;
			}
			const lines = subs.map(
				(s) =>
					`• **${s.twitchLogin}** → <#${s.notifyChannelId}>${s.mentionRoleId ? ` <@&${s.mentionRoleId}>` : ""}`,
			);
			const embed = new EmbedBuilder()
				.setColor(EMBED_COLORS.info)
				.setTitle("📡 Twitch-уведомления")
				.setDescription(lines.join("\n"));
			await interaction.editReply({ embeds: [embed] });
		}
	},
};
