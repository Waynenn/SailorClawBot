import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import type { Client, Guild, TextChannel } from 'discord.js';
import type { TicketDto, TicketStats } from '@sailorclawbot/contracts';
import { EMBED_COLORS } from './embedColors.js';
import type { Container } from '../container.js';

const TICKET_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function buildTicketEmbed(ticket: TicketDto, ticketNum: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.tickets)
    .setTitle(`🎫 Ticket #${ticketNum}`)
    .addFields(
      { name: 'Opened by', value: `<@${ticket.openedByUserId}>`, inline: true },
      { name: 'Status', value: ticket.status === 'claimed' ? `Claimed by <@${ticket.claimedById}>` : '⏳ Pending', inline: true },
    );
  if (ticket.subject) embed.setDescription(`**Subject:** ${ticket.subject}`);
  embed.setFooter({ text: `Ticket ID: ${ticket.id}` }).setTimestamp(ticket.createdAt);
  return embed;
}

export function ticketActionButtons(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_claim_${ticketId}`)
      .setLabel('Claim')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🙋'),
    new ButtonBuilder()
      .setCustomId(`ticket_close_${ticketId}`)
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
  );
}

export function ratingButtons(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  const stars = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...([1, 2, 3, 4, 5] as const).map((n) =>
      new ButtonBuilder()
        .setCustomId(`ticket_rate_${ticketId}_${n}`)
        .setLabel(stars[n - 1])
        .setStyle(ButtonStyle.Secondary)
    ),
  );
}

export function buildStatsEmbed(stats: TicketStats): EmbedBuilder {
  const total = stats.open + stats.claimed + stats.closed;
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.tickets)
    .setTitle('🎫 Support Tickets')
    .setDescription('Send a message here to open a support ticket.')
    .addFields(
      { name: '📨 Total', value: String(total), inline: true },
      { name: '⏳ Pending', value: String(stats.open), inline: true },
      { name: '🔍 In Progress', value: String(stats.claimed), inline: true },
      { name: '✅ Closed', value: String(stats.closed), inline: true },
    )
    .setTimestamp();
}

export async function lockTicketChannel(channel: TextChannel): Promise<void> {
  // Remove all custom overrides — admins bypass @everyone deny automatically via Discord's permission model
  await channel.permissionOverwrites.set([
    { id: channel.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
  ]).catch(() => null);
  const safeName = channel.name.replace(/^closed-/, '');
  await channel.setName(`closed-${safeName}`).catch(() => null);
}

export function startTicketCleaner(client: Client, container: Container): void {
  const run = async () => {
    const cutoff = new Date(Date.now() - TICKET_RETENTION_MS);
    const expired = await container.ticketService.listExpiredChannels(cutoff).catch(() => []);
    for (const ticket of expired) {
      if (!ticket.channelId) continue;
      const ch = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (ch?.isDMBased() === false) await ch.delete().catch(() => null);
      await container.ticketService.clearChannelId(ticket.id).catch(() => null);
    }
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}

export async function updateStatsEmbed(guild: Guild, container: Container): Promise<void> {
  const settings = await container.guildSettingsRepo.findByGuild(guild.id);
  if (!settings?.ticketChannelId || !settings.ticketStatsMessageId) return;

  const stats = await container.ticketService.getStats(guild.id);
  const embed = buildStatsEmbed(stats);

  const channel = await guild.channels.fetch(settings.ticketChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const msg = await (channel as TextChannel).messages.fetch(settings.ticketStatsMessageId).catch(() => null);
  await msg?.edit({ embeds: [embed] }).catch(() => null);
}
