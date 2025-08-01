/**
 * Authorization code persistence service.
 * @module modules/core/auth/services/auth-code-service
 */

import { randomBytes } from 'crypto';
import { AuthCodeRepository } from '@/modules/core/auth/repositories/auth-code.repository';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { ILogger } from '@/modules/core/logger/types/manual';
import type {
  IAuthCodeCreate as IAuthorizationCodeData,
} from '@/modules/core/auth/types/manual';

/**
 * AuthCodeService class for managing authorization codes.
 */
export class AuthCodeService {
  private static instance: AuthCodeService | undefined;
  private readonly repository: AuthCodeRepository;

  /**
   * Creates a new AuthCodeService instance.
   * @param database - Database service instance.
   * @param logger - Logger instance.
   */
  private constructor(database: DatabaseService, logger: ILogger) {
    this.repository = new AuthCodeRepository(database, logger);
  }

  /**
   * Initialize AuthCodeService.
   * @param database - Database service instance.
   * @param logger - Logger instance.
   * @returns AuthCodeService instance.
   */
  public static initialize(database: DatabaseService, logger: ILogger): AuthCodeService {
    AuthCodeService.instance ??= new AuthCodeService(database, logger);
    return AuthCodeService.instance;
  }

  /**
   * Gets the singleton instance of AuthCodeService.
   * @returns AuthCodeService instance.
   * @throws Error if service not initialized.
   */
  public static getInstance(): AuthCodeService {
    if (AuthCodeService.instance === undefined) {
      // Try to auto-initialize if database and logger are available
      try {
        const { DatabaseService } = require('@/modules/core/database/services/database.service');
        const { LoggerService } = require('@/modules/core/logger/services/logger.service');
        const database = DatabaseService.getInstance();
        const logger = LoggerService.getInstance();
        return AuthCodeService.initialize(database, logger);
      } catch (error) {
        throw new Error('AuthCodeService must be initialized with database and logger first');
      }
    }
    return AuthCodeService.instance;
  }

  /**
   * Generates and stores a new authorization code.
   * @param authorizationData - The authorization code data to store.
   * @returns Promise that resolves to the generated authorization code.
   */
  public async createAuthorizationCode(authorizationData: IAuthorizationCodeData): Promise<string> {
    const authCode = randomBytes(32).toString('base64url');

    await this.repository.storeAuthorizationCode(authCode, authorizationData);

    return authCode;
  }

  /**
   * Retrieves and validates an authorization code.
   * @param authCode - The authorization code to retrieve.
   * @returns Promise that resolves to authorization code data or null if not found/expired.
   */
  public async getAuthorizationCode(authCode: string): Promise<IAuthorizationCodeData | null> {
    return await this.repository.getAuthorizationCode(authCode);
  }

  /**
   * Deletes an authorization code after use.
   * @param authCode - The authorization code to delete.
   * @returns Promise that resolves when the code is deleted.
   */
  public async deleteAuthorizationCode(authCode: string): Promise<void> {
    await this.repository.deleteAuthorizationCode(authCode);
  }

  /**
   * Cleans up expired authorization codes.
   * @returns Promise that resolves when cleanup is complete.
   */
  public async cleanupExpiredCodes(): Promise<void> {
    await this.repository.cleanupExpiredCodes();
  }
}
