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
import type { Database } from 'better-sqlite3';

/**
 * Repository for users data operations.
 */
export class UsersRepository {
  private static instance: UsersRepository;
  private database?: Database;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    // Database will be set during initialization
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
    this.database = dbService.getDatabase();
    
    // Ensure tables are created
    await dbService.ensureSchemaInitialized('users');
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
    const stmt = this.database.prepare(`
      INSERT INTO users (id, username, email, password_hash, status, email_verified, login_attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      username,
      email,
      passwordHash || null,
      UserStatusEnum.ACTIVE,
      0,
      0,
      now,
      now
    );

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

    const stmt = this.database.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    
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

    const stmt = this.database.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username) as any;
    
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

    const stmt = this.database.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;
    
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

    const stmt = this.database.prepare('SELECT * FROM users ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => this.mapRowToUser(row));
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

    const stmt = this.database.prepare(`
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    
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

    const stmt = this.database.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      throw new Error(`User not found: ${id}`);
    }
  }

  /**
   * Update login information.
   * @param id - The user ID.
   * @param success - Whether login was successful.
   */
  updateLoginInfo(id: string, success: boolean): void {
    const user = this.users.get(id);
    if (!user) {
      return;
    }

    if (success) {
      user.lastLoginAt = new Date();
      user.loginAttempts = 0;
      user.lockedUntil = new Date(0);
    } else {
      user.loginAttempts += 1;
    }

    user.updatedAt = new Date();
  }

  /**
   * Lock user account.
   * @param id - The user ID.
   * @param until - Lock until date.
   */
  lockUser(id: string, until: Date): void {
    const user = this.users.get(id);
    if (!user) {
      return;
    }

    user.lockedUntil = until;
    user.updatedAt = new Date();
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
  createSession(options: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): IUserSession {
    const {
 id, userId, tokenHash, expiresAt, ipAddress, userAgent
} = options;
    const session: IUserSession = {
      id,
      userId,
      tokenHash,
      ipAddress: ipAddress ?? '',
      userAgent: userAgent ?? '',
      expiresAt,
      createdAt: new Date(),
      lastActivityAt: new Date()
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Find session by token hash.
   * @param tokenHash - The token hash.
   * @returns The session or null.
   */
  findSessionByToken(tokenHash: string): IUserSession | null {
    for (const session of Array.from(this.sessions.values())) {
      if (session.tokenHash === tokenHash) {
        return session;
      }
    }
    return null;
  }

  /**
   * Update session activity.
   * @param id - The session ID.
   */
  updateSessionActivity(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivityAt = new Date();
    }
  }

  /**
   * Revoke session.
   * @param id - The session ID.
   */
  revokeSession(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.revokedAt = new Date();
    }
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
  createApiKey(options: {
    id: string;
    userId: string;
    name: string;
    keyHash: string;
    permissions?: string[];
  }): IUserApiKey {
    const {
 id, userId, name, keyHash, permissions
} = options;
    const apiKey: IUserApiKey = {
      id,
      userId,
      name,
      keyHash,
      permissions: permissions ?? [],
      createdAt: new Date()
    };

    this.apiKeys.set(id, apiKey);
    return apiKey;
  }

  /**
   * Find API key by hash.
   * @param keyHash - The key hash.
   * @returns The API key or null.
   */
  findApiKeyByHash(keyHash: string): IUserApiKey | null {
    for (const apiKey of Array.from(this.apiKeys.values())) {
      if (apiKey.keyHash === keyHash) {
        return apiKey;
      }
    }
    return null;
  }

  /**
   * Update API key usage.
   * @param id - The API key ID.
   */
  updateApiKeyUsage(id: string): void {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.lastUsedAt = new Date();
    }
  }

  /**
   * Delete API key.
   * @param id - The API key ID.
   */
  deleteApiKey(id: string): void {
    this.apiKeys.delete(id);
  }

  /**
   * Map database row to user object.
   * @param row - Database row.
   * @returns User object.
   */
  private mapRowToUser(row: any): IUser {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash || '',
      status: row.status as UserStatusEnum,
      emailVerified: Boolean(row.email_verified),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      loginAttempts: row.login_attempts || 0,
      lockedUntil: row.locked_until ? new Date(row.locked_until) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
