import { randomUUID } from 'node:crypto';
import { DatabaseService } from '@/modules/core/database/index.js';
import { getAuthModule } from '@/modules/core/auth/singleton.js';
import type { UserService } from '@/modules/core/auth/services/user-service.js';
import type {
 Permission, Role, User
} from '@/modules/core/auth/database/models/index.js';
import type {
  PermissionRow, RoleRow, UserRow
} from '@/modules/core/auth/types/index.js';
import {
 EIGHTY, FIFTY, FIVE, FORTY, FOUR, ONE, ONE_HUNDRED, SIXTY, TEN, THIRTY, THREE, TWENTY, TWO, ZERO
} from '@/modules/core/auth/constants';

/**
 *
 * ISessionMetadata interface.
 *
 */

export interface IISessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

/**
 *
 * IOAuthProfile interface.
 *
 */

export interface IIOAuthProfile {
  email: string;
  name?: string;
  avatar?: string;
}

/**
 *
 * AuthRepository class.
 *
 */

export class AuthRepository {
  private static instance: AuthRepository;
  private readonly userService: UserService;

  /**
   *  * Creates a new AuthRepository instance.
   * @param db - Database service instance for executing queries.
   */
  private constructor(private readonly db: DatabaseService) {
    const authModule = getAuthModule();
    this.userService = authModule.exports.userService();
  }

  /**
   *  * Gets the singleton instance of AuthRepository.
   * @returns AuthRepository instance.
   */
  static getInstance(): AuthRepository {
    this.instance ||= new AuthRepository(DatabaseService.getInstance());
    return this.instance;
  }

  /**
   *  * Creates or updates a user from OAuth authentication.
   * Delegates to UserService which properly handles first-user detection.
   * Outside of the transaction to avoid race conditions.
   * @param provider - OAuth provider identifier (e.g., 'google', 'github').
   * @param providerId - User's unique ID from the OAuth provider.
   * @param profile - User profile data from OAuth provider.
   * @returns Complete user object with roles and permissions.
   * @throws {Error} If user creation or retrieval fails.
   */
  async upsertUserFromOAuth(
    provider: string,
    providerId: string,
    profile: IOAuthProfile,
  ): Promise<User> {
    const user = await this.userService.createOrUpdateUserFromOAuth({
      provider,
      providerId,
      email: profile.email,
      ...profile.name !== undefined && { name: profile.name },
      ...profile.avatar !== undefined && { avatar: profile.avatar },
    });

    const roles = await this.getUserRoles(user.id);
    const permissions = await this.getUserPermissions(user.id);

    return {
      id: user.id,
      email: user.email,
      ...user.name && { name: user.name },
      ...user.avatar_url && { avatarUrl: user.avatar_url },
      isActive: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: new Date().toISOString(),
      roles,
      permissions,
    };
  }

  /**
   * Retrieves a user by their unique identifier.
   * Fetches the user record along with their associated roles and permissions.
   * @param userId - User's unique identifier.
   * @returns User object with roles and permissions, or null if not found.
   */
  async getUserById(userId: string): Promise<User | null> {
    const userRow = await this.db
      .query<UserRow>('SELECT * FROM auth_users WHERE id = ?', [userId])
      .then((rows: UserRow[]) => { return rows[ZERO] });

    if (!userRow) {
      return null;
    }

    const roles = await this.getUserRoles(userId);
    const permissions = await this.getUserPermissions(userId);

    return {
      id: userRow.id,
      email: userRow.email,
      ...userRow.name && { name: userRow.name },
      ...userRow.avatar_url && { avatarUrl: userRow.avatar_url },
      isActive: Boolean(userRow.isActive),
      createdAt: userRow.createdAt,
      updatedAt: userRow.updatedAt,
      ...userRow.lastLoginAt && { lastLoginAt: userRow.lastLoginAt },
      roles,
      permissions,
    };
  }

  /**
   * Retrieves a user by their email address.
   * @param email - User's email address.
   * @returns User object with roles and permissions, or null if not found.
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const userRow = await this.db
      .query<Pick<UserRow, 'id'>>('SELECT id FROM auth_users WHERE email = ?', [email])
      .then((rows: Pick<UserRow, 'id'>[]) => { return rows[ZERO] });

    if (!userRow) {
      return null;
    }

    return await this.getUserById(userRow.id);
  }

  /**
   * Retrieves all roles assigned to a user.
   * @param userId - User's unique identifier.
   * @returns Array of role objects assigned to the user.
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const rows = await this.db.query<RoleRow>(
      `SELECT r.* FROM auth_roles r
       JOIN auth_user_roles ur ON r.id = ur.roleId
       WHERE ur.userId = ?`,
      [userId],
    );

    return rows.map((row: RoleRow) => { return {
      id: row.id,
      name: row.name,
      ...row.description && { description: row.description },
      isSystem: Boolean(row.isSystem),
    } });
  }

  /**
   * Retrieves all permissions granted to a user through their roles.
   * Permissions are deduplicated using DISTINCT to handle cases where
   * multiple roles grant the same permission.
   * @param userId - User's unique identifier.
   * @returns Array of unique permission objects granted to the user.
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const rows = await this.db.query<PermissionRow>(
      `SELECT DISTINCT p.* FROM auth_permissions p
       JOIN auth_role_permissions rp ON p.id = rp.permission_id
       JOIN auth_user_roles ur ON rp.roleId = ur.roleId
       WHERE ur.userId = ?`,
      [userId],
    );

    return rows.map((row: PermissionRow) => { return {
      id: row.id,
      name: row.name,
      resource: row.resource,
      action: row.action,
      ...row.description && { description: row.description },
    } });
  }

  /**
   * Checks if a user has a specific permission.
   * Verifies permission through the user's assigned roles.
   * @param userId - User's unique identifier.
   * @param resource - Resource the permission applies to.
   * @param action - Action the permission allows.
   * @returns True if user has the permission, false otherwise.
   */
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_permissions p
       JOIN auth_role_permissions rp ON p.id = rp.permission_id
       JOIN auth_user_roles ur ON rp.roleId = ur.roleId
       WHERE ur.userId = ? AND p.resource = ? AND p.action = ?`,
      [userId, resource, action],
    );

    return (result[ZERO]?.count ?? ZERO) > ZERO;
  }

  /**
   * Checks if a user has a specific role.
   * @param userId - User's unique identifier.
   * @param roleName - Name of the role to check.
   * @returns True if user has the role, false otherwise.
   */
  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_user_roles ur
       JOIN auth_roles r ON ur.roleId = r.id
       WHERE ur.userId = ? AND r.name = ?`,
      [userId, roleName],
    );

    return (result[ZERO]?.count ?? ZERO) > ZERO;
  }

  /**
   * Creates a new authentication session.
   * Sessions store hashed tokens to validate subsequent requests.
   * @param userId - User's unique identifier.
   * @param tokenHash - Hashed authentication token.
   * @param expiresAt - Session expiration timestamp.
   * @param metadata - Optional client metadata for the session.
   * @returns Generated session ID.
   */
  async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: ISessionMetadata,
  ): Promise<string> {
    const sessionId = randomUUID();

    await this.db.execute(
      `INSERT INTO auth_sessions
       (id, userId, token_hash, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        userId,
        tokenHash,
        expiresAt.toISOString(),
        metadata?.ipAddress,
        metadata?.userAgent,
      ],
    );

    return sessionId;
  }

  /**
   * Removes expired authentication sessions.
   * Should be called periodically to maintain database hygiene.
   * @returns Number of sessions removed (always ZERO for SQLite due to API limitations).
   */
  async cleanupExpiredSessions(): Promise<number> {
    await this.db.execute(`DELETE FROM auth_sessions WHERE expires_at < datetime('now')`);

    return ZERO;
  }
}
