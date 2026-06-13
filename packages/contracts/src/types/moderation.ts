import type { SnowflakeId } from './index.js';

export type ModerationType = 'warning' | 'mute' | 'ban' | 'kick';

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
  /** Duration in minutes. */
  duration: number;
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
  /** Absent for permanent bans. */
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface CaseDto {
  id: string;
  guildId: SnowflakeId;
  caseNumber: number;
  type: ModerationType;
  userId: SnowflakeId;
  moderatorId: SnowflakeId;
  /** Reference to the underlying Warning/Mute/Ban id. */
  action: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  isAppealed: boolean;
  appealReason?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionOverrideDto {
  id: string;
  guildId: SnowflakeId;
  userId: SnowflakeId;
  permission: string;
  allowed: boolean;
}
