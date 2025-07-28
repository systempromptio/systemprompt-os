/**
 * Users repository implementation - database operations.
 */

import {
  type IUser,
  type IUserApiKey,
  type IUserSession,
  type IUserUpdateData,
  UserStatusEnum
} from '@/modules/core/users/types/index';
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
  private constructor() {
  }

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
   * @param options - User creation options.
   * @param options.id
   * @param options.username
   * @param options.email
   * @param options.passwordHash
   * @returns The created user.
   */
  async createUser(options: {
    id: string;
    username: string;
    email: string;
    passwordHash?: string;
  }): Promise<IUser> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const {
      id, username, email, passwordHash
    } = options;

    const now = new Date().toISOString();
    const stmt = await this.database.prepare(`
      INSERT INTO users (id, username, email, password_hash, status, email_verified, login_attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.run([
      id,
      username,
      email,
      passwordHash || null,
      UserStatusEnum.ACTIVE,
      0,
      0,
      now,
      now
    ]);

    const user: IUser = {
      id,
      username,
      email,
      passwordHash: passwordHash ?? '',
      status: UserStatusEnum.ACTIVE,
      emailVerified: false,
      loginAttempts: 0,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    return user;
  }

  /**
   * Find user by ID.
   * @param id - The user ID.
   * @returns The user or null.
   */
  async findById(id: string): Promise<IUser | null> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare('SELECT * FROM users WHERE id = ?');
    const row = await stmt.get([id]) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToUser(row);
  }

  /**
   * Find user by username.
   * @param username - The username.
   * @returns The user or null.
   */
  async findByUsername(username: string): Promise<IUser | null> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare('SELECT * FROM users WHERE username = ?');
    const row = await stmt.get([username]) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToUser(row);
  }

  /**
   * Find user by email.
   * @param email - The email address.
   * @returns The user or null.
   */
  async findByEmail(email: string): Promise<IUser | null> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare('SELECT * FROM users WHERE email = ?');
    const row = await stmt.get([email]) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToUser(row);
  }

  /**
   * Find all users.
   * @returns Array of users.
   */
  async findAll(): Promise<IUser[]> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare('SELECT * FROM users ORDER BY created_at DESC');
    const rows = await stmt.all();

    return rows.map(row => { return this.mapRowToUser(row) });
  }

  /**
   * Update user.
   * @param id - The user ID.
   * @param updateData - The update data.
   * @returns The updated user.
   */
  async updateUser(id: string, updateData: IUserUpdateData): Promise<IUser> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.email !== undefined) {
      updates.push('email = ?');
      values.push(updateData.email);
    }
    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }
    if (updateData.emailVerified !== undefined) {
      updates.push('email_verified = ?');
      values.push(updateData.emailVerified ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = await this.database.prepare(`
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `);

    const result = await stmt.run(values);

    if (result.changes === 0) {
      throw new Error(`User not found: ${id}`);
    }

    const user = await this.findById(id);
    if (!user) {
      throw new Error(`User not found after update: ${id}`);
    }

    return user;
  }

  /**
   * Delete user.
   * @param id - The user ID.
   */
  async deleteUser(id: string): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare('DELETE FROM users WHERE id = ?');
    const result = await stmt.run([id]);

    if (result.changes === 0) {
      throw new Error(`User not found: ${id}`);
    }
  }

  /**
   * Update login information.
   * @param id - The user ID.
   * @param success - Whether login was successful.
   */
  async updateLoginInfo(id: string, success: boolean): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const now = new Date().toISOString();
    const stmt = success
      ? await this.database.prepare('UPDATE users SET last_login_at = ?, login_attempts = 0, updated_at = ? WHERE id = ?')
      : await this.database.prepare('UPDATE users SET login_attempts = login_attempts + 1, updated_at = ? WHERE id = ?');

    if (success) {
      await stmt.run([now, now, id]);
    } else {
      await stmt.run([now, id]);
    }
  }

  /**
   * Lock user account.
   * @param id - The user ID.
   * @param until - Lock until date.
   */
  async lockUser(id: string, until: Date): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare(
      'UPDATE users SET locked_until = ?, login_attempts = 0, updated_at = ? WHERE id = ?'
    );
    await stmt.run([until.toISOString(), new Date().toISOString(), id]);
  }

  /**
   * Create session.
   * @param options - Session creation options.
   * @param options.id
   * @param options.userId
   * @param options.tokenHash
   * @param options.expiresAt
   * @param options.ipAddress
   * @param options.userAgent
   * @returns The created session.
   */
  async createSession(options: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<IUserSession> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const {
      id, userId, tokenHash, expiresAt, ipAddress, userAgent
    } = options;

    const now = new Date().toISOString();
    const stmt = await this.database.prepare(`
      INSERT INTO user_sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.run([
      id,
      userId,
      tokenHash,
      expiresAt.toISOString(),
      ipAddress || null,
      userAgent || null,
      now,
      now
    ]);

    return {
      id,
      userId,
      tokenHash,
      ipAddress: ipAddress ?? '',
      userAgent: userAgent ?? '',
      expiresAt,
      createdAt: new Date(now),
      lastActivityAt: new Date(now)
    };
  }

  /**
   * Find session by token hash.
   * @param tokenHash - The token hash.
   * @returns The session or null.
   */
  async findSessionByToken(tokenHash: string): Promise<IUserSession | null> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare('SELECT * FROM user_sessions WHERE token_hash = ?');
    const row = await stmt.get([tokenHash]) as any;

    if (!row) {
      return null;
    }

    const session: IUserSession = {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      lastActivityAt: new Date(row.last_activity_at)
    };

    if (row.ip_address) {
      session.ipAddress = row.ip_address;
    }
    if (row.user_agent) {
      session.userAgent = row.user_agent;
    }
    if (row.revoked_at) {
      session.revokedAt = new Date(row.revoked_at);
    }

    return session;
  }

  /**
   * Update session activity.
   * @param id - The session ID.
   */
  async updateSessionActivity(id: string): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare(
      'UPDATE user_sessions SET last_activity_at = ? WHERE id = ?'
    );
    await stmt.run([new Date().toISOString(), id]);
  }

  /**
   * Revoke session.
   * @param id - The session ID.
   */
  async revokeSession(id: string): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare(
      'UPDATE user_sessions SET revoked_at = ? WHERE id = ?'
    );
    await stmt.run([new Date().toISOString(), id]);
  }

  /**
   * Create API key.
   * @param options - API key creation options.
   * @param options.id
   * @param options.userId
   * @param options.name
   * @param options.keyHash
   * @param options.permissions
   * @returns The created API key.
   */
  async createApiKey(options: {
    id: string;
    userId: string;
    name: string;
    keyHash: string;
    permissions?: string[];
  }): Promise<IUserApiKey> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const {
      id, userId, name, keyHash, permissions
    } = options;

    const now = new Date().toISOString();
    const stmt = await this.database.prepare(`
      INSERT INTO user_api_keys (id, user_id, name, key_hash, permissions, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    await stmt.run([
      id,
      userId,
      name,
      keyHash,
      JSON.stringify(permissions || []),
      now
    ]);

    return {
      id,
      userId,
      name,
      keyHash,
      permissions: permissions ?? [],
      createdAt: new Date(now)
    };
  }

  /**
   * Find API key by hash.
   * @param keyHash - The key hash.
   * @returns The API key or null.
   */
  async findApiKeyByHash(keyHash: string): Promise<IUserApiKey | null> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare('SELECT * FROM user_api_keys WHERE key_hash = ?');
    const row = await stmt.get([keyHash]) as any;

    if (!row) {
      return null;
    }

    const apiKey: IUserApiKey = {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      keyHash: row.key_hash,
      createdAt: new Date(row.created_at)
    };

    const permissions = JSON.parse(row.permissions || '[]');
    if (permissions && permissions.length > 0) {
      apiKey.permissions = permissions;
    }
    if (row.expires_at) {
      apiKey.expiresAt = new Date(row.expires_at);
    }
    if (row.last_used_at) {
      apiKey.lastUsedAt = new Date(row.last_used_at);
    }

    return apiKey;
  }

  /**
   * Update API key usage.
   * @param id - The API key ID.
   */
  async updateApiKeyUsage(id: string): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare(
      'UPDATE user_api_keys SET last_used_at = ? WHERE id = ?'
    );
    await stmt.run([new Date().toISOString(), id]);
  }

  /**
   * Delete API key.
   * @param id - The API key ID.
   */
  async deleteApiKey(id: string): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const stmt = await this.database.prepare('DELETE FROM user_api_keys WHERE id = ?');
    await stmt.run([id]);
  }

  /**
   * Map database row to user object.
   * @param row - Database row.
   * @returns User object.
   */
  private mapRowToUser(row: any): IUser {
    const user: IUser = {
      id: row.id,
      username: row.username,
      email: row.email,
      status: row.status as UserStatusEnum,
      emailVerified: Boolean(row.email_verified),
      loginAttempts: row.login_attempts || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };

    if (row.password_hash) {
      user.passwordHash = row.password_hash;
    }
    if (row.last_login_at) {
      user.lastLoginAt = new Date(row.last_login_at);
    }
    if (row.locked_until) {
      user.lockedUntil = new Date(row.locked_until);
    }

    return user;
  }
}
