import type {
  PermissionRepository,
  PermissionOverrideDto,
  SnowflakeId,
} from '@sailorclawbot/contracts';
import { NotFoundError } from '../common/errors/NotFoundError.js';
import { ValidationError } from '../common/errors/ValidationError.js';

/**
 * PermissionService manages explicit per-user permission overrides within a guild.
 *
 * The current model is intentionally simple: every user defaults to no access
 * (deny by default). Overrides can explicitly allow or deny a named permission
 * string. Role-based checks will be layered on top in a later phase.
 */
export class PermissionService {
  public constructor(private readonly permissions: PermissionRepository) {}

  /**
   * Returns true when the user has an explicit allow override for the given
   * permission. Returns false for deny overrides or when no override exists.
   */
  public async hasPermission(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    permission: string
  ): Promise<boolean> {
    this.requireId(guildId, 'guildId');
    this.requireId(userId, 'userId');
    this.requirePermission(permission);

    const override = await this.permissions.findByGuildUserPermission(guildId, userId, permission);
    return override?.allowed === true;
  }

  /**
   * Creates a new override or replaces an existing one for the same
   * (guildId, userId, permission) triple.
   */
  public async setPermission(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    permission: string,
    allowed: boolean
  ): Promise<PermissionOverrideDto> {
    this.requireId(guildId, 'guildId');
    this.requireId(userId, 'userId');
    this.requirePermission(permission);

    const existing = await this.permissions.findByGuildUserPermission(guildId, userId, permission);
    if (existing) {
      return this.permissions.update(existing.id, allowed);
    }
    return this.permissions.create({ guildId, userId, permission, allowed });
  }

  /**
   * Returns all permission overrides for a user within a guild.
   */
  public async listPermissions(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<PermissionOverrideDto[]> {
    this.requireId(guildId, 'guildId');
    this.requireId(userId, 'userId');
    return this.permissions.findByGuildUser(guildId, userId);
  }

  /**
   * Removes the specific override. Throws NotFoundError if it doesn't exist.
   */
  public async revokePermission(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    permission: string
  ): Promise<void> {
    this.requireId(guildId, 'guildId');
    this.requireId(userId, 'userId');
    this.requirePermission(permission);

    const override = await this.permissions.findByGuildUserPermission(guildId, userId, permission);
    if (!override) {
      throw new NotFoundError('PermissionOverride', `${guildId}:${userId}:${permission}`);
    }
    await this.permissions.delete(override.id);
  }

  /**
   * Removes all overrides for a user within a guild.
   * Returns the number of deleted records.
   */
  public async clearPermissions(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<number> {
    this.requireId(guildId, 'guildId');
    this.requireId(userId, 'userId');
    return this.permissions.deleteByGuildAndUser(guildId, userId);
  }

  private requireId(value: string, field: string): void {
    if (!value || value.trim().length === 0) {
      throw new ValidationError(`${field} required`, field);
    }
  }

  private requirePermission(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new ValidationError('permission required', 'permission');
    }
  }
}
