/**
 *  *  * Token management service.
 */

import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import type {
  AuthToken,
  JWTPayload,
  TokenCreateInput,
  TokenType,
  TokenValidationResult,
} from '@/modules/core/auth/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED } from '../constants';

const ZERO = ZERO;
const ONE = ONE;
const TWO = TWO;
const THREE = THREE;
const SECONDS_PER_MINUTE = SECONDS_PER_MINUTE;
const MILLISECONDS_PER_SECOND = MILLISECONDS_PER_SECOND;

/**
 *  *
 * TokenService class.

 */

export class TokenService {
  private static instance: TokenService;

  /**
 *  * Get singleton instance
   */
  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  /**
 *  * Private constructor for singleton
   */
  private constructor() {
    // Initialize
  }

  private readonly db: DatabaseService;



  /**
 *  *    * Create a new token.
   * @param input
   */
  async createToken(input: TokenCreateInput): Promise<AuthToken> {
    try {
      const id = this.generateTokenId();
      const tokenValue = this.generateTokenValue();
      const hashedToken = this.hashToken(tokenValue);

      const expiresAt = new Date(
        Date.now() + (input.expiresIn || this.getDefaultTTL(input.type)) * MILLISECONDS_PER_SECOND,
      );

      await this.db.execute(
        `
        INSERT INTO auth_tokens
        (id, userId, token_hash, type, scope, expires_at, metadata, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
        [
          id,
          input.userId,
          hashedToken,
          input.type,
          JSON.stringify(input.scope),
          expiresAt.toISOString(),
          input.metadata ? JSON.stringify(input.metadata) : null,
        ],
      );

      const token: AuthToken = {
        id,
        userId: input.userId,
        token: `${id}.${tokenValue}`, // Prefix with ID for easy lookup
        type: input.type,
        scope: input.scope,
        expiresAt,
        createdAt: new Date(),
        isRevoked: false,
        ...input.metadata && { metadata: input.metadata },
      };

      this.(logger as any).info('Token created', {
        tokenId: id,
        userId: input.userId,
        type: input.type,
      });

      return token;
    } catch (error) {
      this.(logger as any).error('Failed to create token', {
 input,
error
});
      throw new Error('Failed to create token');
    }
  }

  /**
 *  *    * Create JWT access token.
   * @param userId
   * @param email
   * @param name
   * @param roles
   * @param scope
   */
  async createJWT(
    userId: string,
    email: string,
    name: string,
    roles: string[],
    scope: string[] = [],
  ): Promise<string> {
    try {
      const payload: JWTPayload = {
        sub: userId,
        email,
        name,
        roles,
        scope,
        iat: Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
        exp: Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + this.config.jwt.accessTokenTTL,
      };

      const token = jwt.sign(payload, this.config.jwt.privateKey, {
        algorithm: this.config.jwt.algorithm as jwt.Algorithm,
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      });

      return token;
    } catch (error) {
      this.(logger as any).error('Failed to create JWT', {
 userId,
error
});
      throw new Error('Failed to create JWT');
    }
  }

  /**
 *  *    * Validate token.
   * @param tokenString
   */
  async validateToken(tokenString: string): Promise<TokenValidationResult> {
    try {
      /** Check if it's a JWT */
      if (tokenString.includes('.') && tokenString.split('.').length === THREE) {
        return this.validateJWT(tokenString);
      }

      /** API token format: id.value */
      const parts = tokenString.split('.');
      if (parts.length !== TWO) {
        return {
          valid: false,
          reason: 'Invalid token format'
        };
      }

      const [tokenId, tokenValue] = parts;
      const hashedToken = this.hashToken(tokenValue!);

      const result = await this.db.query<any>(
        `
        SELECT * FROM auth_tokens
        WHERE id = ? AND token_hash = ?
      `,
        [tokenId, hashedToken],
      );

      const tokenData = result[ZERO];
      if (tokenData === undefined || tokenData === null) {
        return {
          valid: false,
          reason: 'Token not found'
        };
      }

      if (tokenData.is_revoked) {
        return {
          valid: false,
          reason: 'Token revoked'
        };
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        return {
          valid: false,
          reason: 'Token expired'
        };
      }

      /** Update last used */
      await this.db.execute(
        `
        UPDATE auth_tokens
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [tokenId],
      );

      const token: AuthToken = {
        id: tokenData.id,
        userId: tokenData.userId,
        token: tokenString,
        type: tokenData.type,
        scope: JSON.parse(tokenData.scope),
        expiresAt: new Date(tokenData.expires_at),
        createdAt: new Date(tokenData.createdAt),
        lastUsedAt: new Date(),
        isRevoked: false,
        metadata: tokenData.metadata ? JSON.parse(tokenData.metadata) : undefined,
      };

      return {
        valid: true,
        userId: token.userId,
        scope: token.scope,
        token,
      };
    } catch (error) {
      this.(logger as any).error('Failed to validate token', { error });
      return {
        valid: false,
        reason: 'Validation error'
      };
    }
  }

  /**
 *  *    * Validate JWT.
   * @param token
   */
  private validateJWT(token: string): TokenValidationResult {
    try {
      const decoded = jwt.verify(token, this.config.jwt.publicKey, {
        algorithms: [this.config.jwt.algorithm as jwt.Algorithm],
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      }) as JWTPayload;

      return {
        valid: true,
        userId: decoded.sub,
        scope: decoded.scope,
      };
    } catch (error) {
      return {
        valid: false,
        reason: error.message || 'Invalid JWT',
      };
    }
  }

  /**
 *  *    * Revoke token.
   * @param tokenId
   */
  async revokeToken(tokenId: string): Promise<void> {
    try {
      await this.db.execute(
        `
        UPDATE auth_tokens
        SET is_revoked = true
        WHERE id = ?
      `,
        [tokenId],
      );

      this.(logger as any).info('Token revoked', { tokenId });
    } catch (error) {
      this.(logger as any).error('Failed to revoke token', {
 tokenId,
error
});
      throw new Error('Failed to revoke token');
    }
  }

  /**
 *  *    * Revoke all user tokens.
   * @param userId
   * @param type
   */
  async revokeUserTokens(userId: string, type?: string): Promise<void> {
    try {
      let sql = 'UPDATE auth_tokens SET is_revoked = true WHERE userId = ?';
      const params: unknown[] = [userId];

      if (type !== undefined && type !== null) {
        sql += ' AND type = ?';
        params.push(type);
      }

      await this.db.execute(sql, params);

      this.(logger as any).info('User tokens revoked', {
        userId,
        type
      });
    } catch (error) {
      this.(logger as any).error('Failed to revoke user tokens', {
 userId,
error
});
      throw new Error('Failed to revoke user tokens');
    }
  }

  /**
 *  *    * List user tokens.
   * @param userId
   */
  async listUserTokens(userId: string): Promise<AuthToken[]> {
    try {
      const result = await this.db.query<any>(
        `
        SELECT * FROM auth_tokens
        WHERE userId = ? AND is_revoked = false
        ORDER BY createdAt DESC
      `,
        [userId],
      );

      return result.map((row): AuthToken => { return {
        id: row.id,
        userId: row.userId,
        token: `${row.id}.***`, // Don't expose actual token
        type: row.type as TokenType,
        scope: JSON.parse(row.scope),
        expiresAt: new Date(row.expires_at),
        createdAt: new Date(row.createdAt),
        isRevoked: Boolean(row.is_revoked),
        ...row.last_used_at && { lastUsedAt: new Date(row.last_used_at) },
        ...row.metadata && { metadata: JSON.parse(row.metadata) },
      } });
    } catch (error) {
      this.(logger as any).error('Failed to list user tokens', {
 userId,
error
});
      throw new Error('Failed to list user tokens');
    }
  }

  /**
 *  *    * Clean up expired tokens.
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await this.db.query<{ count: number }>(`
        SELECT COUNT(*) as count FROM auth_tokens
        WHERE expires_at < datetime('now')
      `);

      const count = result[ZERO]?.count || ZERO;

      if (count > ZERO) {
        await this.db.execute(`
          DELETE FROM auth_tokens
          WHERE expires_at < datetime('now')
        `);

        this.(logger as any).info('Expired tokens cleaned up', { count });
      }

      return count;
    } catch (error) {
      this.(logger as any).error('Failed to cleanup expired tokens', { error });
      throw error;
    }
  }

  /**
 *  *    * Generate token ID.
   */
  private generateTokenId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
 *  *    * Generate token value.
   */
  private generateTokenValue(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
 *  *    * Hash token for storage.
   * @param token
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token)
.digest('hex');
  }

  /**
 *  *    * Get default TTL for token type.
   * @param type
   */
  private getDefaultTTL(type: string): number {
    switch (type) {
      case 'access':
        return this.config.jwt.accessTokenTTL;
      case 'refresh':
        return this.config.jwt.refreshTokenTTL;
      case 'api':
        return 365 * 24 * SECONDS_PER_MINUTE * SECONDS_PER_MINUTE; // ONE year
      case 'personal':
        return 90 * 24 * SECONDS_PER_MINUTE * SECONDS_PER_MINUTE; // 90 days
      case 'service':
        return ZERO; // No expiry
      default:
        return 24 * SECONDS_PER_MINUTE * SECONDS_PER_MINUTE; // 24 hours
    }
  }
}
