import { pickWinners } from '@sailorclawbot/core';
import type { Container } from '../container.js';
import { editMessage, postMessage, dmUser } from '../lib/discord.js';
import { COLORS } from '../lib/colors.js';

/**
 * End giveaways whose timer has elapsed: draw winners, persist, edit the
 * original message, announce, and DM each winner. Idempotent via the repo's
 * findExpired (endedAt: null) — a re-run never picks a finished giveaway twice.
 */
export async function processGiveawayEnd(c: Container): Promise<void> {
  const expired = await c.giveawayRepo.findExpired();
  if (expired.length === 0) return;

  c.logger.info('Processing ended giveaways', { count: expired.length });

  for (const g of expired) {
    try {
      const winners = pickWinners(g.participants, g.winnersCount);
      await c.giveawayRepo.end(g.id, winners);

      const winnerMentions = winners.length > 0 ? winners.map((id) => `<@${id}>`).join(', ') : null;

      if (g.messageId) {
        await editMessage(c.rest, g.channelId, g.messageId, {
          embeds: [
            {
              title: '🎉 Giveaway Ended',
              color: COLORS.giveaway,
              description: `**Prize:** ${g.prize}\n**Winners:** ${winnerMentions ?? '*No valid entries*'}`,
              fields: [{ name: 'Entries', value: `${g.participants.length}`, inline: true }],
              timestamp: new Date().toISOString(),
            },
          ],
        }).catch((err) => c.logger.warn('Failed to edit giveaway message', { id: g.id, err: String(err) }));
      }

      const announcement = winnerMentions
        ? `🎉 Congratulations ${winnerMentions}! You won **${g.prize}**.`
        : `No valid entries for **${g.prize}** — no winner drawn.`;
      await postMessage(c.rest, g.channelId, { content: announcement }).catch((err) =>
        c.logger.warn('Failed to announce giveaway winners', { id: g.id, err: String(err) })
      );

      for (const winnerId of winners) {
        await dmUser(c.rest, winnerId, {
          embeds: [
            {
              title: '🎉 You won a giveaway!',
              color: COLORS.giveaway,
              description: `You won **${g.prize}**! Contact the host <@${g.hostId}> to claim it.`,
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }
    } catch (error) {
      c.logger.error('Failed to end giveaway', { id: g.id, guildId: g.guildId, error: String(error) });
    }
  }
}
