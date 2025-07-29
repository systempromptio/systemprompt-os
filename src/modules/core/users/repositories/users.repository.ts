/**
 * Users repository implementation - database operations.
 * Handles user data persistence without authentication concerns.
 */

import {
  type IUser,
  type IUserUpdateData
} from '@/modules/core/users/types/index';
import { UsersStatus } from '@/modules/core/users/types/database.generated';
import {
  type IUsersRow
} from '@/modules/core/users/types/database.generated';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';

/**
 * Repository for users data operations.
 */
export class UsersRepository {
  private static instance: UsersRepository;
  private database?: IDatabaseConnection;

  /**
   * Private constructor for singleton.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns The repository instance.
   */
  static getInstance(): UsersRepository {
    UsersRepository.instance ||= new UsersRepository();
    return UsersRepository.instance;
  }

  /**
   * Initialize repository.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    const dbService = DatabaseService.getInstance();
    this.database = await dbService.getConnection();
  }

  /**
   * Create a new user.
   * @param user - User data.
   * @returns The created user.
   */
  async createUser(user: IUser): Promise<IUser> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare(
      `INSERT INTO users (
        id, username, email, display_name, avatar_url, bio,
        timezone, language, status, email_verified,
        preferences, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    await stmt.run([
      user.id,
      user.username,
      user.email,
      user.displayName || null,
      user.avatarUrl || null,
      user.bio || null,
      user.timezone,
      user.language,
      user.status,
      user.emailVerified ? 1 : 0,
      user.preferences ? JSON.stringify(user.preferences) : null,
      user.metadata ? JSON.stringify(user.metadata) : null,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    ]);

    await stmt.finalize();
    return user;
  }

  /**
   * Find user by ID.
   * @param id - User ID.
   * @returns User or null.
   */
  async findById(id: string): Promise<IUser | null> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const result = await this.database.query<IUsersRow>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    const row = result[0];
    return row ? this.mapRowToUser(row) : null;
  }

  /**
   * Find user by username.
   * @param username - Username.
   * @returns User or null.
   */
  async findByUsername(username: string): Promise<IUser | null> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const result = await this.database.query<IUsersRow>(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    const row = result[0];
    return row ? this.mapRowToUser(row) : null;
  }

  /**
   * Find user by email.
   * @param email - Email address.
   * @returns User or null.
   */
  async findByEmail(email: string): Promise<IUser | null> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const result = await this.database.query<IUsersRow>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const row = result[0];
    return row ? this.mapRowToUser(row) : null;
  }

  /**
   * Find all users.
   * @returns Array of users.
   */
  async findAll(): Promise<IUser[]> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const result = await this.database.query<IUsersRow>(
      'SELECT * FROM users ORDER BY created_at DESC'
    );

    return result.map((row: IUsersRow) => { return this.mapRowToUser(row) });
  }

  /**
   * Update user.
   * @param id - User ID.
   * @param data - Update data.
   * @returns Updated user.
   */
  async updateUser(id: string, data: IUserUpdateData): Promise<IUser> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.username !== undefined) {
      updates.push('username = ?');
      values.push(data.username);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email);
    }
    if (data.displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(data.displayName);
    }
    if (data.avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      values.push(data.avatarUrl);
    }
    if (data.bio !== undefined) {
      updates.push('bio = ?');
      values.push(data.bio);
    }
    if (data.timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(data.timezone);
    }
    if (data.language !== undefined) {
      updates.push('language = ?');
      values.push(data.language);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.emailVerified !== undefined) {
      updates.push('email_verified = ?');
      values.push(data.emailVerified ? 1 : 0);
    }
    if (data.preferences !== undefined) {
      updates.push('preferences = ?');
      values.push(JSON.stringify(data.preferences));
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    const stmt = await this.database.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    );
    await stmt.run(values);
    await stmt.finalize();

    const user = await this.findById(id);
    if (!user) {
      throw new Error(`User not found after update: ${id}`);
    }

    return user;
  }

  /**
   * Delete user.
   * @param id - User ID.
   */
  async deleteUser(id: string): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare(
      'DELETE FROM users WHERE id = ?'
    );
    await stmt.run([id]);
    await stmt.finalize();
  }

  /**
   * Search users by query.
   * @param query - Search query.
   * @returns Array of matching users.
   */
  async searchUsers(query: string): Promise<IUser[]> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const searchPattern = `%${query}%`;
    const result = await this.database.query<IUsersRow>(
      `SELECT * FROM users 
       WHERE username LIKE ? OR email LIKE ? OR display_name LIKE ?
       ORDER BY created_at DESC`,
      [searchPattern, searchPattern, searchPattern]
    );

    return result.map((row: IUsersRow) => { return this.mapRowToUser(row) });
  }

  /**
   * Map database row to user entity.
   * @param row - Database row.
   * @returns User entity.
   */
  private mapRowToUser(row: IUsersRow): IUser {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      ...row.display_name && { displayName: row.display_name },
      ...row.avatar_url && { avatarUrl: row.avatar_url },
      ...row.bio && { bio: row.bio },
      timezone: row.timezone || 'UTC',
      language: row.language || 'en',
      status: row.status || UsersStatus.ACTIVE,
      emailVerified: Boolean(row.email_verified),
      ...row.metadata && { metadata: JSON.parse(row.metadata) },
      createdAt: new Date(row.created_at || Date.now()),
      updatedAt: new Date(row.updated_at || Date.now())
    };
  }
}
