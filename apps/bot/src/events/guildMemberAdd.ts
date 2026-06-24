import type { Client, GuildMember } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { Container } from '../container.js';

const joinTracker = new Map<string, number[]>();
const raidAlertCooldown = new Map<string, number>();
const RAID_ALERT_COOLDOWN_MS = 60_000;

function trackJoin(guildId: string): number {
  const now = Date.now();
  const cutoff = now - 60_000;
  const recent = (joinTracker.get(guildId) ?? []).filter((t) => t > cutoff);
  recent.push(now);
  joinTracker.set(guildId, recent);
  return recent.length;
}

async function sendRaidAlert(member: GuildMember, logChannelId: string, joinsPerMin: number): Promise<void> {
  const channel = await member.guild.channels.fetch(logChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('🚨 Raid Detected')
    .setDescription(`**${joinsPerMin} members** joined in the last 60 seconds. Consider enabling verification.`)
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => null);
}

export function registerGuildMemberAddHandler(client: Client, container: Container): void {
  client.on('guildMemberAdd', async (member: GuildMember) => {
    const guildId = member.guild.id;
    const settings = await container.guildSettingsRepo.findByGuild(guildId);
    if (!settings) return;

    // Account age gate
    if (settings.minAccountAgeDays > 0) {
      const ageDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
      if (ageDays < settings.minAccountAgeDays) {
        await member.kick(`Account too new (${Math.floor(ageDays)}d, min ${settings.minAccountAgeDays}d)`).catch(() => null);
        return;
      }
    }

    // Raid detection
    const joinsPerMin = trackJoin(guildId);
    if (settings.raidJoinsPerMinute > 0 && joinsPerMin >= settings.raidJoinsPerMinute) {
      const now = Date.now();
      const lastAlert = raidAlertCooldown.get(guildId) ?? 0;
      if (settings.logChannelId && now - lastAlert > RAID_ALERT_COOLDOWN_MS) {
        raidAlertCooldown.set(guildId, now);
        await sendRaidAlert(member, settings.logChannelId, joinsPerMin);
      }
      if (settings.raidAutoLock && !settings.verificationEnabled) {
        await container.guildSettingsRepo.upsert(guildId, { verificationEnabled: true });
      }
    }

    // Welcome message
    if (settings.welcomeChannelId && settings.welcomeMessage) {
      const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
      if (channel?.isTextBased()) {
        const msg = settings.welcomeMessage
          .replace('{username}', member.user.username)
          .replace('{mention}', `<@${member.id}>`)
          .replace('{server}', member.guild.name)
          .replace('{memberCount}', String(member.guild.memberCount))
          .replace('{date}', new Date().toLocaleDateString());
        await channel.send(msg).catch(() => null);
      }
    }
  });
}
