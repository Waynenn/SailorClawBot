import type { Client, Message, TextChannel } from 'discord.js';
import { EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import type { AutoModResult } from '@sailorclawbot/contracts';
import type { Container } from '../container.js';
import { EMBED_COLORS } from '../lib/embedColors.js';
import { buildTicketEmbed, ticketActionButtons, updateStatsEmbed } from '../lib/ticketHelper.js';

const xpCooldowns = new Map<string, number>();

async function executeAutoModAction(
  message: Message,
  result: AutoModResult,
  container: import('../container.js').Container
): Promise<void> {
  const BOT_ID = message.client.user?.id ?? 'bot';
  const guildId = message.guildId!;
  const userId = message.author.id;
  const reason = `AutoMod: ${result.ruleType} rule violation`;

  await message.delete().catch(() => null);

  try {
    if (result.action === 'warn') {
      await container.moderationService.warnUser(guildId, userId, reason, BOT_ID);
    } else if (result.action === 'mute') {
      const duration = result.durationMinutes ?? 5;
      await container.moderationService.muteUser(guildId, userId, duration, BOT_ID, reason);
      await message.member?.timeout(duration * 60_000, reason).catch(() => null);
    } else if (result.action === 'kick') {
      await message.member?.kick(reason).catch(() => null);
    } else if (result.action === 'ban') {
      await message.guild?.members.ban(userId, { reason, deleteMessageSeconds: 86400 }).catch(() => null);
    }
  } catch {
    // ignore domain conflicts (e.g. already muted)
  }

  const settings = await container.guildSettingsRepo.findByGuild(guildId);
  if (settings?.logChannelId) {
    const logChannel = await message.guild?.channels.fetch(settings.logChannelId).catch(() => null);
    if (logChannel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🤖 AutoMod Action')
        .addFields(
          { name: 'User', value: `<@${userId}>`, inline: true },
          { name: 'Rule', value: result.ruleType, inline: true },
          { name: 'Action', value: result.action, inline: true },
          { name: 'Content', value: message.content.slice(0, 300) || '(empty)' }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }
  }
}

async function handleTicketOpen(message: Message, container: Container): Promise<boolean> {
  const settings = await container.guildSettingsRepo.findByGuild(message.guildId!);
  if (
    !settings?.ticketChannelId ||
    !settings.ticketCategoryId ||
    message.channelId !== settings.ticketChannelId
  ) {
    return false;
  }

  await message.delete().catch(() => null);

  const guild = message.guild!;
  const ticketNum = await container.ticketService.nextTicketNumber(guild.id);
  const safeName = message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
  const channelName = `ticket-${safeName}-${ticketNum}`;

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: settings.ticketCategoryId,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
  });

  const subject = message.content.slice(0, 200) || null;
  const ticket = await container.ticketService.openTicket(guild.id, message.author.id, ticketChannel.id, subject);

  const embed = buildTicketEmbed(ticket, ticketNum);
  await ticketChannel.send({
    content: `<@${message.author.id}>`,
    embeds: [embed],
    components: [ticketActionButtons(ticket.id)],
  });

  await updateStatsEmbed(guild, container);
  return true;
}

export function registerMessageCreateHandler(client: Client, container: Container): void {
  client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !message.guildId || !message.guild) return;

    const guildId = message.guildId;
    const userId = message.author.id;

    if (await handleTicketOpen(message, container)) return;

    // AutoMod check (before XP — violations should not grant XP)
    const autoModRules = await container.autoModRepo.findAllByGuild(guildId);
    if (autoModRules.length > 0) {
      const result = container.autoModService.checkMessage(
        message.content,
        userId,
        message.channelId,
        guildId,
        autoModRules
      );
      if (result) {
        await executeAutoModAction(message, result, container);
        return;
      }
    }

    const settings = await container.guildSettingsRepo.findByGuild(guildId);
    if (!(settings?.xpEnabled ?? true)) return;

    // Stamp cooldown before any further awaits to prevent concurrent handlers granting XP twice.
    // Restore previous stamp if the user turns out to be excluded (so cooldown is not consumed).
    const cooldownSecs = settings?.xpCooldown ?? 60;
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const prevStamp = xpCooldowns.get(key) ?? 0;
    if (now - prevStamp < cooldownSecs * 1000) return;
    xpCooldowns.set(key, now);

    const channelExcluded = await container.noXpTargetRepo.isExcluded(guildId, message.channelId);
    if (channelExcluded) { xpCooldowns.set(key, prevStamp); return; }

    const memberRoleIds = message.member?.roles.cache.map((r) => r.id) ?? [];
    for (const roleId of memberRoleIds) {
      if (await container.noXpTargetRepo.isExcluded(guildId, roleId)) { xpCooldowns.set(key, prevStamp); return; }
    }

    // Compute XP multiplier (highest wins across channel + roles)
    let multiplier = 1.0;
    const channelMult = await container.xpMultiplierRepo.findByTarget(guildId, message.channelId);
    if (channelMult) multiplier = channelMult.multiplier;
    for (const roleId of memberRoleIds) {
      const roleMult = await container.xpMultiplierRepo.findByTarget(guildId, roleId);
      if (roleMult && roleMult.multiplier > multiplier) multiplier = roleMult.multiplier;
    }

    const xpMin = settings?.xpMin ?? 15;
    const xpMax = settings?.xpMax ?? 25;
    const base = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;
    const amount = Math.max(1, Math.round(base * multiplier));

    await container.profileService.ensureProfile(guildId, userId);

    const { leveled, newLevel, profile } = await container.xpService.grantXp(guildId, userId, amount);
    if (!leveled) return;

    const levelRole = await container.levelRoleRepo.findByLevel(guildId, newLevel);
    if (levelRole && message.member) {
      await message.member.roles.add(levelRole.roleId).catch(() => null);
    }

    const template = settings?.levelUpMessage ?? 'GG {mention}, you reached level **{level}**!';
    const description = template
      .replace('{mention}', `<@${userId}>`)
      .replace('{level}', String(newLevel))
      .replace('{username}', message.author.username);

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.xp)
      .setTitle('🎉 Level Up!')
      .setDescription(description)
      .addFields({ name: 'Total XP', value: String(profile.totalXp), inline: true })
      .setThumbnail(message.author.displayAvatarURL());

    if (settings?.levelUpDm) {
      await message.author.send({ embeds: [embed] }).catch(() => null);
      return;
    }

    const targetChannelId = settings?.levelUpChannelId ?? message.channelId;
    const rawTarget = targetChannelId === message.channelId
      ? message.channel
      : await message.guild.channels.fetch(targetChannelId).catch(() => null);
    const sendChannel = ((rawTarget?.isTextBased() ? rawTarget : null) ?? message.channel) as TextChannel;
    await sendChannel.send({ embeds: [embed] }).catch(() => null);
  });
}
