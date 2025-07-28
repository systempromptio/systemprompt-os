/**
 * Repository for authorization code persistence operations.
 * @module modules/core/auth/repositories/auth-code-repository
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import type {
  IAuthCodeRow,
  IAuthorizationCodeData,
} from '@/modules/core/auth/types/auth-code.types';
import { ZERO } from '@/constants/numbers';

/**
 * Repository class for authorization code persistence operations.
 */
export class AuthCodeRepository {
  private static instance: AuthCodeRepository;
  private readonly logger: ILogger;
  private readonly db: DatabaseService;

  /**
   * Creates a new AuthCodeRepository instance.
   */
  private constructor() {
    this.logger = LoggerService.getInstance();
    this.db = DatabaseService.getInstance();
  }

  /**
   * Gets the singleton instance of AuthCodeRepository.
   * @returns AuthCodeRepository instance.
   */
  public static getInstance(): AuthCodeRepository {
    AuthCodeRepository.instance ||= new AuthCodeRepository();
    return AuthCodeRepository.instance;
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
    await this.db.execute(
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

    this.logger.info(LogSource.AUTH, 'Authorization code stored', {
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
    const rows = await this.db.query<IAuthCodeRow>(
      `SELECT * FROM auth_authorization_codes
       WHERE code = ? AND datetime(expires_at) > datetime('now')`,
      [authCode],
    );

    const [row] = rows;
    if (row === undefined || row === null) {
      return null;
    }

    return {
      clientId: row.clientid,
      redirectUri: row.redirecturi,
      scope: row.scope,
      ...row.userId !== null && { userId: row.userId },
      ...row.useremail !== null && { userEmail: row.useremail },
      ...row.provider !== null && { provider: row.provider },
      ...row.providertokens !== null && { providerTokens: JSON.parse(row.providertokens) },
      ...row.codechallenge !== null && { codeChallenge: row.codechallenge },
      ...row.codeChallengeMethod !== null && { codeChallengeMethod: row.codeChallengeMethod },
      expiresAt: new Date(row.expiresat),
    };
  }

  /**
   * Deletes an authorization code after use.
   * @param authCode - The authorization code to delete.
   * @returns Promise that resolves when the code is deleted.
   */
  public async deleteAuthorizationCode(authCode: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM auth_authorization_codes WHERE code = ?',
      [authCode],
    );
  }

  /**
   * Cleans up expired authorization codes.
   * @returns Promise that resolves when cleanup is complete.
   */
  public async cleanupExpiredCodes(): Promise<void> {
    await this.db.execute(
      `DELETE FROM auth_authorization_codes
       WHERE datetime(expires_at) < datetime('now')`,
    );
  }
}
