import type { Client, GuildMember, PartialGuildMember } from 'discord.js';
import type { Container } from '../container.js';

export function registerGuildMemberRemoveHandler(client: Client, container: Container): void {
  client.on('guildMemberRemove', async (member: GuildMember | PartialGuildMember) => {
    const guildId = member.guild.id;
    const settings = await container.guildSettingsRepo.findByGuild(guildId);
    if (!settings?.leaveChannelId || !settings.leaveMessage) return;

    const channel = await member.guild.channels.fetch(settings.leaveChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;

    const username = member.user?.username ?? 'Unknown';
    const msg = settings.leaveMessage
      .replace('{username}', username)
      .replace('{mention}', `<@${member.id}>`)
      .replace('{server}', member.guild.name)
      .replace('{memberCount}', String(member.guild.memberCount))
      .replace('{date}', new Date().toLocaleDateString());

    await channel.send(msg).catch(() => null);
  });
}
