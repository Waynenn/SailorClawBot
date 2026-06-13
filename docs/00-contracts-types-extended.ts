// ============================================================================
// packages/contracts/src/types/extended.ts
// Copy this file directly to packages/contracts/src/types/extended.ts
// ============================================================================

export type SnowflakeId = string;

// ============================================================================
// CORE DTOs (from original)
// ============================================================================

export interface GuildDto {
  id: SnowflakeId;
  name: string;
  icon?: string;
  region?: string;
  locale: string;
  timezone: string;
  prefix: string;
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
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
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
  guildId: SnowflakeId;
  walletId: string;
  amount: bigint;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface FamilyDto {
  id: string;
  guildId: SnowflakeId;
  name: string;
  ownerUserId: SnowflakeId;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketDto {
  id: string;
  guildId: SnowflakeId;
  openedByUserId: SnowflakeId;
  channelId?: SnowflakeId;
  subject: string;
  status: 'open' | 'assigned' | 'closed';
  createdAt: Date;
  closedAt?: Date;
  updatedAt: Date;
}

// ============================================================================
// MODERATION DTOs
// ============================================================================

export interface WarningDto {
  id: string;
  guildId: SnowflakeId;
  userId: SnowflakeId;
  reason: string;
  moderatorId: SnowflakeId;
  caseNumber: number;
  createdAt: Date;
}

export interface MuteDto {
  id: string;
  guildId: SnowflakeId;
  userId: SnowflakeId;
  reason?: string;
  moderatorId: SnowflakeId;
  caseNumber: number;
  duration: number; // minutes
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface BanDto {
  id: string;
  guildId: SnowflakeId;
  userId: SnowflakeId;
  reason: string;
  moderatorId: SnowflakeId;
  caseNumber: number;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export type ModerationType = 'warning' | 'mute' | 'ban' | 'kick';

export interface CaseDto {
  id: string;
  guildId: SnowflakeId;
  caseNumber: number;
  type: ModerationType;
  userId: SnowflakeId;
  moderatorId: SnowflakeId;
  action: string; // Reference to Warning/Mute/Ban ID
  reason?: string;
  metadata?: Record<string, unknown>;
  isAppealed: boolean;
  appealReason?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// ECONOMY DTOs
// ============================================================================

export interface DailyStreakDto {
  id: string;
  guildId: SnowflakeId;
  userId: SnowflakeId;
  currentStreak: number;
  maxStreak: number;
  lastClaimedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleRewardDto {
  id: string;
  guildId: SnowflakeId;
  roleId: SnowflakeId;
  amount: bigint;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// LOGGING DTOs
// ============================================================================

export interface AuditLogDto {
  id: string;
  guildId: SnowflakeId;
  action: string;
  targetId?: SnowflakeId;
  actorId: SnowflakeId;
  changes?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  createdAt: Date;
}

export interface ErrorLogDto {
  id: string;
  service: string;
  error: string;
  message?: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  createdAt: Date;
}

// ============================================================================
// CONFIGURATION DTOs
// ============================================================================

export interface GuildSettingsDto {
  id: string;
  guildId: SnowflakeId;
  prefix: string;
  locale: string;
  timezone: string;
  modLogChannelId?: SnowflakeId;
  ticketCategoryId?: SnowflakeId;
  ticketHandlerRoleId?: SnowflakeId;
  economyEnabled: boolean;
  moderationEnabled: boolean;
  ticketSystemEnabled: boolean;
  levelSystemEnabled: boolean;
  dailyRewardAmount: bigint;
  defaultMuteDuration: number;
  autoModEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleMappingDto {
  id: string;
  guildId: SnowflakeId;
  roleType: string; // "moderator", "muted", "ticket_handler", etc.
  roleId: SnowflakeId;
}

export interface PermissionOverrideDto {
  id: string;
  guildId: SnowflakeId;
  userId: SnowflakeId;
  permission: string;
  allowed: boolean;
}

// ============================================================================
// LEADERBOARD DTO
// ============================================================================

export interface LeaderboardEntryDto {
  rank: number;
  userId: SnowflakeId;
  displayName?: string;
  balance: bigint;
  percentile: number; // 0-100
}

export interface LeaderboardDto {
  guildId: SnowflakeId;
  entries: LeaderboardEntryDto[];
  generatedAt: Date;
}
