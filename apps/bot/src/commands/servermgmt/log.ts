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

const ALL_LOG_EVENTS = [
	"ban",
	"unban",
	"mute",
	"unmute",
	"warn",
	"kick",
	"join",
	"leave",
	"messageDelete",
	"messageBulkDelete",
	"messageEdit",
	"memberUpdate",
	"channelCreate",
	"channelDelete",
	"channelUpdate",
	"roleCreate",
	"roleDelete",
	"roleUpdate",
	"voiceJoin",
	"voiceLeave",
	"voiceMove",
];

export const logCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("log")
		.setDescription("Configure the mod-log channel")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((s) =>
			s
				.setName("set")
				.setDescription("Set the log channel (logs all events)")
				.addChannelOption((o) =>
					o.setName("channel").setDescription("Log channel").setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("filter")
				.setDescription("Filter which events to log (comma-separated)")
				.addStringOption((o) =>
					o
						.setName("events")
						.setDescription(`Events: ${ALL_LOG_EVENTS.join(", ")}`)
						.setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("ignore")
				.setDescription("Toggle a channel as ignored (excluded from logs)")
				.addChannelOption((o) =>
					o
						.setName("channel")
						.setDescription("Channel to ignore/un-ignore")
						.setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("route")
				.setDescription(
					"Route one event type to its own channel (omit channel to clear)",
				)
				.addStringOption((o) =>
					o
						.setName("event")
						.setDescription(`Event: ${ALL_LOG_EVENTS.join(", ")}`)
						.setRequired(true),
				)
				.addChannelOption((o) =>
					o
						.setName("channel")
						.setDescription("Target channel (omit to clear)")
						.setRequired(false),
				),
		)
		.addSubcommand((s) =>
			s.setName("disable").setDescription("Disable logging"),
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
				await container.guildSettingsRepo.upsert(guildId, {
					logChannelId: channel.id,
					logEvents: [],
				});
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setTitle("✅ Log channel set")
							.setDescription(`Logging all events to <#${channel.id}>`),
					],
				});
			} else if (sub === "filter") {
				const raw = interaction.options.getString("events", true);
				const events = raw
					.split(",")
					.map((e) => e.trim())
					.filter((e) => ALL_LOG_EVENTS.includes(e));
				if (events.length === 0) {
					await interaction.editReply({
						content: `No valid events. Valid: ${ALL_LOG_EVENTS.join(", ")}`,
					});
					return;
				}
				await container.guildSettingsRepo.upsert(guildId, {
					logEvents: events,
				});
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setTitle("✅ Log filter updated")
							.addFields({ name: "Active events", value: events.join(", ") }),
					],
				});
			} else if (sub === "ignore") {
				const channel = interaction.options.getChannel("channel", true);
				const settings = await container.guildSettingsRepo.findByGuild(guildId);
				const current = settings?.logIgnoredChannels ?? [];
				const isIgnored = current.includes(channel.id);
				const next = isIgnored
					? current.filter((id) => id !== channel.id)
					: [...current, channel.id];
				await container.guildSettingsRepo.upsert(guildId, {
					logIgnoredChannels: next,
				});
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setDescription(
								isIgnored
									? `✅ <#${channel.id}> is now logged again.`
									: `🔕 <#${channel.id}> excluded from logs.`,
							),
					],
				});
			} else if (sub === "route") {
				const event = interaction.options.getString("event", true).trim();
				if (!ALL_LOG_EVENTS.includes(event)) {
					await interaction.editReply({
						content: `Invalid event. Valid: ${ALL_LOG_EVENTS.join(", ")}`,
					});
					return;
				}
				const channel = interaction.options.getChannel("channel", false);
				const settings = await container.guildSettingsRepo.findByGuild(guildId);
				const overrides = { ...(settings?.logChannelOverrides ?? {}) };
				if (channel) overrides[event] = channel.id;
				else delete overrides[event];
				await container.guildSettingsRepo.upsert(guildId, {
					logChannelOverrides: overrides,
				});
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setDescription(
								channel
									? `📍 \`${event}\` → <#${channel.id}>`
									: `↩️ \`${event}\` routing cleared (uses default channel).`,
							),
					],
				});
			} else {
				await container.guildSettingsRepo.upsert(guildId, {
					logChannelId: null,
					logEvents: [],
				});
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(EMBED_COLORS.info)
							.setDescription("✅ Logging disabled."),
					],
				});
			}
		} catch (error) {
			await handleCommandError(error, interaction);
		}
	},
};
