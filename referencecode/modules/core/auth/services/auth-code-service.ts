/**
 * @fileoverview Authorization code persistence service
 * @module modules/core/auth/services/auth-code-service
 */

import { randomBytes } from 'crypto';
import { DatabaseService } from '@/modules/core/database/index.js';
import type { Logger } from '@/modules/types.js';

export interface AuthorizationCodeData {
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

interface AuthCodeRow {
  code: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  user_id: string | null;
  user_email: string | null;
  provider: string | null;
  provider_tokens: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * Service for managing OAuth authorization codes with database persistence
 */
export class AuthCodeService {
  private static instance: AuthCodeService;
  private logger?: Logger;

  private constructor(private readonly db: DatabaseService) {}

  static getInstance(): AuthCodeService {
    if (!this.instance) {
      this.instance = new AuthCodeService(DatabaseService.getInstance());
    }
    return this.instance;
  }

  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Generate and store a new authorization code
   */
  async createAuthorizationCode(data: AuthorizationCodeData): Promise<string> {
    const code = randomBytes(32).toString('base64url');

    await this.db.execute(
      `INSERT INTO auth_authorization_codes 
       (code, client_id, redirect_uri, scope, user_id, user_email, 
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
        data.expiresAt.toISOString(),
      ],
    );

    this.logger?.info('Authorization code created', {
      code: `${code.substring(0, 8)  }...`,
      clientId: data.clientId,
    });

    return code;
  }

  /**
   * Retrieve and validate an authorization code
   */
  async getAuthorizationCode(code: string): Promise<AuthorizationCodeData | null> {
    const rows = await this.db.query<AuthCodeRow>(
      `SELECT * FROM auth_authorization_codes 
       WHERE code = ? AND datetime(expires_at) > datetime('now')`,
      [code],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      scope: row.scope,
      ...(row.user_id && { userId: row.user_id }),
      ...(row.user_email && { userEmail: row.user_email }),
      ...(row.provider && { provider: row.provider }),
      ...(row.provider_tokens && { providerTokens: JSON.parse(row.provider_tokens) }),
      ...(row.code_challenge && { codeChallenge: row.code_challenge }),
      ...(row.code_challenge_method && { codeChallengeMethod: row.code_challenge_method }),
      expiresAt: new Date(row.expires_at),
    };
  }

  /**
   * Delete an authorization code after use
   */
  async deleteAuthorizationCode(code: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM auth_authorization_codes WHERE code = ?',
      [code],
    );
  }

  /**
   * Clean up expired authorization codes
   */
  async cleanupExpiredCodes(): Promise<void> {
    await this.db.execute(
      `DELETE FROM auth_authorization_codes 
       WHERE datetime(expires_at) < datetime('now')`,
    );
  }
}