// ============================================================================
// packages/contracts/src/events/EventNames.ts
// Copy this file directly to packages/contracts/src/events/EventNames.ts
// ============================================================================

export const EventNames = {
  // ========================================================================
  // GUILD LIFECYCLE
  // ========================================================================
  'guild.registered': 'guild.registered',
  'guild.deleted': 'guild.deleted',
  'guild.updated': 'guild.updated',

  // ========================================================================
  // PROFILE LIFECYCLE
  // ========================================================================
  'profile.created': 'profile.created',
  'profile.updated': 'profile.updated',
  'profile.deleted': 'profile.deleted',

  // ========================================================================
  // WALLET & ECONOMY
  // ========================================================================
  'wallet.created': 'wallet.created',
  'wallet.balance_updated': 'wallet.balance_updated',
  'transaction.created': 'transaction.created',
  'economy.transferred': 'economy.transferred',
  'economy.daily_reward_claimed': 'economy.daily_reward_claimed',
  'economy.leaderboard_updated': 'economy.leaderboard_updated',
  'economy.role_reward_triggered': 'economy.role_reward_triggered',

  // ========================================================================
  // MODERATION
  // ========================================================================
  'moderation.warned': 'moderation.warned',
  'moderation.warning_removed': 'moderation.warning_removed',
  'moderation.muted': 'moderation.muted',
  'moderation.unmuted': 'moderation.unmuted',
  'moderation.banned': 'moderation.banned',
  'moderation.unbanned': 'moderation.unbanned',
  'moderation.case_created': 'moderation.case_created',
  'moderation.case_appealed': 'moderation.case_appealed',
  'moderation.case_resolved': 'moderation.case_resolved',

  // ========================================================================
  // TICKETS
  // ========================================================================
  'ticket.opened': 'ticket.opened',
  'ticket.assigned': 'ticket.assigned',
  'ticket.unassigned': 'ticket.unassigned',
  'ticket.closed': 'ticket.closed',
  'ticket.reopened': 'ticket.reopened',

  // ========================================================================
  // LEVELING
  // ========================================================================
  'level.up': 'level.up',
  'level.down': 'level.down',
  'xp.gained': 'xp.gained',

  // ========================================================================
  // CONFIGURATION
  // ========================================================================
  'config.updated': 'config.updated',
  'role_mapping.updated': 'role_mapping.updated',
  'permission.overridden': 'permission.overridden',

  // ========================================================================
  // LOGGING & AUDIT
  // ========================================================================
  'audit.action_logged': 'audit.action_logged',
  'error.logged': 'error.logged',
  'rate_limit.triggered': 'rate_limit.triggered',
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];

// Verify no duplicate values at compile time
const values = Object.values(EventNames);
const uniqueValues = new Set(values);
if (values.length !== uniqueValues.size) {
  throw new Error('EventNames contain duplicate values');
}
