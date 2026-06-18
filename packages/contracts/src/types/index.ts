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
  // Economy
  currencyName: string;
  currencyEmoji: string;
  dailyAmount: bigint;
  startingBalance: bigint;
  workMin: bigint;
  workMax: bigint;
  crimeMin: bigint;
  crimeMax: bigint;
  gamblingMinBet: bigint;
  gamblingMaxBet: bigint;
  robMinTargetBalance: bigint;
  transferTaxPercent: number;
  shopTaxPercent: number;
  dailyWorkLimit: number;
  dailyCrimeLimit: number;
  workDiminishingFactor: number;
  crimeDiminishingFactor: number;
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
  lastDailyAt: Date | null;
  lastWorkAt: Date | null;
  lastCrimeAt: Date | null;
  lastRobAt: Date | null;
  workUsesToday: number;
  crimeUsesToday: number;
  dailyLimitReset: Date | null;
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

export interface ItemDto {
  id: string;
  guildId: string;
  name: string;
  description: string | null;
  price: bigint;
  emoji: string | null;
  type: string;
  effect: unknown | null;
  stock: number | null;
  createdAt: Date;
}

export interface CreateItemDto {
  guildId: string;
  name: string;
  description?: string | null;
  price: bigint;
  emoji?: string | null;
  type: string;
  effect?: unknown | null;
  stock?: number | null;
}

export interface InventoryItemDto {
  id: string;
  guildId: string;
  userId: string;
  itemId: string;
  quantity: number;
  acquiredAt: Date;
  item?: ItemDto;
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
