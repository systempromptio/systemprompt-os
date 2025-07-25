/**
 *  *  * @file User management service with proper role assignment.
 * @module modules/core/auth/services/user-service
 */

import { randomUUID } from 'node:crypto';
import type { DatabaseService } from '@/modules/core/database/services/database.service.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { LogSource } from '@/modules/core/logger/types/index.js';
import { ZERO } from '@/const/numbers.js';

/**
 *  *
 * CreateUserOptions interface.
 *
 */

export interface ICreateUserOptions {
  provider: string;
  providerId: string;
  email: string;
  name?: string;
  avatar?: string;
}

/**
 *  *
 * User interface.
 *
 */

export interface IUser {
  id: string;
  email: string;
  name: string | null;
  avatarurl: string | null;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 *  *
 * DatabaseUser interface.
 *
 */

export interface IDatabaseUser {
  id: string;
  email: string;
  name: string | null;
  avatarurl: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  isactive: number;
}

/**
 *  *
 * DatabaseConnection interface.
 *
 */

export interface IDatabaseConnection {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}

/**
 *  *  * UserService class.
 */
export class UserService {
  private static _instance: UserService;
  private readonly db!: DatabaseService;
  private readonly logger!: ILogger;

  public static getInstance(): UserService {
    UserService._instance ||= new UserService();
    return UserService._instance;
  }

  private constructor() {
    // Initialize lazily
  }

  /**
   *  *    * Check if any admin users exist in the system.
   * This is checked BEFORE any user creation to avoid race conditions.
   */
  async hasAdminUsers(): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_users u
       JOIN auth_user_roles ur ON u.id = ur.userId
       JOIN auth_roles r ON ur.roleId = r.id
       WHERE r.name = 'admin'`,
    );
    return (result[ZERO]?.count ?? ZERO) > ZERO;
  }

  /**
   *  *    * Create or update a user from OAuth login.
   * Handles first-user admin assignment properly.
   * @param options
   * @param _options
   */
  async createOrUpdateUserFromOAuth(_options: ICreateUserOptions): Promise<IUser> {
    const {
 provider, providerId, email, name, avatar
} = _options;

    /**
     * Check if admins exist BEFORE starting the transaction.
     */
    const hasAdmins = await this.hasAdminUsers();
    this.logger.info(LogSource.AUTH, 'Creating/updating user', {
      email,
      hasAdmins,
    });

    /**
     * TODO: Refactor this function to reduce complexity.
     */
    return await this.db.transaction<IUser>(async (conn: IDatabaseConnection) => {
      const identityResult = await conn.query<{ userId: string }>(
        `SELECT userId FROM auth_oauth_identities
         WHERE provider = ? AND provider_userId = ?`,
        [provider, providerId],
      );
      const identity = identityResult.rows[ZERO];

      let userId: string;

      if (identity !== undefined) {
        userId = identity.userId;
        await conn.execute(
          `UPDATE auth_users
           SET name = ?, avatar_url = ?, lastLoginAt = datetime('now'), updatedAt = datetime('now')
           WHERE id = ?`,
          [name ?? null, avatar ?? null, userId],
        );
        this.logger.info(LogSource.AUTH, 'Updated existing user', {
          userId,
          email,
        });
      } else {
        userId = randomUUID();

        await conn.execute(
          `INSERT INTO auth_users (id, email, name, avatar_url, lastLoginAt)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [userId, email, name ?? null, avatar ?? null],
        );

        await conn.execute(
          `INSERT INTO auth_oauth_identities
           (id, userId, provider, provider_userId, providerData)
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

        /**
         * Assign role based on whether admins exist
         * This decision was made BEFORE the transaction started.
         */
        const roleId = hasAdmins ? 'role_user' : 'role_admin';

        await conn.execute(`INSERT INTO auth_user_roles (userId, roleId) VALUES (?, ?)`, [
          userId,
          roleId,
        ]);

        this.logger.info(LogSource.AUTH, 'Created new user with role', {
          userId,
          email,
          role: hasAdmins ? 'user' : 'admin',
        });
      }

      const user = await this.getUserByIdWithConnection(userId, conn);
      if (user === null) {
        throw new Error('User creation/update failed');
      }

      return user;
    });
  }

  /**
   *  *    * Get user by ID with roles using a specific connection.
   * @param userId
   * @param conn
   */
  private async getUserByIdWithConnection(
    userId: string,
    conn: IDatabaseConnection,
  ): Promise<IUser | null> {
    const userResult = await conn.query<IDatabaseUser>('SELECT * FROM auth_users WHERE id = ?', [
      userId,
    ]);

    const userRow = userResult.rows[ZERO];
    if (userRow === undefined) {
      return null;
    }

    const rolesResult = await conn.query<{ name: string }>(
      `SELECT r.name FROM auth_roles r
       JOIN auth_user_roles ur ON r.id = ur.roleId
       WHERE ur.userId = ?`,
      [userId],
    );

    return {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      avatarurl: userRow.avatarurl,
      roles: rolesResult.rows.map((r) => {
        return r.name;
      }),
      createdAt: userRow.createdAt,
      updatedAt: userRow.updatedAt,
    };
  }

  /**
   *  *    * Get user by ID with roles.
   * @param userId
   */
  async getUserById(userId: string): Promise<IUser | null> {
    const userRows = await this.db.query<IDatabaseUser>('SELECT * FROM auth_users WHERE id = ?', [
      userId,
    ]);

    const userRow = userRows[ZERO];
    if (userRow === undefined) {
      return null;
    }

    const roles = await this.db.query<{ name: string }>(
      `SELECT r.name FROM auth_roles r
       JOIN auth_user_roles ur ON r.id = ur.roleId
       WHERE ur.userId = ?`,
      [userId],
    );

    return {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      avatarurl: userRow.avatarurl,
      roles: roles.map((r: { name: string }) => {
        return r.name;
      }),
      createdAt: userRow.createdAt,
      updatedAt: userRow.updatedAt,
    };
  }

  /**
   *  *    * Get user by email.
   * @param email
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    const userRows = await this.db.query<IDatabaseUser>(
      'SELECT * FROM auth_users WHERE email = ?',
      [email],
    );

    const userRow = userRows[ZERO];
    if (userRow === undefined) {
      return null;
    }

    return await this.getUserById(userRow.id);
  }
}
