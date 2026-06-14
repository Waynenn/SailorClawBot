import type { Warning, Mute, Ban, Case, PermissionOverride, Guild, GuildMember, Profile, LevelRole, XpMultiplier, NoXpTarget, GuildSettings, TwitchSubscription } from '@prisma/client';
import type {
  WarningDto,
  MuteDto,
  BanDto,
  CaseDto,
  ModerationType,
  PermissionOverrideDto,
  GuildDto,
  GuildMemberDto,
  ProfileDto,
  LevelRoleDto,
  XpMultiplierDto,
  NoXpTargetDto,
  GuildSettingsDto,
  TwitchSubscriptionDto,
} from '@sailorclawbot/contracts';

/**
 * Mappers translate Prisma rows (nullable columns) into domain DTOs
 * (optional properties). Prisma `null` becomes `undefined` so consumers
 * never have to handle both.
 */

export function toWarningDto(row: Warning): WarningDto {
  return {
    id: row.id,
    guildId: row.guildId,
    userId: row.userId,
    reason: row.reason,
    moderatorId: row.moderatorId,
    caseNumber: row.caseNumber,
    createdAt: row.createdAt,
  };
}

export function toMuteDto(row: Mute): MuteDto {
  return {
    id: row.id,
    guildId: row.guildId,
    userId: row.userId,
    reason: row.reason ?? undefined,
    moderatorId: row.moderatorId,
    caseNumber: row.caseNumber,
    duration: row.duration,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export function toBanDto(row: Ban): BanDto {
  return {
    id: row.id,
    guildId: row.guildId,
    userId: row.userId,
    reason: row.reason,
    moderatorId: row.moderatorId,
    caseNumber: row.caseNumber,
    expiresAt: row.expiresAt ?? undefined,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export function toCaseDto(row: Case): CaseDto {
  return {
    id: row.id,
    guildId: row.guildId,
    caseNumber: row.caseNumber,
    type: row.type as ModerationType,
    userId: row.userId,
    moderatorId: row.moderatorId,
    action: row.action,
    reason: row.reason ?? undefined,
    metadata: (row.metadata ?? undefined) as Record<string, unknown> | undefined,
    isAppealed: row.isAppealed,
    appealReason: row.appealReason ?? undefined,
    resolvedAt: row.resolvedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPermissionOverrideDto(row: PermissionOverride): PermissionOverrideDto {
  return {
    id: row.id,
    guildId: row.guildId,
    userId: row.userId,
    permission: row.permission,
    allowed: row.allowed,
  };
}

export function toGuildDto(row: Guild): GuildDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toGuildMemberDto(row: GuildMember): GuildMemberDto {
  return {
    guildId: row.guildId,
    userId: row.userId,
    joinedAt: row.joinedAt,
  };
}

export function toProfileDto(row: Profile): ProfileDto {
  return {
    id: row.id,
    guildId: row.guildId,
    userId: row.userId,
    displayName: row.displayName,
    xp: row.xp,
    level: row.level,
    totalXp: row.totalXp,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toLevelRoleDto(row: LevelRole): LevelRoleDto {
  return {
    id: row.id,
    guildId: row.guildId,
    level: row.level,
    roleId: row.roleId,
  };
}

export function toXpMultiplierDto(row: XpMultiplier): XpMultiplierDto {
  return {
    id: row.id,
    guildId: row.guildId,
    targetId: row.targetId,
    targetType: row.targetType as 'channel' | 'role',
    multiplier: row.multiplier,
  };
}

export function toNoXpTargetDto(row: NoXpTarget): NoXpTargetDto {
  return {
    id: row.id,
    guildId: row.guildId,
    targetId: row.targetId,
    targetType: row.targetType as 'channel' | 'role',
  };
}

export function toGuildSettingsDto(row: GuildSettings): GuildSettingsDto {
  return {
    guildId: row.guildId,
    xpEnabled: row.xpEnabled,
    xpMin: row.xpMin,
    xpMax: row.xpMax,
    xpCooldown: row.xpCooldown,
    levelUpChannelId: row.levelUpChannelId,
    levelUpDm: row.levelUpDm,
    levelUpMessage: row.levelUpMessage,
    locale: row.locale,
  };
}

export function toTwitchSubscriptionDto(row: TwitchSubscription): TwitchSubscriptionDto {
  return {
    id: row.id,
    guildId: row.guildId,
    twitchLogin: row.twitchLogin,
    notifyChannelId: row.notifyChannelId,
    mentionRoleId: row.mentionRoleId,
    customMessage: row.customMessage,
    lastStreamId: row.lastStreamId,
    createdAt: row.createdAt,
  };
}
