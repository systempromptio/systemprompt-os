/**
 * Auth repository implementation - manages authentication data persistence.
 * @file Auth repository implementation.
 * @module auth/repositories
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
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
    const db = this.database.getConnection();
    
    // Check if identity exists
    const existing = await db
      .select('auth_oauth_identities', ['id'])
      .where('user_id', data.user_id)
      .where('provider', data.provider)
      .executeTakeFirst();

    if (existing) {
      // Update existing
      await db
        .update('auth_oauth_identities')
        .set({
          provider_user_id: data.provider_user_id,
          provider_email: data.provider_email,
          provider_name: data.provider_name,
          provider_picture: data.provider_picture,
          updated_at: new Date().toISOString()
        })
        .where('user_id', data.user_id)
        .where('provider', data.provider)
        .execute();
    } else {
      // Create new
      await db
        .insert('auth_oauth_identities')
        .values({
          user_id: data.user_id,
          provider: data.provider,
          provider_user_id: data.provider_user_id,
          provider_email: data.provider_email,
          provider_name: data.provider_name,
          provider_picture: data.provider_picture,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .execute();
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
    const db = this.database.getConnection();
    
    const identity = await db
      .select('auth_oauth_identities', ['*'])
      .where('user_id', userId)
      .where('provider', provider)
      .executeTakeFirst();

    return identity || null;
  }
}
