import { EmbedBuilder, type Client, type MessageReaction, type PartialMessageReaction, type User, type PartialUser } from 'discord.js';
import type { Container } from '../container.js';
import { EMBED_COLORS } from '../lib/embedColors.js';

function normalizeEmoji(reaction: MessageReaction | PartialMessageReaction): string {
  return reaction.emoji.id ?? reaction.emoji.name ?? '';
}

async function handleReactionRole(
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

  await member.roles.add(rr.roleId).catch(() => null);
}

async function handleStarboard(
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

  const existing = await container.starboardEntryRepo.findByOriginalMessage(guildId, full.id);

  if (starCount >= threshold && !existing) {
    const starboardChannel = await msg.guild?.channels.fetch(settings.starboardChannelId).catch(() => null);
    if (!starboardChannel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.info)
      .setAuthor({ name: full.author?.tag ?? 'Unknown', iconURL: full.author?.displayAvatarURL() })
      .setDescription(full.content || null)
      .addFields({ name: 'Source', value: `[Jump to message](${full.url})` })
      .setTimestamp(full.createdAt);

    if (full.attachments.first()) embed.setImage(full.attachments.first()!.url);

    const sent = await starboardChannel.send({ content: `⭐ **${starCount}** <#${full.channelId}>`, embeds: [embed] });
    await container.starboardEntryRepo.create({
      guildId,
      originalMsgId: full.id,
      starboardMsgId: sent.id,
      authorId: full.author?.id ?? '',
      channelId: full.channelId,
      starCount,
    }).catch(() => null);
  } else if (starCount >= threshold && existing) {
    const starboardChannel = await msg.guild?.channels.fetch(settings.starboardChannelId).catch(() => null);
    if (!starboardChannel?.isTextBased()) return;
    const starboardMsg = await starboardChannel.messages.fetch(existing.starboardMsgId).catch(() => null);
    if (starboardMsg) {
      await Promise.all([
        starboardMsg.edit({ content: `⭐ **${starCount}** <#${full.channelId}>` }).catch(() => null),
        container.starboardEntryRepo.updateStarCount(guildId, full.id, starCount),
      ]);
    }
  }
}

export function registerMessageReactionAddHandler(client: Client, container: Container): void {
  client.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (user.bot) return;

    await Promise.all([
      handleReactionRole(reaction, user, container),
      handleStarboard(reaction, container),
    ]);
  });
}
