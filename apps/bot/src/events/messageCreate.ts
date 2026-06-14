import type { Client, Message, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { Container } from '../container.js';
import { EMBED_COLORS } from '../lib/embedColors.js';

const xpCooldowns = new Map<string, number>();

export function registerMessageCreateHandler(client: Client, container: Container): void {
  client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !message.guildId || !message.guild) return;

    const guildId = message.guildId;
    const userId = message.author.id;

    const settings = await container.guildSettingsRepo.findByGuild(guildId);
    if (!(settings?.xpEnabled ?? true)) return;

    // Check NoXp exclusions BEFORE consuming cooldown
    const channelExcluded = await container.noXpTargetRepo.isExcluded(guildId, message.channelId);
    if (channelExcluded) return;

    const memberRoleIds = message.member?.roles.cache.map((r) => r.id) ?? [];
    for (const roleId of memberRoleIds) {
      if (await container.noXpTargetRepo.isExcluded(guildId, roleId)) return;
    }

    // Cooldown check + stamp (synchronous — no await between read and write)
    const cooldownSecs = settings?.xpCooldown ?? 60;
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    if (now - (xpCooldowns.get(key) ?? 0) < cooldownSecs * 1000) return;
    xpCooldowns.set(key, now);

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
