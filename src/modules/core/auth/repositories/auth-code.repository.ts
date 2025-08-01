/**
 * Repository for authorization code persistence operations.
 * @module modules/core/auth/repositories/auth-code-repository
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import type {
  IAuthCodeCreate as IAuthorizationCodeData,
} from '@/modules/core/auth/types/manual';
import type { IAuthAuthorizationCodesRow } from '@/modules/core/auth/types/database.generated';
import { ZERO } from '@/constants/numbers';

/**
 * Repository class for authorization code persistence operations.
 */
export class AuthCodeRepository {
  /**
   * Constructor for AuthCodeRepository.
   * @param database - Database service instance.
   * @param logger - Logger instance.
   */
  constructor(
    private readonly database: DatabaseService,
    private readonly logger: ILogger
  ) {}

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
    await this.database.execute(
      `INSERT INTO auth_authorization_codes
       (code, client_id, redirect_uri, scope, user_id, user_email,
        provider, provider_tokens, code_challenge, code_challenge_method, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        authCode,
        authData.clientId,
        authData.redirect_uri,
        authData.scopes ? authData.scopes.join(' ') : '',
        authData.user_id ?? null,
        null,
        authData.provider ?? null,
        null,
        authData.codeChallenge ?? null,
        authData.codeChallengeMethod ?? null,
        authData.expires_at.toISOString(),
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
    const rows = await this.database.query<IAuthAuthorizationCodesRow>(
      `SELECT * FROM auth_authorization_codes
       WHERE code = ? AND datetime(expires_at) > datetime('now')`,
      [authCode],
    );

    const [row] = rows;
    if (row === undefined || row === null) {
      return null;
    }

    return {
      code: row.code,
      clientId: row.client_id,
      redirect_uri: row.redirect_uri,
      scopes: row.scope ? row.scope.split(' ') : [],
      user_id: row.user_id || '',
      provider: row.provider || '',
      expires_at: new Date(row.expires_at),
      ...row.code_challenge !== null && { codeChallenge: row.code_challenge },
      ...row.code_challenge_method !== null && { codeChallengeMethod: row.code_challenge_method },
    };
  }

  /**
   * Deletes an authorization code after use.
   * @param authCode - The authorization code to delete.
   * @returns Promise that resolves when the code is deleted.
   */
  public async deleteAuthorizationCode(authCode: string): Promise<void> {
    await this.database.execute(
      'DELETE FROM auth_authorization_codes WHERE code = ?',
      [authCode],
    );
  }

  /**
   * Cleans up expired authorization codes.
   * @returns Promise that resolves when cleanup is complete.
   */
  public async cleanupExpiredCodes(): Promise<void> {
    await this.database.execute(
      `DELETE FROM auth_authorization_codes
       WHERE datetime(expires_at) < datetime('now')`,
    );
  }
}
