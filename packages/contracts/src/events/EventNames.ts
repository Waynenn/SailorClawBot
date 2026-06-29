export const EventNames = {
	// Guild lifecycle
	GuildRegistered: "guild.registered",
	GuildUpdated: "guild.updated",
	GuildDeleted: "guild.deleted",

	// Profile lifecycle
	ProfileCreated: "profile.created",
	ProfileUpdated: "profile.updated",
	ProfileDeleted: "profile.deleted",

	// Economy
	WalletCreated: "wallet.created",
	WalletBalanceUpdated: "wallet.balance_updated",
	TransactionCreated: "transaction.created",
	EconomyTransferred: "economy.transferred",
	EconomyDailyRewardClaimed: "economy.daily_reward_claimed",
	EconomyRoleRewardTriggered: "economy.role_reward_triggered",

	// Moderation
	ModerationWarned: "moderation.warned",
	ModerationWarningRemoved: "moderation.warning_removed",
	ModerationMuted: "moderation.muted",
	ModerationUnmuted: "moderation.unmuted",
	ModerationBanned: "moderation.banned",
	ModerationUnbanned: "moderation.unbanned",
	ModerationKicked: "moderation.kicked",
	ModerationCaseCreated: "moderation.case_created",
	ModerationCaseAppealed: "moderation.case_appealed",
	ModerationCaseResolved: "moderation.case_resolved",

	// Tickets
	TicketOpened: "ticket.opened",
	TicketAssigned: "ticket.assigned",
	TicketUnassigned: "ticket.unassigned",
	TicketClosed: "ticket.closed",
	TicketReopened: "ticket.reopened",

	// Leveling
	LevelUp: "level.up",
	LevelDown: "level.down",
	XpGained: "xp.gained",

	// Configuration
	ConfigUpdated: "config.updated",
	RoleMappingUpdated: "role_mapping.updated",
	PermissionOverridden: "permission.overridden",

	// Logging & audit
	AuditActionLogged: "audit.action_logged",
	ErrorLogged: "error.logged",
	RateLimitTriggered: "rate_limit.triggered",
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];
