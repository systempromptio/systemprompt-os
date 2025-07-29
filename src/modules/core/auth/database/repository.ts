import { randomUUID } from 'node:crypto';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { getAuthModule } from '@/modules/core/auth/utils/module-helpers';
import type { UserService } from '@/modules/core/auth/services/user.service';
import type {
 IPermission, IRole, IUser
} from '@/modules/core/auth/types';
import type {
 IAuthPermissionsRow,
 IAuthRolesRow
} from '@/modules/core/auth/types/database.generated';
import type { IUsersRow } from '@/modules/core/users/types/database.generated';
import type {
 OAuthProfile,
 SessionMetadata
} from '@/modules/core/auth/types/repository.types';
import {
 ZERO
} from '@/constants/numbers';

/**
 * Repository for authentication-related database operations.
 * Provides methods for user management, role/permission verification,
 * and session handling in the authentication system.
 */
export class AuthRepository {
  private static instance: AuthRepository | undefined;
  private readonly userService: UserService;

  /**
   * Creates a new AuthRepository instance.
   * @param db - Database service instance for executing queries.
   */
  private constructor(private readonly db: DatabaseService) {
    const authModule = getAuthModule();
    this.userService = authModule.exports.userService();
  }

  /**
   * Gets the singleton instance of AuthRepository.
   * @returns AuthRepository instance.
   */
  static getInstance(): AuthRepository {
    this.instance ??= new AuthRepository(DatabaseService.getInstance());
    return this.instance;
  }

  /**
   * Creates or updates a user from OAuth authentication.
   * Delegates to any which properly handles first-user detection.
   * Outside of the transaction to avoid race conditions.
   * @param provider - OAuth provider identifier (e.g., 'google', 'github').
   * @param providerId - IUser's unique ID from the OAuth provider.
   * @param profile - IUser profile data from OAuth provider.
   * @returns Complete user object with roles and permissions.
   * @throws {Error} If user creation or retrieval fails.
   */
  async upsertIUserFromOAuth(
    provider: string,
    providerId: string,
    profile: OAuthProfile,
  ): Promise<IUser> {
    const user = await this.userService.createOrUpdateUserFromOauth({
      provider,
      providerId,
      email: profile.email,
      ...profile.name !== undefined && { name: profile.name },
      ...profile.avatar !== undefined && { avatar: profile.avatar },
    });

    const roles = await this.getIUserIRoles(user.id);
    const permissions = await this.getIUserIPermissions(user.id);

    return {
      id: user.id,
      email: user.email,
      ...user.name !== null && { name: user.name },
      ...user.avatarurl !== null && { avatarUrl: user.avatarurl },
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
   * @param userId - IUser's unique identifier.
   * @returns IUser object with roles and permissions, or null if not found.
   */
  async getIUserById(userId: string): Promise<IUser | null> {
    const userRow = await this.db
      .query<IUsersRow>('SELECT * FROM users WHERE id = ?', [userId])
      .then((rows: IUsersRow[]): IUsersRow | undefined => { return rows[ZERO] });

    if (userRow === undefined) {
      return null;
    }

    const roles = await this.getIUserIRoles(userId);
    const permissions = await this.getIUserIPermissions(userId);

    return {
      id: userRow.id,
      email: userRow.email,
      ...userRow.display_name !== null && { name: userRow.display_name },
      ...userRow.avatar_url !== null && { avatarUrl: userRow.avatar_url },
      isActive: userRow.status === 'active',
      createdAt: userRow.created_at ?? new Date().toISOString(),
      updatedAt: userRow.updated_at ?? new Date().toISOString(),
      roles,
      permissions,
    };
  }

  /**
   * Retrieves a user by their email address.
   * @param email - IUser's email address.
   * @returns IUser object with roles and permissions, or null if not found.
   */
  async getIUserByEmail(email: string): Promise<IUser | null> {
    const userRow = await this.db
      .query<Pick<IUsersRow, 'id'>>('SELECT id FROM users WHERE email = ?', [email])
      .then((rows: Pick<IUsersRow, 'id'>[]): Pick<IUsersRow, 'id'> | undefined => {
        return rows[ZERO];
      });

    if (userRow === undefined) {
      return null;
    }

    return await this.getIUserById(userRow.id);
  }

  /**
   * Retrieves all roles assigned to a user.
   * @param userId - IUser's unique identifier.
   * @returns Array of role objects assigned to the user.
   */
  async getIUserIRoles(userId: string): Promise<IRole[]> {
    const rows = await this.db.query<IAuthRolesRow>(
      `SELECT r.* FROM auth_roles r
       JOIN auth_user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId],
    );

    return rows.map((row: IAuthRolesRow): IRole => { return {
      id: row.id,
      name: row.name,
      ...row.description !== null && { description: row.description },
      isSystem: Boolean(row.is_system),
    } });
  }

  /**
   * Retrieves all permissions granted to a user through their roles.
   * IPermissions are deduplicated using DISTINCT to handle cases where
   * multiple roles grant the same permission.
   * @param userId - IUser's unique identifier.
   * @returns Array of unique permission objects granted to the user.
   */
  async getIUserIPermissions(userId: string): Promise<IPermission[]> {
    const rows = await this.db.query<IAuthPermissionsRow>(
      `SELECT DISTINCT p.* FROM auth_permissions p
       JOIN auth_role_permissions rp ON p.id = rp.permission_id
       JOIN auth_user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId],
    );

    return rows.map((row: IAuthPermissionsRow): IPermission => { return {
      id: row.id,
      name: row.name,
      resource: row.resource,
      action: row.action,
      ...row.description !== null && { description: row.description },
    } });
  }

  /**
   * Checks if a user has a specific permission.
   * Verifies permission through the user's assigned roles.
   * @param userId - IUser's unique identifier.
   * @param resource - Resource the permission applies to.
   * @param action - Action the permission allows.
   * @returns True if user has the permission, false otherwise.
   */
  async hasIPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_permissions p
       JOIN auth_role_permissions rp ON p.id = rp.permission_id
       JOIN auth_user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = ? AND p.resource = ? AND p.action = ?`,
      [userId, resource, action],
    );

    return (result[ZERO]?.count ?? ZERO) > ZERO;
  }

  /**
   * Checks if a user has a specific role.
   * @param userId - IUser's unique identifier.
   * @param roleName - Name of the role to check.
   * @returns True if user has the role, false otherwise.
   */
  async hasIRole(userId: string, roleName: string): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_user_roles ur
       JOIN auth_roles r ON ur.role_id = r.id
       WHERE ur.user_id = ? AND r.name = ?`,
      [userId, roleName],
    );

    return (result[ZERO]?.count ?? ZERO) > ZERO;
  }

  /**
   * Creates a new authentication session.
   * Sessions store hashed tokens to validate subsequent requests.
   * @param sessionData - Session data object.
   * @param sessionData.userId - User's unique identifier.
   * @param sessionData.tokenHash - Hashed authentication token.
   * @param sessionData.expiresAt - Session expiration timestamp.
   * @param sessionData.metadata - Optional client metadata for the session.
   * @returns Generated session ID.
   */
  async createSession(
    sessionData: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      metadata?: SessionMetadata;
    }
  ): Promise<string> {
    const sessionId = randomUUID();

    await this.db.execute(
      `INSERT INTO auth_sessions
       (id, user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        sessionData.userId,
        sessionData.tokenHash,
        sessionData.expiresAt.toISOString(),
        sessionData.metadata?.ipAddress,
        sessionData.metadata?.userAgent,
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
