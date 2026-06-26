import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { EMBED_COLORS } from './embedColors.js';

export type LogEvent =
  | 'ban' | 'unban' | 'mute' | 'unmute' | 'warn' | 'kick'
  | 'join' | 'leave' | 'messageEdit' | 'messageDelete'
  | 'channelCreate' | 'channelDelete';

export interface LogEntry {
  event: LogEvent;
  guildId: string;
  actor?: string;
  target?: string;
  reason?: string;
  caseId?: number;
  extra?: string;
}

export async function sendLog(
  client: Client,
  logChannelId: string,
  logEvents: string[],
  entry: LogEntry
): Promise<void> {
  if (logEvents.length > 0 && !logEvents.includes(entry.event)) return;

  const channel = await client.channels.fetch(logChannelId).catch(() => null) as TextChannel | null;
  if (!channel?.isTextBased()) return;

  const color = ['ban', 'mute', 'warn', 'kick'].includes(entry.event)
    ? EMBED_COLORS.punitive
    : ['unban', 'unmute'].includes(entry.event)
      ? EMBED_COLORS.restorative
      : EMBED_COLORS.info;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📋 ${entry.event.toUpperCase()}`)
    .setTimestamp();

  if (entry.actor) embed.addFields({ name: 'Moderator', value: `<@${entry.actor}>`, inline: true });
  if (entry.target) embed.addFields({ name: 'Target', value: `<@${entry.target}>`, inline: true });
  if (entry.caseId) embed.addFields({ name: 'Case', value: `#${entry.caseId}`, inline: true });
  if (entry.reason) embed.addFields({ name: 'Reason', value: entry.reason });
  if (entry.extra) embed.addFields({ name: 'Details', value: entry.extra });

  await channel.send({ embeds: [embed] }).catch(() => null);
}
