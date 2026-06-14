import type {
  PermissionRepository,
  PermissionOverrideDto,
  RoleMappingRepository,
  SnowflakeId,
} from '@sailorclawbot/contracts';
import { NotFoundError } from '../common/errors/NotFoundError.js';
import { ValidationError } from '../common/errors/ValidationError.js';

export class PermissionService {
  public constructor(
    private readonly permissions: PermissionRepository,
    private readonly roleMappings?: RoleMappingRepository
  ) {}

  /**
   * Returns true when user has access to the given permission.
   * Check order: guild owner → RoleMapping (Discord roles) → PermissionOverride
   */
  public async hasPermission(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    permission: string,
    options?: {
      discordRoleIds?: SnowflakeId[];
      isGuildOwner?: boolean;
    }
  ): Promise<boolean> {
    this.requireId(guildId, 'guildId');
    this.requireId(userId, 'userId');
    this.requirePermission(permission);

    if (options?.isGuildOwner) return true;

    if (options?.discordRoleIds && this.roleMappings) {
      const hasRoleMapping = await this.roleMappings.hasPermission(guildId, options.discordRoleIds, permission);
      if (hasRoleMapping) return true;
    }

    const override = await this.permissions.findByGuildUserPermission(guildId, userId, permission);
    return override?.allowed === true;
  }

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

  public async listPermissions(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<PermissionOverrideDto[]> {
    this.requireId(guildId, 'guildId');
    this.requireId(userId, 'userId');
    return this.permissions.findByGuildUser(guildId, userId);
  }

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
