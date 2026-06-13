export type SnowflakeId = string;

export * from './moderation.js';

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
  createdAt: Date;
  updatedAt: Date;
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
