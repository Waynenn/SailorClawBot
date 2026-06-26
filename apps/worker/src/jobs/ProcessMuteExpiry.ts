import type { Container } from '../container.js';
import { sendModLog } from '../lib/discord.js';
import { COLORS } from '../lib/colors.js';

/**
 * Settle mutes whose expiry has passed. Discord native timeouts auto-clear, so
 * for ≤28-day mutes this just reconciles our state (isActive=false) and audits.
 *
 * NOTE: role-based mutes for durations >28 days (where the native timeout caps
 * out) need a configured mute role to lift here. That requires a
 * GuildSettings.muteRoleId column (Block 0 schema change, not yet applied) —
 * wire removeMemberRole() in once it exists.
 */
export async function processMuteExpiry(c: Container): Promise<void> {
  const expired = await c.muteRepo.findExpired();
  if (expired.length === 0) return;

  c.logger.info('Processing expired mutes', { count: expired.length });

  for (const mute of expired) {
    try {
      await c.muteRepo.deactivate(mute.id);

      await sendModLog(c.rest, c.guildSettingsRepo, mute.guildId, {
        title: '🔊 Mute Expired',
        color: COLORS.restorative,
        description: `<@${mute.userId}> can speak again. Case #${mute.caseNumber}.`,
        fields: [{ name: 'User', value: `${mute.userId}`, inline: true }],
        timestamp: new Date().toISOString(),
      }).catch((err) => c.logger.warn('Mod-log failed for mute expiry', { id: mute.id, err: String(err) }));
    } catch (error) {
      c.logger.error('Failed to process mute expiry', { id: mute.id, guildId: mute.guildId, error: String(error) });
    }
  }
}
