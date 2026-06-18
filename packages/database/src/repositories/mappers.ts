import type { Warning, Mute, Ban, Case, PermissionOverride, Guild, GuildMember, Profile, LevelRole, XpMultiplier, NoXpTarget, GuildSettings, TwitchSubscription, Wallet, Item, InventoryItem } from '@prisma/client';
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
  WalletDto,
  ItemDto,
  InventoryItemDto,
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
    currencyName: row.currencyName,
    currencyEmoji: row.currencyEmoji,
    dailyAmount: row.dailyAmount,
    startingBalance: row.startingBalance,
    workMin: row.workMin,
    workMax: row.workMax,
    crimeMin: row.crimeMin,
    crimeMax: row.crimeMax,
    gamblingMinBet: row.gamblingMinBet,
    gamblingMaxBet: row.gamblingMaxBet,
    robMinTargetBalance: row.robMinTargetBalance,
    transferTaxPercent: row.transferTaxPercent,
    shopTaxPercent: row.shopTaxPercent,
    dailyWorkLimit: row.dailyWorkLimit,
    dailyCrimeLimit: row.dailyCrimeLimit,
    workDiminishingFactor: row.workDiminishingFactor,
    crimeDiminishingFactor: row.crimeDiminishingFactor,
  };
}

export function toWalletDto(row: Wallet): WalletDto {
  return {
    id: row.id,
    guildId: row.guildId,
    userId: row.userId,
    balance: row.balance,
    lastDailyAt: row.lastDailyAt,
    lastWorkAt: row.lastWorkAt,
    lastCrimeAt: row.lastCrimeAt,
    lastRobAt: row.lastRobAt,
    workUsesToday: row.workUsesToday,
    crimeUsesToday: row.crimeUsesToday,
    dailyLimitReset: row.dailyLimitReset,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toItemDto(row: Item): ItemDto {
  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    description: row.description,
    price: row.price,
    emoji: row.emoji,
    type: row.type,
    effect: row.effect ?? null,
    stock: row.stock,
    createdAt: row.createdAt,
  };
}

export function toInventoryItemDto(row: InventoryItem & { item?: Item }): InventoryItemDto {
  return {
    id: row.id,
    guildId: row.guildId,
    userId: row.userId,
    itemId: row.itemId,
    quantity: row.quantity,
    acquiredAt: row.acquiredAt,
    item: row.item ? toItemDto(row.item) : undefined,
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
