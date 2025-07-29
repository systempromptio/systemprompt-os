/**
 * User repository for user data access operations.
 * @module modules/core/auth/repositories/user.repository
 */

import { randomUUID } from 'node:crypto';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type {
  ICreateUserOptions,
  IDatabaseConnection,
  IUserWithRoles,
} from '@/modules/core/auth/types/user-service.types';
import type { IUsersRow } from '@/modules/core/users/types/database.generated';
import { ZERO } from '@/constants/numbers';

/**
 * UserRepository class for handling user data operations.
 */
export class UserRepository {
  private static instance: UserRepository;

  /**
   * Private constructor for singleton pattern.
   * @param db - Database service instance.
   */
  private constructor(private readonly db: DatabaseService) {}

  /**
   * Get singleton instance.
   * @returns UserRepository instance.
   */
  public static getInstance(): UserRepository {
    UserRepository.instance ||= new UserRepository(DatabaseService.getInstance());
    return UserRepository.instance;
  }

  /**
   * Check if any admin users exist in the system.
   * @returns Promise resolving to boolean indicating admin presence.
   */
  async hasAdminUsers(): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM users u
       JOIN auth_user_roles ur ON u.id = ur.user_id
       JOIN auth_roles r ON ur.role_id = r.id
       WHERE r.name = 'admin'`,
    );
    return (result[ZERO]?.count ?? ZERO) > ZERO;
  }

  /**
   * Create a new user with OAuth identity.
   * @param options - User creation options.
   * @param hasAdmins - Whether admin users already exist.
   * @param connection - Database connection for transaction.
   * @returns Promise resolving to the created user ID.
   */
  async createUserWithOAuthIdentity(
    options: ICreateUserOptions,
    hasAdmins: boolean,
    connection: IDatabaseConnection,
  ): Promise<string> {
    const {
 provider, providerId, email, name, avatar
} = options;
    const userId = randomUUID();

    await connection.execute(
      `INSERT INTO users (id, email, display_name, avatar_url)
       VALUES (?, ?, ?, ?)`,
      [userId, email, name ?? null, avatar ?? null],
    );

    await connection.execute(
      `INSERT INTO auth_oauth_identities
       (id, user_id, provider, provider_user_id, provider_data)
       VALUES (?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        provider,
        providerId,
        JSON.stringify({
          email,
          name,
          avatar,
        }),
      ],
    );

    const roleId = hasAdmins ? 'role_user' : 'role_admin';
    await connection.execute(
      `INSERT INTO auth_user_roles (user_id, role_id) VALUES (?, ?)`,
      [userId, roleId],
    );

    return userId;
  }

  /**
   * Update existing user information.
   * @param userId - User ID to update.
   * @param name - User name.
   * @param avatar - User avatar URL.
   * @param connection - Database connection for transaction.
   * @returns Promise that resolves when update is complete.
   */
  async updateUser(
    userId: string,
    name: string | undefined,
    avatar: string | undefined,
    connection: IDatabaseConnection,
  ): Promise<void> {
    await connection.execute(
      `UPDATE users
       SET display_name = ?, avatar_url = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [name ?? null, avatar ?? null, userId],
    );
  }

  /**
   * Find OAuth identity by provider and provider ID.
   * @param provider - OAuth provider name.
   * @param providerId - Provider user ID.
   * @param connection - Database connection for transaction.
   * @returns Promise resolving to user ID if found.
   */
  async findOAuthIdentity(
    provider: string,
    providerId: string,
    connection: IDatabaseConnection,
  ): Promise<string | null> {
    const identityResult = await connection.query<{ user_id: string }>(
      `SELECT user_id FROM auth_oauth_identities
       WHERE provider = ? AND provider_user_id = ?`,
      [provider, providerId],
    );
    const identity = identityResult.rows[ZERO];
    return identity?.user_id ?? null;
  }

  /**
   * Get user by ID with roles using connection.
   * @param userId - User ID to retrieve.
   * @param connection - Database connection for transaction.
   * @returns Promise resolving to user with roles or null.
   */
  async getUserByIdWithConnection(
    userId: string,
    connection: IDatabaseConnection,
  ): Promise<IUserWithRoles | null> {
    const userResult = await connection.query<IUsersRow>(
      'SELECT * FROM users WHERE id = ?',
      [userId],
    );

    const userRow = userResult.rows[ZERO];
    if (userRow === undefined) {
      return null;
    }

    const rolesResult = await connection.query<{ name: string }>(
      `SELECT r.name FROM auth_roles r
       JOIN auth_user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId],
    );

    return {
      id: userRow.id,
      email: userRow.email,
      name: userRow.display_name,
      avatarurl: userRow.avatar_url,
      roles: rolesResult.rows.map((role): string => { return role.name }),
      createdAt: userRow.created_at ?? new Date().toISOString(),
      updatedAt: userRow.updated_at ?? new Date().toISOString(),
    };
  }

  /**
   * Get user by ID with roles.
   * @param userId - User ID to retrieve.
   * @returns Promise resolving to user with roles or null.
   */
  async getUserById(userId: string): Promise<IUserWithRoles | null> {
    const userRows = await this.db.query<IUsersRow>(
      'SELECT * FROM users WHERE id = ?',
      [userId],
    );

    const userRow = userRows[ZERO];
    if (userRow === undefined) {
      return null;
    }

    const roles = await this.db.query<{ name: string }>(
      `SELECT r.name FROM auth_roles r
       JOIN auth_user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId],
    );

    return {
      id: userRow.id,
      email: userRow.email,
      name: userRow.display_name,
      avatarurl: userRow.avatar_url,
      roles: roles.map((role): string => { return role.name }),
      createdAt: userRow.created_at ?? new Date().toISOString(),
      updatedAt: userRow.updated_at ?? new Date().toISOString(),
    };
  }

  /**
   * Get user by email.
   * @param email - User email to search for.
   * @returns Promise resolving to user with roles or null.
   */
  async getUserByEmail(email: string): Promise<IUserWithRoles | null> {
    const userRows = await this.db.query<IUsersRow>(
      'SELECT * FROM users WHERE email = ?',
      [email],
    );

    const userRow = userRows[ZERO];
    if (userRow === undefined) {
      return null;
    }

    return await this.getUserById(userRow.id);
  }

  /**
   * Perform a database transaction.
   * @param callback - Transaction callback function.
   * @returns Promise resolving to transaction result.
   */
  async performTransaction<T>(
    callback: (connection: IDatabaseConnection) => Promise<T>,
  ): Promise<T> {
    return await this.db.transaction<T>(callback);
  }
}
