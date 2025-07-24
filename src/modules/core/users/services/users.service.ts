/* eslint-disable
  logical-assignment-operators,
  @typescript-eslint/no-unnecessary-condition,
  @typescript-eslint/strict-boolean-expressions,
  @typescript-eslint/await-thenable,
  systemprompt-os/no-block-comments
*/
/**
 * Users service implementation - manages user accounts and authentication.
 * @file Users service implementation.
 * @module users/services
 * Provides business logic for user management operations.
 */

import { randomUUID, randomBytes, createHash } from 'crypto';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { UsersRepository } from '@/modules/core/users/repositories/users-repository.js';
import {
  UserStatusEnum,
  type IUser,
  type IUserSession,
  type IUserApiKey,
  type IUserCreateData,
  type IUserUpdateData,
  type IAuthResult,
  type IUsersService
} from '@/modules/core/users/types/index.js';

const SESSION_EXPIRY_HOURS = 24;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

/**
 * Service for managing users and authentication.
 */
export class UsersService implements IUsersService {
  private static instance: UsersService;
  private readonly repository: UsersRepository;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.repository = UsersRepository.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns The users service instance.
   */
  static getInstance(): UsersService {
    if (!UsersService.instance) {
      UsersService.instance = new UsersService();
    }
    return UsersService.instance;
  }

  /**
   * Set logger instance.
   * @param logger - The logger instance to use.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize service.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.repository.initialize();
    await this.createDefaultUsers();
    this.initialized = true;
    this.logger?.info('UsersService initialized');
  }

  /**
   * Create a new user.
   * @param data - The user creation data.
   * @returns Promise that resolves to the created user.
   */
  async createUser(data: IUserCreateData): Promise<IUser> {
    await this.ensureInitialized();

    // Check for existing username/email
    const existingUsername = await this.repository.findByUsername(data.username);
    if (existingUsername !== null) {
      throw new Error(`Username already exists: ${data.username}`);
    }

    const existingEmail = await this.repository.findByEmail(data.email);
    if (existingEmail !== null) {
      throw new Error(`Email already exists: ${data.email}`);
    }

    const id = randomUUID();
    this.logger?.info(`Creating user: ${data.username}`);

    const passwordHash = data.password ? this.hashPassword(data.password) : undefined;
    const user = await this.repository.createUser(id, data.username, data.email, passwordHash);

    // Assign default role if specified
    if (data.role) {
      try {
        const { PermissionsService } = await import('@/modules/core/permissions/services/permissions.service.js');
        const permissionsService = PermissionsService.getInstance();
        const roles = await permissionsService.listRoles();
        const role = roles.find(r => r.name === data.role);
        if (role) {
          await permissionsService.assignRole(id, role.id);
        }
      } catch (error) {
        this.logger?.warn(`Failed to assign role ${data.role} to user ${id}: ${String(error)}`);
      }
    }

    this.logger?.info(`Created user: ${id}`);
    return user;
  }

  /**
   * Get user by ID.
   * @param id - The user ID.
   * @returns Promise that resolves to the user or null if not found.
   */
  async getUser(id: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findById(id);
  }

  /**
   * Get user by username.
   * @param username - The username.
   * @returns Promise that resolves to the user or null if not found.
   */
  async getUserByUsername(username: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findByUsername(username);
  }

  /**
   * Get user by email.
   * @param email - The email address.
   * @returns Promise that resolves to the user or null if not found.
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    await this.ensureInitialized();
    return await this.repository.findByEmail(email);
  }

  /**
   * List all users.
   * @returns Promise that resolves to array of users.
   */
  async listUsers(): Promise<IUser[]> {
    await this.ensureInitialized();
    return await this.repository.findAll();
  }

  /**
   * Update user information.
   * @param id - The user ID.
   * @param data - The update data.
   * @returns Promise that resolves to the updated user.
   */
  async updateUser(id: string, data: IUserUpdateData): Promise<IUser> {
    await this.ensureInitialized();

    const user = await this.repository.findById(id);
    if (user === null) {
      throw new Error(`User not found: ${id}`);
    }

    // Check email uniqueness if updating
    if (data.email && data.email !== user.email) {
      const existingEmail = await this.repository.findByEmail(data.email);
      if (existingEmail !== null) {
        throw new Error(`Email already exists: ${data.email}`);
      }
    }

    this.logger?.info(`Updating user: ${id}`);
    const updatedUser = await this.repository.updateUser(id, data);
    this.logger?.info(`Updated user: ${id}`);

    return updatedUser;
  }

  /**
   * Delete a user.
   * @param id - The user ID.
   * @returns Promise that resolves when deleted.
   */
  async deleteUser(id: string): Promise<void> {
    await this.ensureInitialized();

    const user = await this.repository.findById(id);
    if (user === null) {
      throw new Error(`User not found: ${id}`);
    }

    this.logger?.info(`Deleting user: ${id}`);
    await this.repository.deleteUser(id);
    this.logger?.info(`Deleted user: ${id}`);
  }

  /**
   * Authenticate a user.
   * @param username - The username or email.
   * @param password - The password.
   * @returns Promise that resolves to authentication result.
   */
  async authenticateUser(username: string, password: string): Promise<IAuthResult> {
    await this.ensureInitialized();

    // Find user by username or email
    let user = await this.repository.findByUsername(username);
    if (user === null) {
      user = await this.repository.findByEmail(username);
    }

    if (user === null) {
      return {
        success: false,
        reason: 'Invalid credentials'
      };
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return {
        success: false,
        reason: 'Account is locked'
      };
    }

    // Check password
    if (!user.passwordHash || !this.verifyPassword(password, user.passwordHash)) {
      await this.handleFailedLogin(user);
      return {
        success: false,
        reason: 'Invalid credentials'
      };
    }

    // Check account status
    if (user.status !== UserStatusEnum.ACTIVE) {
      return {
        success: false,
        reason: `Account is ${user.status}`
      };
    }

    // Success - create session
    await this.repository.updateLoginInfo(user.id, true);
    const session = await this.createSession(user.id);

    return {
      success: true,
      user,
      session
    };
  }

  /**
   * Create a user session.
   * @param userId - The user ID.
   * @param ipAddress - Optional IP address.
   * @param userAgent - Optional user agent.
   * @returns Promise that resolves to the session.
   */
  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IUserSession> {
    await this.ensureInitialized();

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

    const session = await this.repository.createSession(
      randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent
    );

    // Return session with unhashed token for the client
    return {
      ...session,
      tokenHash: token
    };
  }

  /**
   * Validate a session token.
   * @param token - The session token.
   * @returns Promise that resolves to the user or null if invalid.
   */
  async validateSession(token: string): Promise<IUser | null> {
    await this.ensureInitialized();

    const tokenHash = this.hashToken(token);
    const session = await this.repository.findSessionByToken(tokenHash);

    if (session === null) {
      return null;
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      return null;
    }

    // Check if revoked
    if (session.revokedAt !== undefined) {
      return null;
    }

    // Update last activity
    await this.repository.updateSessionActivity(session.id);

    return await this.repository.findById(session.userId);
  }

  /**
   * Revoke a session.
   * @param sessionId - The session ID.
   * @returns Promise that resolves when revoked.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    await this.repository.revokeSession(sessionId);
  }

  /**
   * Create an API key.
   * @param userId - The user ID.
   * @param name - The API key name.
   * @param permissions - Optional permissions.
   * @returns Promise that resolves to the key and API key entity.
   */
  async createApiKey(
    userId: string,
    name: string,
    permissions?: string[]
  ): Promise<{ key: string; apiKey: IUserApiKey }> {
    await this.ensureInitialized();

    const user = await this.repository.findById(userId);
    if (user === null) {
      throw new Error(`User not found: ${userId}`);
    }

    const key = this.generateApiKey();
    const keyHash = this.hashToken(key);

    const apiKey = await this.repository.createApiKey(
      randomUUID(),
      userId,
      name,
      keyHash,
      permissions
    );

    return { key, apiKey };
  }

  /**
   * Validate an API key.
   * @param key - The API key.
   * @returns Promise that resolves to the user or null if invalid.
   */
  async validateApiKey(key: string): Promise<IUser | null> {
    await this.ensureInitialized();

    const keyHash = this.hashToken(key);
    const apiKey = await this.repository.findApiKeyByHash(keyHash);

    if (apiKey === null) {
      return null;
    }

    // Check if expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used
    await this.repository.updateApiKeyUsage(apiKey.id);

    return await this.repository.findById(apiKey.userId);
  }

  /**
   * Revoke an API key.
   * @param keyId - The API key ID.
   * @returns Promise that resolves when revoked.
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await this.ensureInitialized();
    await this.repository.deleteApiKey(keyId);
  }

  /**
   * Handle failed login attempt.
   * @param user - The user.
   * @returns Promise that resolves when handled.
   */
  private async handleFailedLogin(user: IUser): Promise<void> {
    const attempts = user.loginAttempts + 1;
    
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
      await this.repository.lockUser(user.id, lockedUntil);
      this.logger?.warn(`User ${user.id} locked due to too many failed login attempts`);
    } else {
      await this.repository.updateLoginInfo(user.id, false);
    }
  }

  /**
   * Hash a password.
   * @param password - The plain text password.
   * @returns The hashed password.
   */
  private hashPassword(password: string): string {
    // Simplified for demo - use bcrypt or argon2 in production
    return createHash('sha256').update(password).digest('hex');
  }

  /**
   * Verify a password.
   * @param password - The plain text password.
   * @param hash - The password hash.
   * @returns True if password matches.
   */
  private verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  /**
   * Generate a session token.
   * @returns The generated token.
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate an API key.
   * @returns The generated API key.
   */
  private generateApiKey(): string {
    return `sp_${randomBytes(24).toString('hex')}`;
  }

  /**
   * Hash a token.
   * @param token - The token to hash.
   * @returns The hashed token.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create default users.
   * @returns Promise that resolves when created.
   */
  private async createDefaultUsers(): Promise<void> {
    const adminUser = await this.repository.findByUsername('admin');
    if (adminUser === null) {
      await this.createUser({
        username: 'admin',
        email: 'admin@systemprompt.os',
        password: 'admin123',
        role: 'admin'
      });
    }
  }

  /**
   * Ensure service is initialized.
   * @returns Promise that resolves when initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}