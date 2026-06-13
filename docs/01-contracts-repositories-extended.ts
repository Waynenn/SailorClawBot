// ============================================================================
// packages/contracts/src/repositories/extended.ts
// Copy this file directly to packages/contracts/src/repositories/extended.ts
// ============================================================================

import type {
  WarningDto,
  MuteDto,
  BanDto,
  CaseDto,
  DailyStreakDto,
  RoleRewardDto,
  AuditLogDto,
  ErrorLogDto,
  GuildSettingsDto,
  RoleMappingDto,
  PermissionOverrideDto,
  LeaderboardDto,
  SnowflakeId,
} from '../types/extended.js';

// ============================================================================
// MODERATION REPOSITORIES
// ============================================================================

export interface WarningRepository {
  findById(id: string): Promise<WarningDto | null>;
  findByGuildAndUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<WarningDto[]>;
  getNextCaseNumber(guildId: SnowflakeId): Promise<number>;
  create(input: Omit<WarningDto, 'id' | 'createdAt'>): Promise<WarningDto>;
  count(guildId: SnowflakeId, userId: SnowflakeId): Promise<number>;
}

export interface MuteRepository {
  findById(id: string): Promise<MuteDto | null>;
  findByGuildAndUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<MuteDto | null>;
  findActive(guildId: SnowflakeId): Promise<MuteDto[]>;
  getNextCaseNumber(guildId: SnowflakeId): Promise<number>;
  create(input: Omit<MuteDto, 'id' | 'createdAt'>): Promise<MuteDto>;
  deactivate(id: string): Promise<MuteDto>;
  delete(id: string): Promise<void>;
}

export interface BanRepository {
  findById(id: string): Promise<BanDto | null>;
  findByGuildAndUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<BanDto | null>;
  findActive(guildId: SnowflakeId): Promise<BanDto[]>;
  getNextCaseNumber(guildId: SnowflakeId): Promise<number>;
  create(input: Omit<BanDto, 'id' | 'createdAt'>): Promise<BanDto>;
  deactivate(id: string): Promise<BanDto>;
  delete(id: string): Promise<void>;
}

export interface CaseRepository {
  findById(id: string): Promise<CaseDto | null>;
  findByGuildAndNumber(guildId: SnowflakeId, caseNumber: number): Promise<CaseDto | null>;
  listByGuild(guildId: SnowflakeId, limit?: number, offset?: number): Promise<CaseDto[]>;
  listByUser(guildId: SnowflakeId, userId: SnowflakeId, limit?: number): Promise<CaseDto[]>;
  getNextCaseNumber(guildId: SnowflakeId): Promise<number>;
  create(input: Omit<CaseDto, 'id' | 'createdAt' | 'updatedAt'>): Promise<CaseDto>;
  update(id: string, changes: Partial<CaseDto>): Promise<CaseDto>;
  delete(id: string): Promise<void>;
}

// ============================================================================
// ECONOMY REPOSITORIES
// ============================================================================

export interface DailyStreakRepository {
  findByGuildAndUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<DailyStreakDto | null>;
  create(input: Omit<DailyStreakDto, 'id' | 'createdAt' | 'updatedAt'>): Promise<DailyStreakDto>;
  update(id: string, changes: Partial<DailyStreakDto>): Promise<DailyStreakDto>;
  reset(id: string): Promise<DailyStreakDto>;
}

export interface RoleRewardRepository {
  findByGuildAndRole(guildId: SnowflakeId, roleId: SnowflakeId): Promise<RoleRewardDto | null>;
  listByGuild(guildId: SnowflakeId): Promise<RoleRewardDto[]>;
  create(input: Omit<RoleRewardDto, 'id' | 'createdAt' | 'updatedAt'>): Promise<RoleRewardDto>;
  update(id: string, amount: bigint): Promise<RoleRewardDto>;
  delete(id: string): Promise<void>;
}

export interface LeaderboardRepository {
  /**
   * Get top N users by balance in a guild
   * Efficient for cached leaderboards
   */
  getTopByGuild(
    guildId: SnowflakeId,
    limit: number,
    offset?: number
  ): Promise<LeaderboardDto>;

  /**
   * Get rank and percentile for a user
   */
  getUserRank(guildId: SnowflakeId, userId: SnowflakeId): Promise<{
    rank: number;
    percentile: number;
  } | null>;

  /**
   * Get users around a specific rank
   */
  getAroundRank(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    contextSize: number
  ): Promise<LeaderboardDto>;
}

// ============================================================================
// TICKET REPOSITORIES
// ============================================================================

export interface TicketAssignmentRepository {
  findById(id: string): Promise<{ id: string; ticketId: string; assignedToId: SnowflakeId; assignedAt: Date } | null>;
  findByTicket(ticketId: string): Promise<{ id: string; ticketId: string; assignedToId: SnowflakeId; assignedAt: Date }[]>;
  create(ticketId: string, assignedToId: SnowflakeId): Promise<{ id: string; ticketId: string; assignedToId: SnowflakeId; assignedAt: Date }>;
  unassign(id: string): Promise<void>;
}

// ============================================================================
// LOGGING REPOSITORIES
// ============================================================================

export interface AuditLogRepository {
  create(input: Omit<AuditLogDto, 'id' | 'createdAt'>): Promise<AuditLogDto>;
  listByGuild(guildId: SnowflakeId, limit?: number, offset?: number): Promise<AuditLogDto[]>;
  listByActor(actorId: SnowflakeId, limit?: number): Promise<AuditLogDto[]>;
  listByAction(guildId: SnowflakeId, action: string, limit?: number): Promise<AuditLogDto[]>;
  deleteOlderThan(days: number): Promise<number>; // Returns deleted count
}

export interface ErrorLogRepository {
  create(input: Omit<ErrorLogDto, 'id' | 'createdAt'>): Promise<ErrorLogDto>;
  listRecent(limit?: number): Promise<ErrorLogDto[]>;
  listByService(service: string, limit?: number): Promise<ErrorLogDto[]>;
  markResolved(id: string): Promise<ErrorLogDto>;
  deleteOlderThan(days: number): Promise<number>;
}

// ============================================================================
// CONFIGURATION REPOSITORIES
// ============================================================================

export interface GuildSettingsRepository {
  findByGuild(guildId: SnowflakeId): Promise<GuildSettingsDto | null>;
  create(input: Omit<GuildSettingsDto, 'id' | 'createdAt' | 'updatedAt'>): Promise<GuildSettingsDto>;
  update(guildId: SnowflakeId, changes: Partial<GuildSettingsDto>): Promise<GuildSettingsDto>;
  upsert(guildId: SnowflakeId, input: Omit<GuildSettingsDto, 'id' | 'createdAt' | 'updatedAt'>): Promise<GuildSettingsDto>;
}

export interface RoleMappingRepository {
  findByGuildAndType(guildId: SnowflakeId, roleType: string): Promise<RoleMappingDto | null>;
  listByGuild(guildId: SnowflakeId): Promise<RoleMappingDto[]>;
  create(input: Omit<RoleMappingDto, 'id'>): Promise<RoleMappingDto>;
  update(id: string, roleId: SnowflakeId): Promise<RoleMappingDto>;
  delete(id: string): Promise<void>;
}

export interface PermissionRepository {
  findByGuildUserPermission(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    permission: string
  ): Promise<PermissionOverrideDto | null>;

  findByGuildUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<PermissionOverrideDto[]>;

  create(input: Omit<PermissionOverrideDto, 'id'>): Promise<PermissionOverrideDto>;

  update(id: string, allowed: boolean): Promise<PermissionOverrideDto>;

  delete(id: string): Promise<void>;

  deleteByGuildAndUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<number>;
}
