/**
 * Repository for authorization code persistence operations.
 * @module modules/core/auth/repositories/auth-code-repository
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import type {
  IAuthorizationCodeData,
} from '@/modules/core/auth/types/auth-code.types';
import type { IAuthAuthorizationCodesRow } from '@/modules/core/auth/types/database.generated';
import { ZERO } from '@/constants/numbers';

/**
 * Repository class for authorization code persistence operations.
 */
export class AuthCodeRepository {
  private static instance: AuthCodeRepository;
  private logger?: ILogger;
  private dbService?: DatabaseService;

  /**
   * Creates a new AuthCodeRepository instance.
   */
  private constructor() {}

  /**
   * Gets the singleton instance of AuthCodeRepository.
   * @returns AuthCodeRepository instance.
   */
  public static getInstance(): AuthCodeRepository {
    AuthCodeRepository.instance ||= new AuthCodeRepository();
    return AuthCodeRepository.instance;
  }

  /**
   * Get logger instance (lazy initialization).
   * @returns Logger instance.
   */
  private getLogger(): ILogger {
    if (!this.logger) {
      try {
        // Try to get from module registry first
        const { getLoggerModule } = require('@/modules/core/logger/index');
        const loggerModule = getLoggerModule();
        this.logger = loggerModule.exports.service();
      } catch (error) {
        // Fallback to direct import if module not available in registry
        const { LoggerService } = require('@/modules/core/logger/services/logger.service');
        this.logger = LoggerService.getInstance();
      }
    }
    return this.logger;
  }

  /**
   * Get database connection (lazy initialization).
   * @returns Database connection.
   */
  private async getDatabase(): Promise<DatabaseService> {
    if (!this.dbService) {
      try {
        // Try to get from module registry first
        const { getDatabaseModule } = await import('@/modules/core/database/index');
        const databaseModule = getDatabaseModule();
        this.dbService = databaseModule.exports.service();
      } catch (error) {
        // Fallback to direct import if module not available in registry
        const { DatabaseService } = await import('@/modules/core/database/services/database.service');
        this.dbService = DatabaseService.getInstance();
      }
    }
    return this.dbService;
  }

  /**
   * Stores an authorization code in the database.
   * @param authCode - The authorization code to store.
   * @param authData - The authorization code data.
   * @returns Promise that resolves when the code is stored.
   */
  public async storeAuthorizationCode(
    authCode: string,
    authData: IAuthorizationCodeData,
  ): Promise<void> {
    const db = await this.getDatabase();
    await db.execute(
      `INSERT INTO auth_authorization_codes
       (code, client_id, redirect_uri, scope, user_id, user_email,
        provider, provider_tokens, code_challenge, code_challenge_method, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        authCode,
        authData.clientId,
        authData.redirectUri,
        authData.scope,
        authData.userId ?? null,
        authData.userEmail ?? null,
        authData.provider ?? null,
        authData.providerTokens ? JSON.stringify(authData.providerTokens) : null,
        authData.codeChallenge ?? null,
        authData.codeChallengeMethod ?? null,
        authData.expiresAt.toISOString(),
      ],
    );

    this.getLogger().info(LogSource.AUTH, 'Authorization code stored', {
      code: `${authCode.substring(ZERO, 8)}...`,
      clientId: authData.clientId,
    });
  }

  /**
   * Retrieves and validates an authorization code.
   * @param authCode - The authorization code to retrieve.
   * @returns Promise that resolves to the authorization code data or null if not found/expired.
   */
  public async getAuthorizationCode(authCode: string): Promise<IAuthorizationCodeData | null> {
    const db = await this.getDatabase();
    const rows = await db.query<IAuthAuthorizationCodesRow>(
      `SELECT * FROM auth_authorization_codes
       WHERE code = ? AND datetime(expires_at) > datetime('now')`,
      [authCode],
    );

    const [row] = rows;
    if (row === undefined || row === null) {
      return null;
    }

    return {
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      scope: row.scope,
      ...row.user_id !== null && { userId: row.user_id },
      ...row.code_challenge !== null && { codeChallenge: row.code_challenge },
      ...row.code_challenge_method !== null && { codeChallengeMethod: row.code_challenge_method },
      expiresAt: new Date(row.expires_at),
    };
  }

  /**
   * Deletes an authorization code after use.
   * @param authCode - The authorization code to delete.
   * @returns Promise that resolves when the code is deleted.
   */
  public async deleteAuthorizationCode(authCode: string): Promise<void> {
    const db = await this.getDatabase();
    await db.execute(
      'DELETE FROM auth_authorization_codes WHERE code = ?',
      [authCode],
    );
  }

  /**
   * Cleans up expired authorization codes.
   * @returns Promise that resolves when cleanup is complete.
   */
  public async cleanupExpiredCodes(): Promise<void> {
    const db = await this.getDatabase();
    await db.execute(
      `DELETE FROM auth_authorization_codes
       WHERE datetime(expires_at) < datetime('now')`,
    );
  }
}
