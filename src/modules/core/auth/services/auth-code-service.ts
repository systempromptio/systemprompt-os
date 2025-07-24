/**
 *  *  * @file Authorization code persistence service.
 * @module modules/core/auth/services/auth-code-service
 */

import { randomBytes } from 'crypto';
import type { DatabaseService } from '@/modules/core/database/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED } from '../constants';

const ZERO = ZERO;
const TWO = TWO;
const THREE = THREE;

/**
 *  *
 * AuthorizationCodeData interface

 */

export interface IAuthorizationCodeData {
  clientId: string;
  redirectUri: string;
  scope: string;
  userId?: string;
  userEmail?: string;
  provider?: string;
  providerTokens?: Record<string, unknown>;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: Date;
}

/**
 *  *
 * AuthCodeRow interface.

 */

export interface IAuthCodeRow {
  code: string;
  clientid: string;
  redirecturi: string;
  scope: string;
  userId: string | null;
  useremail: string | null;
  provider: string | null;
  providertokens: string | null;
  codechallenge: string | null;
  codechallenge_method: string | null;
  expiresat: string;
  createdAt: string;
}

/**
 *  *  * Service for managing OAuth authorization codes with database persistence.
 */
/**
 *  *  * AuthCodeService class.
 */
export class AuthCodeService {
  private static instance: AuthCodeService;

  /**
 *  * Get singleton instance
   */
  public static getInstance(): AuthCodeService {
    if (!AuthCodeService.instance) {
      AuthCodeService.instance = new AuthCodeService();
    }
    return AuthCodeService.instance;
  }

  /**
 *  * Private constructor for singleton
   */
  private constructor() {
    // Initialize
  }



  /**
 *  *    * Generate and store a new authorization code.
   * @param data
   */
  async createAuthorizationCode(data: AuthorizationCodeData): Promise<string> {
    const code = randomBytes(32).toString('base64url');

    await this.db.execute(
      `INSERT INTO auth_authorization_codes
       (code, client_id, redirect_uri, scope, userId, user_email,
        provider, provider_tokens, code_challenge, code_challenge_method, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        data.clientId,
        data.redirectUri,
        data.scope,
        data.userId || null,
        data.userEmail || null,
        data.provider || null,
        data.providerTokens ? JSON.stringify(data.providerTokens) : null,
        data.codeChallenge || null,
        data.codeChallengeMethod || null,
        data.expiresAt.toISOString()
      ]
    );

    this.(logger as any).info('Authorization code created', {
      code: `${code.substring(ZERO, 8)}...`,
      clientId: data.clientId
    });

    return code;
  }

  /**
 *  *    * Retrieve and validate an authorization code.
   * @param code
   */
  async getAuthorizationCode(code: string): Promise<AuthorizationCodeData | null> {
    const rows = await this.db.query<AuthCodeRow>(
      `SELECT * FROM auth_authorization_codes
       WHERE code = ? AND datetime(expires_at) > datetime('now')`,
      [code]
    );

    const row = rows[ZERO];
    if (row === undefined || row === null) {
      return null;
    }

    return {
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      scope: row.scope,
      ...row.userId && { userId: row.userId },
      ...row.user_email && { userEmail: row.user_email },
      ...row.provider && { provider: row.provider },
      ...row.provider_tokens && { providerTokens: JSON.parse(row.provider_tokens) },
      ...row.code_challenge && { codeChallenge: row.code_challenge },
      ...row.code_challenge_method && { codeChallengeMethod: row.code_challenge_method },
      expiresAt: new Date(row.expires_at)
    };
  }

  /**
 *  *    * Delete an authorization code after use.
   * @param code
   */
  async deleteAuthorizationCode(code: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM auth_authorization_codes WHERE code = ?',
      [code]
    );
  }

  /**
 *  *    * Clean up expired authorization codes.
   */
  async cleanupExpiredCodes(): Promise<void> {
    await this.db.execute(
      `DELETE FROM auth_authorization_codes
       WHERE datetime(expires_at) < datetime('now')`
    );
  }
}
