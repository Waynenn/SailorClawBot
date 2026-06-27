import {
  ChannelType,
  type Client,
  type Message,
  type PartialMessage,
  type GuildMember,
  type PartialGuildMember,
  type VoiceState,
  type GuildBan,
  type Role,
  type GuildChannel,
  type DMChannel,
  type NonThreadGuildBasedChannel,
} from 'discord.js';
import type { GuildSettingsDto } from '@sailorclawbot/contracts';
import type { Container } from '../container.js';
import { sendLog, type LogEntry } from '../lib/LogService.js';

async function settingsFor(container: Container, guildId: string | null | undefined): Promise<GuildSettingsDto | null> {
  if (!guildId) return null;
  return container.guildSettingsRepo.findByGuild(guildId);
}

async function emit(client: Client, container: Container, guildId: string | null | undefined, entry: LogEntry): Promise<void> {
  const settings = await settingsFor(container, guildId);
  if (!settings) return;
  await sendLog(client, settings, entry);
}

function channelTypeName(type: ChannelType): string {
  return ChannelType[type] ?? String(type);
}

export function registerLoggingHandlers(client: Client, container: Container): void {
  // ---- Messages -----------------------------------------------------------
  client.on('messageDelete', async (message: Message | PartialMessage) => {
    const cached = await container.messageCache.get(message.id);
    const guildId = message.guildId ?? cached?.guildId;
    const channelId = message.channelId ?? cached?.channelId;
    const authorId = message.author?.id ?? cached?.authorId;
    if (authorId && message.author?.bot) return;
    const content = cached?.content ?? message.content ?? '*(content unavailable)*';

    await emit(client, container, guildId, {
      event: 'messageDelete',
      title: '🗑️ Message Deleted',
      target: authorId,
      channelId,
      description: `**Channel:** <#${channelId}>\n${content.slice(0, 1800) || '*(no text)*'}`,
    });
    await container.messageCache.delete(message.id);
  });

  client.on('messageUpdate', async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
    if (newMessage.author?.bot) return;
    const cached = await container.messageCache.get(newMessage.id);
    const guildId = newMessage.guildId ?? cached?.guildId;
    const channelId = newMessage.channelId ?? cached?.channelId;
    const before = cached?.content ?? oldMessage.content ?? '*(unavailable)*';
    const after = newMessage.content ?? '';
    if (before === after) return; // ignore embed/pin-only updates

    await emit(client, container, guildId, {
      event: 'messageEdit',
      title: '✏️ Message Edited',
      target: newMessage.author?.id ?? cached?.authorId,
      channelId,
      fields: [
        { name: 'Channel', value: `<#${channelId}>` },
        { name: 'Before', value: before.slice(0, 1024) || '*(empty)*' },
        { name: 'After', value: after.slice(0, 1024) || '*(empty)*' },
      ],
    });

    // Refresh cache so a later edit diffs against the latest version.
    if (cached) await container.messageCache.set({ ...cached, content: after });
  });

  client.on('messageDeleteBulk', async (messages, channel) => {
    const guildChannel = channel as NonThreadGuildBasedChannel;
    await emit(client, container, guildChannel.guildId, {
      event: 'messageBulkDelete',
      title: '🧹 Bulk Message Delete',
      channelId: guildChannel.id,
      fields: [
        { name: 'Channel', value: `<#${guildChannel.id}>`, inline: true },
        { name: 'Count', value: String(messages.size), inline: true },
      ],
    });
  });

  // ---- Members ------------------------------------------------------------
  client.on('guildMemberAdd', async (member: GuildMember) => {
    const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
    await emit(client, container, member.guild.id, {
      event: 'join',
      title: '📥 Member Joined',
      target: member.id,
      fields: [
        { name: 'Account age', value: `${ageDays}d`, inline: true },
        { name: 'Member count', value: String(member.guild.memberCount), inline: true },
      ],
    });
  });

  client.on('guildMemberRemove', async (member: GuildMember | PartialGuildMember) => {
    const roles = member.roles?.cache?.filter((r) => r.id !== member.guild.id).map((r) => `<@&${r.id}>`) ?? [];
    await emit(client, container, member.guild.id, {
      event: 'leave',
      title: '📤 Member Left',
      target: member.id,
      fields: roles.length > 0 ? [{ name: 'Roles', value: roles.join(', ').slice(0, 1024) }] : undefined,
    });
  });

  client.on('guildMemberUpdate', async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    const fields: LogEntry['fields'] = [];

    if (oldMember.nickname !== newMember.nickname) {
      fields.push({ name: 'Nickname', value: `${oldMember.nickname ?? '*(none)*'} → ${newMember.nickname ?? '*(none)*'}` });
    }

    const oldRoles = oldMember.roles?.cache;
    const newRoles = newMember.roles.cache;
    if (oldRoles) {
      const added = newRoles.filter((r) => !oldRoles.has(r.id)).map((r) => `<@&${r.id}>`);
      const removed = oldRoles.filter((r) => !newRoles.has(r.id)).map((r) => `<@&${r.id}>`);
      if (added.length > 0) fields.push({ name: 'Roles added', value: added.join(', ').slice(0, 1024) });
      if (removed.length > 0) fields.push({ name: 'Roles removed', value: removed.join(', ').slice(0, 1024) });
    }

    if (fields.length === 0) return;
    await emit(client, container, newMember.guild.id, {
      event: 'memberUpdate',
      title: '🔧 Member Updated',
      target: newMember.id,
      fields,
    });
  });

  // ---- Bans (external — bot commands log separately) ----------------------
  client.on('guildBanAdd', async (ban: GuildBan) => {
    await emit(client, container, ban.guild.id, {
      event: 'ban',
      title: '🔨 Member Banned',
      target: ban.user.id,
      reason: ban.reason ?? undefined,
    });
  });

  client.on('guildBanRemove', async (ban: GuildBan) => {
    await emit(client, container, ban.guild.id, {
      event: 'unban',
      title: '♻️ Member Unbanned',
      target: ban.user.id,
    });
  });

  // ---- Channels -----------------------------------------------------------
  client.on('channelCreate', async (channel: GuildChannel) => {
    await emit(client, container, channel.guild.id, {
      event: 'channelCreate',
      title: '📁 Channel Created',
      channelId: channel.id,
      fields: [
        { name: 'Channel', value: `<#${channel.id}> (${channel.name})`, inline: true },
        { name: 'Type', value: channelTypeName(channel.type), inline: true },
      ],
    });
  });

  client.on('channelDelete', async (channel: GuildChannel | DMChannel) => {
    if (!('guild' in channel)) return;
    await emit(client, container, channel.guild.id, {
      event: 'channelDelete',
      title: '🗂️ Channel Deleted',
      fields: [
        { name: 'Name', value: channel.name, inline: true },
        { name: 'Type', value: channelTypeName(channel.type), inline: true },
      ],
    });
  });

  client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!('guild' in newChannel) || !('name' in oldChannel) || !('name' in newChannel)) return;
    if (oldChannel.name === newChannel.name) return; // only log renames (cheap, high-signal)
    await emit(client, container, newChannel.guild.id, {
      event: 'channelUpdate',
      title: '🔧 Channel Updated',
      channelId: newChannel.id,
      fields: [{ name: 'Name', value: `${oldChannel.name} → ${newChannel.name}` }],
    });
  });

  // ---- Roles --------------------------------------------------------------
  client.on('roleCreate', async (role: Role) => {
    await emit(client, container, role.guild.id, {
      event: 'roleCreate',
      title: '✨ Role Created',
      fields: [{ name: 'Role', value: `${role.name} (\`${role.id}\`)` }],
    });
  });

  client.on('roleDelete', async (role: Role) => {
    await emit(client, container, role.guild.id, {
      event: 'roleDelete',
      title: '🗑️ Role Deleted',
      fields: [{ name: 'Role', value: `${role.name} (\`${role.id}\`)` }],
    });
  });

  client.on('roleUpdate', async (oldRole: Role, newRole: Role) => {
    if (oldRole.name === newRole.name) return; // only log renames
    await emit(client, container, newRole.guild.id, {
      event: 'roleUpdate',
      title: '🔧 Role Updated',
      fields: [{ name: 'Name', value: `${oldRole.name} → ${newRole.name}` }],
    });
  });

  // ---- Voice --------------------------------------------------------------
  client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    const guildId = newState.guild.id;
    const userId = newState.id;

    if (!oldState.channelId && newState.channelId) {
      await emit(client, container, guildId, {
        event: 'voiceJoin',
        title: '🔊 Voice Join',
        target: userId,
        channelId: newState.channelId,
        fields: [{ name: 'Channel', value: `<#${newState.channelId}>` }],
      });
    } else if (oldState.channelId && !newState.channelId) {
      await emit(client, container, guildId, {
        event: 'voiceLeave',
        title: '🔇 Voice Leave',
        target: userId,
        channelId: oldState.channelId,
        fields: [{ name: 'Channel', value: `<#${oldState.channelId}>` }],
      });
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await emit(client, container, guildId, {
        event: 'voiceMove',
        title: '🔀 Voice Move',
        target: userId,
        channelId: newState.channelId,
        fields: [{ name: 'Channel', value: `<#${oldState.channelId}> → <#${newState.channelId}>` }],
      });
    }
  });
}
