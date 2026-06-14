export type SnowflakeId = string;

export * from './moderation.js';

export interface GuildSettingsDto {
  guildId: string;
  xpEnabled: boolean;
  xpMin: number;
  xpMax: number;
  xpCooldown: number;
  levelUpChannelId: string | null;
  levelUpDm: boolean;
  levelUpMessage: string | null;
  locale: string;
}

export interface TwitchSubscriptionDto {
  id: string;
  guildId: string;
  twitchLogin: string;
  notifyChannelId: string;
  mentionRoleId: string | null;
  customMessage: string | null;
  lastStreamId: string | null;
  createdAt: Date;
}

export interface GuildDto {
  id: SnowflakeId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuildMemberDto {
  guildId: SnowflakeId;
  userId: SnowflakeId;
  joinedAt: Date;
}

export interface ProfileDto {
  id: string;
  guildId: SnowflakeId;
  userId: SnowflakeId;
  displayName: string | null;
  xp: number;
  level: number;
  totalXp: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LevelRoleDto {
  id: string;
  guildId: string;
  level: number;
  roleId: string;
}

export interface XpMultiplierDto {
  id: string;
  guildId: string;
  targetId: string;
  targetType: 'channel' | 'role';
  multiplier: number;
}

export interface NoXpTargetDto {
  id: string;
  guildId: string;
  targetId: string;
  targetType: 'channel' | 'role';
}

export interface WalletDto {
  id: string;
  guildId: SnowflakeId;
  userId: SnowflakeId;
  balance: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionDto {
  id: string;
  walletId: string;
  amount: bigint;
  reason: string;
  createdAt: Date;
}

export interface FamilyDto {
  id: string;
  guildId: SnowflakeId;
  name: string;
  ownerUserId: SnowflakeId;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketDto {
  id: string;
  guildId: SnowflakeId;
  openedByUserId: SnowflakeId;
  channelId: SnowflakeId | null;
  status: 'open' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}
