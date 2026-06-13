import type { Warning, Mute, Ban, Case, PermissionOverride } from '@prisma/client';
import type {
  WarningDto,
  MuteDto,
  BanDto,
  CaseDto,
  ModerationType,
  PermissionOverrideDto,
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
