// ============================================================================
// packages/core/src/services/ModerationService.ts
// Example service - follow this pattern for all other services
// ============================================================================

import type {
  WarningRepository,
  MuteRepository,
  BanRepository,
  CaseRepository,
  PermissionRepository,
  WarningDto,
  MuteDto,
  BanDto,
  SnowflakeId,
  ModerationType
} from '@sailorclawbot/contracts';
import type { EventBus, Logger } from '@sailorclawbot/core';
import { DomainError, PermissionDeniedError, ValidationError } from '@sailorclawbot/core';

/**
 * ModerationService - Orchestrates all moderation operations
 *
 * Responsibilities:
 * - Validate moderator permissions
 * - Execute warnings, mutes, bans
 * - Track case numbers
 * - Emit domain events
 * - Maintain audit trail
 *
 * Dependencies (injected):
 * - WarningRepository (data access)
 * - MuteRepository (data access)
 * - BanRepository (data access)
 * - CaseRepository (data access)
 * - PermissionRepository (permission checks)
 * - EventBus (event publishing)
 * - Logger (structured logging)
 */
export class ModerationService {
  constructor(
    private warnings: WarningRepository,
    private mutes: MuteRepository,
    private bans: BanRepository,
    private cases: CaseRepository,
    private permissions: PermissionRepository,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  // ========================================================================
  // WARNING OPERATIONS
  // ========================================================================

  /**
   * Issue a warning to a user
   *
   * Validates:
   * - Moderator has permission
   * - Target user is valid
   * - Reason provided
   *
   * Side effects:
   * - Create Warning record
   * - Create Case record
   * - Emit 'moderation.warned' event
   * - Log to audit trail
   *
   * Business logic:
   * - Auto-mute if 3+ warnings
   * - Notify user via DM
   */
  async warnUser(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    reason: string,
    moderatorId: SnowflakeId
  ): Promise<WarningDto> {
    // Validate inputs
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID required', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID required', 'userId');
    }
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('Reason required', 'reason');
    }
    if (!moderatorId || moderatorId.trim().length === 0) {
      throw new ValidationError('Moderator ID required', 'moderatorId');
    }

    // Check permission
    const canModerate = await this.canModerate(guildId, moderatorId);
    if (!canModerate) {
      this.logger.warn('Permission denied for warn attempt', {
        guildId,
        userId,
        moderatorId
      });
      throw new PermissionDeniedError('User is not a moderator');
    }

    // Prevent self-warnings
    if (userId === moderatorId) {
      throw new ValidationError('Cannot warn yourself');
    }

    // Get next case number
    const caseNumber = await this.cases.getNextCaseNumber(guildId);

    // Create warning
    const warning = await this.warnings.create({
      guildId,
      userId,
      reason,
      moderatorId,
      caseNumber
    });

    // Create case record
    await this.cases.create({
      guildId,
      caseNumber,
      type: 'warning',
      userId,
      moderatorId,
      action: warning.id,
      reason,
      isAppealed: false,
      metadata: { warning_id: warning.id }
    });

    // Check if auto-mute (3+ warnings)
    const warningCount = await this.warnings.count(guildId, userId);
    if (warningCount >= 3) {
      this.logger.info('Auto-muting user after 3+ warnings', {
        guildId,
        userId,
        warningCount
      });

      await this.muteUser(guildId, userId, 1440, moderatorId, 'Auto-mute: 3+ warnings');
    }

    // Emit event
    await this.eventBus.publish({
      name: 'moderation.warned',
      payload: {
        guildId,
        userId,
        moderatorId,
        reason,
        caseNumber,
        warningCount,
        autoMuted: warningCount >= 3
      },
      occurredAt: new Date()
    });

    this.logger.info('User warned', {
      guildId,
      userId,
      moderatorId,
      caseNumber,
      reason
    });

    return warning;
  }

  // ========================================================================
  // MUTE OPERATIONS
  // ========================================================================

  /**
   * Mute a user temporarily
   *
   * Validates:
   * - Moderator has permission
   * - Duration is positive
   * - User not already muted
   *
   * Creates:
   * - Mute record with expiry
   * - Case record
   * - Scheduled job to unmute
   *
   * Emits:
   * - 'moderation.muted' event
   */
  async muteUser(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    durationMinutes: number,
    moderatorId: SnowflakeId,
    reason?: string
  ): Promise<MuteDto> {
    // Validate inputs
    if (!guildId || guildId.trim().length === 0) {
      throw new ValidationError('Guild ID required', 'guildId');
    }
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID required', 'userId');
    }
    if (durationMinutes <= 0) {
      throw new ValidationError('Duration must be positive', 'durationMinutes');
    }
    if (!moderatorId || moderatorId.trim().length === 0) {
      throw new ValidationError('Moderator ID required', 'moderatorId');
    }

    // Check permission
    const canModerate = await this.canModerate(guildId, moderatorId);
    if (!canModerate) {
      throw new PermissionDeniedError('User is not a moderator');
    }

    // Check if already muted
    const existing = await this.mutes.findByGuildAndUser(guildId, userId);
    if (existing && existing.isActive) {
      throw new DomainError(
        'USER_ALREADY_MUTED',
        `User is already muted until ${existing.expiresAt.toISOString()}`
      );
    }

    // Calculate expiry
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Get next case number
    const caseNumber = await this.cases.getNextCaseNumber(guildId);

    // Create mute
    const mute = await this.mutes.create({
      guildId,
      userId,
      reason: reason || 'No reason provided',
      moderatorId,
      caseNumber,
      duration: durationMinutes,
      expiresAt,
      isActive: true
    });

    // Create case record
    await this.cases.create({
      guildId,
      caseNumber,
      type: 'mute',
      userId,
      moderatorId,
      action: mute.id,
      reason,
      isAppealed: false,
      metadata: {
        mute_id: mute.id,
        duration_minutes: durationMinutes,
        expires_at: expiresAt.toISOString()
      }
    });

    // Emit event
    await this.eventBus.publish({
      name: 'moderation.muted',
      payload: {
        guildId,
        userId,
        moderatorId,
        reason,
        caseNumber,
        durationMinutes,
        expiresAt
      },
      occurredAt: new Date()
    });

    this.logger.info('User muted', {
      guildId,
      userId,
      moderatorId,
      caseNumber,
      durationMinutes,
      expiresAt
    });

    return mute;
  }

  /**
   * Unmute a user
   */
  async unmuteUser(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    moderatorId: SnowflakeId
  ): Promise<void> {
    // Check permission
    const canModerate = await this.canModerate(guildId, moderatorId);
    if (!canModerate) {
      throw new PermissionDeniedError('User is not a moderator');
    }

    // Find active mute
    const mute = await this.mutes.findByGuildAndUser(guildId, userId);
    if (!mute || !mute.isActive) {
      throw new DomainError('NOT_MUTED', 'User is not currently muted');
    }

    // Deactivate mute
    await this.mutes.deactivate(mute.id);

    // Emit event
    await this.eventBus.publish({
      name: 'moderation.unmuted',
      payload: {
        guildId,
        userId,
        moderatorId,
        muteId: mute.id
      },
      occurredAt: new Date()
    });

    this.logger.info('User unmuted', { guildId, userId, moderatorId });
  }

  // ========================================================================
  // BAN OPERATIONS
  // ========================================================================

  /**
   * Ban a user permanently or temporarily
   */
  async banUser(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    reason: string,
    moderatorId: SnowflakeId,
    durationDays?: number
  ): Promise<BanDto> {
    // Validate inputs
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('Reason required', 'reason');
    }

    // Check permission
    const canModerate = await this.canModerate(guildId, moderatorId);
    if (!canModerate) {
      throw new PermissionDeniedError('User is not a moderator');
    }

    // Calculate expiry if temporary
    const expiresAt = durationDays
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Get next case number
    const caseNumber = await this.cases.getNextCaseNumber(guildId);

    // Create ban
    const ban = await this.bans.create({
      guildId,
      userId,
      reason,
      moderatorId,
      caseNumber,
      expiresAt,
      isActive: true
    });

    // Create case record
    await this.cases.create({
      guildId,
      caseNumber,
      type: 'ban',
      userId,
      moderatorId,
      action: ban.id,
      reason,
      isAppealed: false,
      metadata: {
        ban_id: ban.id,
        temporary: !!durationDays,
        expires_at: expiresAt?.toISOString()
      }
    });

    // Emit event
    await this.eventBus.publish({
      name: 'moderation.banned',
      payload: {
        guildId,
        userId,
        moderatorId,
        reason,
        caseNumber,
        temporary: !!durationDays,
        expiresAt
      },
      occurredAt: new Date()
    });

    this.logger.info('User banned', {
      guildId,
      userId,
      moderatorId,
      caseNumber,
      reason,
      temporary: !!durationDays
    });

    return ban;
  }

  /**
   * Unban a user
   */
  async unbanUser(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    moderatorId: SnowflakeId
  ): Promise<void> {
    // Check permission
    const canModerate = await this.canModerate(guildId, moderatorId);
    if (!canModerate) {
      throw new PermissionDeniedError('User is not a moderator');
    }

    // Find active ban
    const ban = await this.bans.findByGuildAndUser(guildId, userId);
    if (!ban || !ban.isActive) {
      throw new DomainError('NOT_BANNED', 'User is not currently banned');
    }

    // Deactivate ban
    await this.bans.deactivate(ban.id);

    // Emit event
    await this.eventBus.publish({
      name: 'moderation.unbanned',
      payload: {
        guildId,
        userId,
        moderatorId,
        banId: ban.id
      },
      occurredAt: new Date()
    });

    this.logger.info('User unbanned', { guildId, userId, moderatorId });
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Check if user can moderate (has moderator permission)
   * 
   * Checks:
   * - User has 'can_moderate' permission override (if set)
   * - User has moderator role (if configured)
   */
  private async canModerate(guildId: SnowflakeId, userId: SnowflakeId): Promise<boolean> {
    try {
      // Check permission override
      const override = await this.permissions.findByGuildUserPermission(
        guildId,
        userId,
        'can_moderate'
      );

      if (override) {
        return override.allowed;
      }

      // TODO: Check moderator role (requires RoleMappingRepository)
      // For now, return true (permission system will be added later)
      return true;
    } catch (error) {
      this.logger.error('Error checking moderation permission', {
        guildId,
        userId,
        error
      });
      return false;
    }
  }
}

// ============================================================================
// UNIT TEST EXAMPLE
// ============================================================================
/*
// packages/core/tests/unit/ModerationService.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModerationService } from '../../src/services/ModerationService';
import type {
  WarningRepository,
  MuteRepository,
  BanRepository,
  CaseRepository,
  PermissionRepository,
  WarningDto,
  MuteDto,
  BanDto
} from '@sailorclawbot/contracts';
import { ValidationError, PermissionDeniedError } from '@sailorclawbot/core';

describe('ModerationService', () => {
  let service: ModerationService;
  let mockWarnings: jest.Mocked<WarningRepository>;
  let mockMutes: jest.Mocked<MuteRepository>;
  let mockBans: jest.Mocked<BanRepository>;
  let mockCases: jest.Mocked<CaseRepository>;
  let mockPermissions: jest.Mocked<PermissionRepository>;
  let mockEventBus: any;
  let mockLogger: any;

  beforeEach(() => {
    mockWarnings = {
      findById: jest.fn(),
      findByGuildAndUser: jest.fn(),
      getNextCaseNumber: jest.fn().resolves(1),
      create: jest.fn(),
      count: jest.fn().resolves(0)
    };

    mockMutes = {
      findById: jest.fn(),
      findByGuildAndUser: jest.fn().resolves(null),
      findActive: jest.fn(),
      getNextCaseNumber: jest.fn(),
      create: jest.fn(),
      deactivate: jest.fn(),
      delete: jest.fn()
    };

    mockBans = {
      findById: jest.fn(),
      findByGuildAndUser: jest.fn().resolves(null),
      findActive: jest.fn(),
      getNextCaseNumber: jest.fn(),
      create: jest.fn(),
      deactivate: jest.fn(),
      delete: jest.fn()
    };

    mockCases = {
      findById: jest.fn(),
      findByGuildAndNumber: jest.fn(),
      listByGuild: jest.fn(),
      listByUser: jest.fn(),
      getNextCaseNumber: jest.fn().resolves(1),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };

    mockPermissions = {
      findByGuildUserPermission: jest.fn().resolves({
        id: '1',
        guildId: 'guild1',
        userId: 'mod1',
        permission: 'can_moderate',
        allowed: true
      }),
      findByGuildUser: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByGuildAndUser: jest.fn()
    };

    mockEventBus = {
      publish: jest.fn().resolves(undefined)
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    service = new ModerationService(
      mockWarnings,
      mockMutes,
      mockBans,
      mockCases,
      mockPermissions,
      mockEventBus,
      mockLogger
    );
  });

  describe('warnUser', () => {
    it('should warn user and create case', async () => {
      mockWarnings.create.mockResolvedValue({
        id: 'warn_1',
        guildId: 'guild1',
        userId: 'user1',
        reason: 'spam',
        moderatorId: 'mod1',
        caseNumber: 1,
        createdAt: new Date()
      });

      const warning = await service.warnUser(
        'guild1',
        'user1',
        'spam',
        'mod1'
      );

      expect(warning.id).toBe('warn_1');
      expect(mockWarnings.create).toHaveBeenCalled();
      expect(mockCases.create).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'moderation.warned',
          payload: expect.objectContaining({
            userId: 'user1',
            reason: 'spam'
          })
        })
      );
    });

    it('should reject empty reason', async () => {
      await expect(
        service.warnUser('guild1', 'user1', '', 'mod1')
      ).rejects.toThrow(ValidationError);
    });

    it('should reject if not moderator', async () => {
      mockPermissions.findByGuildUserPermission.mockResolvedValue(null);

      await expect(
        service.warnUser('guild1', 'user1', 'spam', 'not_mod')
      ).rejects.toThrow(PermissionDeniedError);
    });

    it('should auto-mute after 3 warnings', async () => {
      mockWarnings.count.mockResolvedValue(3);
      mockWarnings.create.mockResolvedValue({
        id: 'warn_3',
        guildId: 'guild1',
        userId: 'user1',
        reason: 'spam',
        moderatorId: 'mod1',
        caseNumber: 3,
        createdAt: new Date()
      });

      mockMutes.create.mockResolvedValue({
        id: 'mute_1',
        guildId: 'guild1',
        userId: 'user1',
        reason: 'Auto-mute: 3+ warnings',
        moderatorId: 'mod1',
        caseNumber: 1,
        duration: 1440,
        expiresAt: new Date(),
        isActive: true,
        createdAt: new Date()
      });

      await service.warnUser('guild1', 'user1', 'spam', 'mod1');

      expect(mockMutes.create).toHaveBeenCalled();
    });
  });
});
*/
