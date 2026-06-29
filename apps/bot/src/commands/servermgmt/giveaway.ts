import type { ChatInputCommandInteraction } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import type { Container } from "../../container.js";
import { EMBED_COLORS } from "../../lib/embedColors.js";
import { handleCommandError } from "../../middleware/errorHandler.js";
import type { Command } from "../index.js";

function parseDuration(raw: string): number {
	const match = raw.match(/^(\d+)(s|m|h|d)$/);
	if (!match) return 0;
	const n = parseInt(match[1], 10);
	const multipliers: Record<string, number> = {
		s: 1000,
		m: 60_000,
		h: 3_600_000,
		d: 86_400_000,
	};
	return n * (multipliers[match[2]] ?? 0);
}

export const giveawayCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("giveaway")
		.setDescription("Manage giveaways")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((s) =>
			s
				.setName("create")
				.setDescription("Start a giveaway")
				.addStringOption((o) =>
					o
						.setName("prize")
						.setDescription("What to give away")
						.setRequired(true),
				)
				.addStringOption((o) =>
					o
						.setName("duration")
						.setDescription("Duration: 1m, 2h, 3d")
						.setRequired(true),
				)
				.addIntegerOption((o) =>
					o
						.setName("winners")
						.setDescription("Number of winners")
						.setMinValue(1)
						.setMaxValue(20),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("end")
				.setDescription("End a giveaway early")
				.addStringOption((o) =>
					o.setName("id").setDescription("Giveaway ID").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("reroll")
				.setDescription("Reroll winners of an ended giveaway")
				.addStringOption((o) =>
					o.setName("id").setDescription("Giveaway ID").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s.setName("list").setDescription("List active giveaways"),
		),

	async execute(
		interaction: ChatInputCommandInteraction,
		container: Container,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const guildId = interaction.guildId!;
		const sub = interaction.options.getSubcommand();

		try {
			if (sub === "create") {
				const prize = interaction.options.getString("prize", true);
				const durationRaw = interaction.options.getString("duration", true);
				const winnersCount = interaction.options.getInteger("winners") ?? 1;
				const durationMs = parseDuration(durationRaw);
				if (durationMs < 60_000) {
					await interaction.editReply({
						content:
							"Duration must be at least 1 minute (e.g. `1m`, `2h`, `1d`).",
					});
					return;
				}

				const giveaway = await container.giveawayService.create({
					guildId,
					channelId: interaction.channelId,
					prize,
					winnersCount,
					durationMs,
					hostId: interaction.user.id,
				});

				const embed = new EmbedBuilder()
					.setColor(EMBED_COLORS.giveaway)
					.setTitle("🎉 GIVEAWAY 🎉")
					.setDescription(`**${prize}**`)
					.addFields(
						{ name: "Winners", value: String(winnersCount), inline: true },
						{
							name: "Ends",
							value: `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`,
							inline: true,
						},
						{
							name: "Hosted by",
							value: `<@${interaction.user.id}>`,
							inline: true,
						},
					)
					.setFooter({ text: `ID: ${giveaway.id}` })
					.setTimestamp(giveaway.endsAt);

				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId(`giveaway_join_${giveaway.id}`)
						.setLabel("🎉 Enter")
						.setStyle(ButtonStyle.Primary),
				);

				const channel = interaction.channel;
				if (channel?.isTextBased() && !channel.isDMBased()) {
					const msg = await channel.send({
						embeds: [embed],
						components: [row],
					});
					await container.giveawayRepo.setMessageId(giveaway.id, msg.id);
				}
				await interaction.editReply({
					content: `✅ Giveaway started! ID: \`${giveaway.id}\``,
				});
			} else if (sub === "end") {
				const id = interaction.options.getString("id", true);
				const { giveaway, winners } = await container.giveawayService.end(id);
				const winnerMentions =
					winners.length > 0
						? winners.map((w) => `<@${w}>`).join(", ")
						: "No participants";
				const channel = await interaction.guild?.channels
					.fetch(giveaway.channelId)
					.catch(() => null);
				if (channel?.isTextBased()) {
					await channel
						.send({
							content: `🎉 **${giveaway.prize}** winners: ${winnerMentions}`,
							allowedMentions: { parse: ["users"] },
						})
						.catch(() => null);
				}
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.giveaway)
							.setTitle("Giveaway Ended")
							.setDescription(`Winners: ${winnerMentions}`),
					],
				});
			} else if (sub === "reroll") {
				const id = interaction.options.getString("id", true);
				const { giveaway, winners } =
					await container.giveawayService.reroll(id);
				const winnerMentions =
					winners.length > 0
						? winners.map((w) => `<@${w}>`).join(", ")
						: "No participants";
				const channel = await interaction.guild?.channels
					.fetch(giveaway.channelId)
					.catch(() => null);
				if (channel?.isTextBased()) {
					await channel
						.send({
							content: `🔁 **Reroll!** New winners for **${giveaway.prize}**: ${winnerMentions}`,
							allowedMentions: { parse: ["users"] },
						})
						.catch(() => null);
				}
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.giveaway)
							.setTitle("Rerolled")
							.setDescription(`New winners: ${winnerMentions}`),
					],
				});
			} else {
				const active = await container.giveawayService.listActive(guildId);
				if (active.length === 0) {
					await interaction.editReply({ content: "No active giveaways." });
					return;
				}
				const lines = active.map(
					(g) =>
						`• **${g.prize}** — ends <t:${Math.floor(g.endsAt.getTime() / 1000)}:R> (${g.participants.length} entries) \`${g.id}\``,
				);
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.giveaway)
							.setTitle("Active Giveaways")
							.setDescription(lines.join("\n")),
					],
				});
			}
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
