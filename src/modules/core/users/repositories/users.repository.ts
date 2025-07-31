/**
 * Users repository implementation - database operations.
 * Handles user data persistence without authentication concerns.
 */

import { type IUsersRow } from '@/modules/core/users/types/database.generated';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';

/**
 * Repository for users data operations.
 */
export class UsersRepository {
  private static instance: UsersRepository;
  private dbService?: DatabaseService;

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
  async initialize() {
    this.dbService = DatabaseService.getInstance();
  }

  /**
   * Get database connection.
   */
  private async getDatabase(): Promise<IDatabaseConnection> {
    if (!this.dbService) {
      throw new Error('Repository not initialized');
    }
    return await this.dbService.getConnection();
  }

  /**
   * Create a new user.
   * @param userData
   */
  async createUser(userData: Omit<IUsersRow, 'id'> & { id: string }): Promise<IUsersRow> {
    const database = await this.getDatabase();

    const stmt = await database.prepare(
      `INSERT INTO users (
        id, username, email, display_name, avatar_url, bio,
        timezone, language, status, email_verified, preferences,
        metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    await stmt.run([
      userData.id,
      userData.username,
      userData.email,
      userData.display_name || null,
      userData.avatar_url || null,
      userData.bio || null,
      userData.timezone || null,
      userData.language || null,
      userData.status,
      userData.email_verified || null,
      userData.preferences || null,
      userData.metadata || null,
      userData.created_at,
      userData.updated_at
    ]);

    await stmt.finalize();

    return {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      display_name: userData.display_name || null,
      avatar_url: userData.avatar_url || null,
      bio: userData.bio || null,
      timezone: userData.timezone || null,
      language: userData.language || null,
      status: userData.status,
      email_verified: userData.email_verified || null,
      preferences: userData.preferences || null,
      metadata: userData.metadata || null,
      created_at: userData.created_at,
      updated_at: userData.updated_at
    };
  }

  /**
   * Find user by ID.
   * @param id
   */
  async findById(id: string): Promise<IUsersRow | null> {
    const database = await this.getDatabase();

    const result = await database.query<IUsersRow>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    const row = result.rows[0];
    return row || null;
  }

  /**
   * Find user by username.
   * @param username
   */
  async findByUsername(username: string): Promise<IUsersRow | null> {
    const database = await this.getDatabase();

    const result = await database.query<IUsersRow>(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    const row = result.rows[0];
    return row || null;
  }

  /**
   * Find user by email.
   * @param email
   */
  async findByEmail(email: string): Promise<IUsersRow | null> {
    const database = await this.getDatabase();

    const result = await database.query<IUsersRow>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const row = result.rows[0];
    return row || null;
  }

  /**
   * Find all users.
   */
  async findAll(): Promise<IUsersRow[]> {
    const database = await this.getDatabase();

    const result = await database.query<IUsersRow>(
      'SELECT * FROM users ORDER BY created_at DESC'
    );

    return result.rows;
  }

  /**
   * Update user.
   * @param id
   * @param data
   */
  async updateUser(id: string, data: Partial<Omit<IUsersRow, 'id' | 'created_at' | 'updated_at'>>): Promise<IUsersRow> {
    const database = await this.getDatabase();

    const updates = [];
    const values = [];

    if (data.username !== undefined) {
      updates.push('username = ?');
      values.push(data.username);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email);
    }
    if (data.display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(data.display_name);
    }
    if (data.avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      values.push(data.avatar_url);
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
    if (data.email_verified !== undefined) {
      updates.push('email_verified = ?');
      values.push(data.email_verified ? 1 : 0);
    }
    if (data.preferences !== undefined) {
      updates.push('preferences = ?');
      values.push(data.preferences);
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(data.metadata);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    const stmt = await database.prepare(
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
    const database = await this.getDatabase();

    const stmt = await database.prepare(
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
  async searchUsers(query: string): Promise<IUsersRow[]> {
    const database = await this.getDatabase();

    const searchPattern = `%${query}%`;
    const result = await database.query<IUsersRow>(
      `SELECT * FROM users 
       WHERE username LIKE ? OR email LIKE ? OR display_name LIKE ?
       ORDER BY created_at DESC`,
      [searchPattern, searchPattern, searchPattern]
    );

    return result.rows;
  }
}
