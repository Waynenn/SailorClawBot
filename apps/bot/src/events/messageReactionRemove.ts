import { type Client, type MessageReaction, type PartialMessageReaction, type User, type PartialUser } from 'discord.js';
import type { Container } from '../container.js';

function normalizeEmoji(reaction: MessageReaction | PartialMessageReaction): string {
  return reaction.emoji.id ?? reaction.emoji.name ?? '';
}

async function handleReactionRoleRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  container: Container
): Promise<void> {
  if (!reaction.message.guildId) return;
  const guildId = reaction.message.guildId;
  const messageId = reaction.message.id;
  const emoji = normalizeEmoji(reaction);

  const rr = await container.reactionRoleRepo.findByMessageAndEmoji(guildId, messageId, emoji);
  if (!rr) return;

  const guild = reaction.message.guild;
  if (!guild) return;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.remove(rr.roleId).catch(() => null);
}

async function handleStarboardRemove(
  reaction: MessageReaction | PartialMessageReaction,
  container: Container
): Promise<void> {
  const msg = reaction.message;
  if (!msg.guildId || reaction.emoji.name !== '⭐') return;

  const guildId = msg.guildId;
  const settings = await container.guildSettingsRepo.findByGuild(guildId);
  if (!settings?.starboardEnabled || !settings.starboardChannelId) return;

  const full = msg.partial ? await msg.fetch().catch(() => null) : msg;
  if (!full) return;

  const starCount = full.reactions.cache.get('⭐')?.count ?? 0;
  const threshold = settings.starboardThreshold;
  const starboardChannelId = settings.starboardChannelId;

  const result = await container.starboardService.handleReaction(
    guildId,
    full.id,
    starCount,
    threshold,
    async () => {
      // Not expected on remove — create only fires when count first reaches threshold
      throw new Error('buildEntry called unexpectedly during reaction remove');
    }
  ).catch(() => null);

  if (!result) return;

  if (result.action === 'delete' && result.entry) {
    const starboardChannel = await msg.guild?.channels.fetch(starboardChannelId).catch(() => null);
    if (!starboardChannel?.isTextBased()) return;
    const starboardMsg = await starboardChannel.messages.fetch(result.entry.starboardMsgId).catch(() => null);
    await starboardMsg?.delete().catch(() => null);
  } else if (result.action === 'update' && result.entry) {
    const starboardChannel = await msg.guild?.channels.fetch(starboardChannelId).catch(() => null);
    if (!starboardChannel?.isTextBased()) return;
    const starboardMsg = await starboardChannel.messages.fetch(result.entry.starboardMsgId).catch(() => null);
    await starboardMsg?.edit({ content: `⭐ **${starCount}** <#${full.channelId}>` }).catch(() => null);
  }
}

export function registerMessageReactionRemoveHandler(client: Client, container: Container): void {
  client.on('messageReactionRemove', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (user.bot) return;

    await Promise.all([
      handleReactionRoleRemove(reaction, user, container),
      handleStarboardRemove(reaction, container),
    ]);
  });
}
