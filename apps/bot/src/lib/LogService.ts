import type { GuildSettingsDto } from "@sailorclawbot/contracts";
import { type Client, EmbedBuilder, type TextChannel } from "discord.js";
import { EMBED_COLORS } from "./embedColors.js";

export type LogEvent =
	| "ban"
	| "unban"
	| "mute"
	| "unmute"
	| "warn"
	| "kick"
	| "join"
	| "leave"
	| "messageDelete"
	| "messageBulkDelete"
	| "messageEdit"
	| "memberUpdate"
	| "channelCreate"
	| "channelDelete"
	| "channelUpdate"
	| "roleCreate"
	| "roleDelete"
	| "roleUpdate"
	| "voiceJoin"
	| "voiceLeave"
	| "voiceMove";

export interface LogField {
	name: string;
	value: string;
	inline?: boolean;
}

export interface LogEntry {
	event: LogEvent;
	title?: string;
	actor?: string; // moderator / acting user id
	target?: string; // affected user id
	channelId?: string; // where the event happened (drives ignore-routing)
	reason?: string;
	caseId?: number;
	description?: string;
	fields?: LogField[];
}

const PUNITIVE = new Set<LogEvent>(["ban", "mute", "warn", "kick"]);
const RESTORATIVE = new Set<LogEvent>(["unban", "unmute"]);

function colorFor(event: LogEvent): number {
	if (PUNITIVE.has(event)) return EMBED_COLORS.punitive;
	if (RESTORATIVE.has(event)) return EMBED_COLORS.restorative;
	return EMBED_COLORS.info;
}

/**
 * Resolve which channel an event logs to, honoring (in order): the event-type
 * filter, ignored source channels, the per-event override map, and finally the
 * fallback log channel. Returns null when the event should not be logged.
 */
export function resolveLogChannelId(
	settings: GuildSettingsDto,
	entry: LogEntry,
): string | null {
	// Event-type gate (empty filter = log everything)
	if (
		settings.logEvents.length > 0 &&
		!settings.logEvents.includes(entry.event)
	)
		return null;
	// Ignored source channel (e.g. spam channel)
	if (entry.channelId && settings.logIgnoredChannels.includes(entry.channelId))
		return null;
	// Per-event override → fallback channel
	return (
		settings.logChannelOverrides[entry.event] ?? settings.logChannelId ?? null
	);
}

/** Build and dispatch a log embed to the resolved channel. Best-effort: never throws. */
export async function sendLog(
	client: Client,
	settings: GuildSettingsDto,
	entry: LogEntry,
): Promise<void> {
	const channelId = resolveLogChannelId(settings, entry);
	if (!channelId) return;

	const channel = (await client.channels
		.fetch(channelId)
		.catch(() => null)) as TextChannel | null;
	if (!channel?.isTextBased()) return;

	const embed = new EmbedBuilder()
		.setColor(colorFor(entry.event))
		.setTitle(entry.title ?? `📋 ${entry.event}`)
		.setTimestamp();

	if (entry.description) embed.setDescription(entry.description.slice(0, 4000));
	if (entry.actor)
		embed.addFields({
			name: "Moderator",
			value: `<@${entry.actor}>`,
			inline: true,
		});
	if (entry.target)
		embed.addFields({
			name: "User",
			value: `<@${entry.target}>`,
			inline: true,
		});
	if (entry.caseId)
		embed.addFields({ name: "Case", value: `#${entry.caseId}`, inline: true });
	if (entry.reason)
		embed.addFields({ name: "Reason", value: entry.reason.slice(0, 1024) });
	if (entry.fields?.length)
		embed.addFields(
			entry.fields.map((f) => ({ ...f, value: f.value.slice(0, 1024) })),
		);

	await channel.send({ embeds: [embed] }).catch(() => null);
}
