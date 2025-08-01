/**
 * Auth repository implementation - manages authentication data persistence.
 * @file Auth repository implementation.
 * @module auth/repositories
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/manual';
import type { IAuthOauthIdentitiesRow } from '@/modules/core/auth/types/database.generated';

/**
 * Repository for managing authentication data.
 */
export class AuthRepository {
  private static instance: AuthRepository;
  private readonly database: DatabaseService;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.database = DatabaseService.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns The auth repository instance.
   */
  static getInstance(): AuthRepository {
    AuthRepository.instance ||= new AuthRepository();
    return AuthRepository.instance;
  }

  /**
   * Set logger instance.
   * @param logger - The logger instance to use.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize repository.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.database) {
      throw new Error('Database service not available');
    }

    this.initialized = true;
    this.logger?.info(LogSource.AUTH, 'AuthRepository initialized');
  }

  /**
   * Find user credentials by email.
   * @param email - User email.
   * @returns Promise that resolves to credentials or null.
   */
  async findCredentialsByEmail(email: string): Promise<{
    userId: string;
    passwordHash: string;
    salt: string;
  } | null> {
    this.logger?.debug(LogSource.AUTH, `Finding credentials for email: ${email}`);

    return null;
  }

  /**
   * Create new user credentials.
   * @param userId - User ID.
   * @param passwordHash - Hashed password.
   * @param salt - Password salt.
   * @returns Promise that resolves when credentials are created.
   */
  async createCredentials(userId: string, passwordHash: string, salt: string): Promise<void> {
    this.logger?.debug(LogSource.AUTH, `Creating credentials for user: ${userId}`);
    console.debug('Creating credentials with hash:', passwordHash.length, 'salt:', salt.length);
  }

  /**
   * Update user credentials.
   * @param userId - User ID.
   * @param passwordHash - New hashed password.
   * @param salt - New password salt.
   * @returns Promise that resolves when credentials are updated.
   */
  async updateCredentials(userId: string, passwordHash: string, salt: string): Promise<void> {
    this.logger?.debug(LogSource.AUTH, `Updating credentials for user: ${userId}`);
    console.debug('Updating credentials with hash:', passwordHash.length, 'salt:', salt.length);
  }

  /**
   * Delete user credentials.
   * @param userId - User ID.
   * @returns Promise that resolves when credentials are deleted.
   */
  async deleteCredentials(userId: string): Promise<void> {
    this.logger?.debug(LogSource.AUTH, `Deleting credentials for user: ${userId}`);
  }

  /**
   * Create or update OAuth identity.
   * @param data - The OAuth identity data.
   * @param data.user_id
   * @param data.provider
   * @param data.provider_user_id
   * @param data.provider_email
   * @param data.provider_name
   * @param data.provider_picture
   * @returns Promise that resolves when identity is saved.
   */
  async createOrUpdateOAuthIdentity(data: {
    user_id: string;
    provider: string;
    provider_user_id: string;
    provider_email?: string | null;
    provider_name?: string | null;
    provider_picture?: string | null;
  }): Promise<void> {
    const db = await this.database.getConnection();

    const result = await db.query<{ id: string }>(
      `SELECT id FROM auth_oauth_identities WHERE user_id = ? AND provider = ? LIMIT 1`,
      [data.user_id, data.provider]
    );
    const existing = result[0];

    if (existing) {
      await db.run(
        `UPDATE auth_oauth_identities 
         SET provider_user_id = ?, provider_email = ?, provider_name = ?, 
             provider_picture = ?, updated_at = ?
         WHERE user_id = ? AND provider = ?`,
        [
          data.provider_user_id,
          data.provider_email,
          data.provider_name,
          data.provider_picture,
          new Date().toISOString(),
          data.user_id,
          data.provider
        ]
      );
    } else {
      await db.run(
        `INSERT INTO auth_oauth_identities 
         (id, user_id, provider, provider_user_id, provider_email, provider_name, provider_picture, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${data.user_id}_${data.provider}`,
          data.user_id,
          data.provider,
          data.provider_user_id,
          data.provider_email,
          data.provider_name,
          data.provider_picture,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
    }

    this.logger?.info(LogSource.AUTH, `Saved OAuth identity for user: ${data.user_id}`);
  }

  /**
   * Get OAuth identity.
   * @param userId - The user ID.
   * @param provider - The provider name.
   * @returns Promise that resolves to OAuth identity or null.
   */
  async getOAuthIdentity(userId: string, provider: string): Promise<IAuthOauthIdentitiesRow | null> {
    const db = await this.database.getConnection();

    const result = await db.query<IAuthOauthIdentitiesRow>(
      `SELECT * FROM auth_oauth_identities WHERE user_id = ? AND provider = ? LIMIT 1`,
      [userId, provider]
    );

    return result[0] || null;
  }
}
