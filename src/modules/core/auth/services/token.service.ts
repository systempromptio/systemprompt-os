import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import type { Algorithm } from 'jsonwebtoken';
import type {
  AuthToken,
  IAuthConfig,
  JwtPayload,
  TokenCreateInput,
  TokenType,
  TokenValidationResult,
} from '@/modules/core/auth/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource, LoggerService } from '@/modules/core/logger/index';
import type { IDatabaseRepository } from '@/modules/core/database/repositories/database.repository';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import {
  MILLISECONDS_PER_SECOND,
  SIXTY,
  THREE,
  TWO,
  ZERO,
} from '@/const/numbers';

/**
 * Database row interface for auth_tokens table.
 */
interface ITokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  type: string;
  scope: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt?: string;
  isRevoked: boolean;
  metadata?: string;
}

/**
 * JWT creation parameters interface.
 */
interface IJwtParams {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  scope?: string[];
}

/**
 * Token management service.
 * Handles creation, validation, and management of authentication tokens.
 */
export class TokenService {
  private static instance: TokenService;
  private logger!: ILogger;
  private db!: IDatabaseRepository;
  private config!: IAuthConfig;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
  }

  /**
   * Get singleton instance.
   * @returns The TokenService instance.
   */
  public static getInstance(): TokenService {
    this.instance ??= new TokenService();
    return this.instance;
  }

  /**
   * Create a new authentication token.
   * @param input - Token creation parameters.
   * @returns Promise resolving to the created token.
   */
  public async createToken(input: TokenCreateInput): Promise<AuthToken> {
    const id = this.generateTokenId();
    const tokenValue = this.generateTokenValue();
    const hashedToken = this.hashToken(tokenValue);

    const ttl = input.expiresIn ?? this.getDefaultTtl(input.type);
    const expiresAt = new Date(Date.now() + ttl * MILLISECONDS_PER_SECOND);

    await this.getDb().execute(
      `INSERT INTO auth_tokens
       (id, userId, token_hash, type, scope, expires_at, metadata, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
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
      token: `${id}.${tokenValue}`,
      type: input.type,
      scope: input.scope,
      expiresAt,
      createdAt: new Date(),
      isRevoked: false,
      ...input.metadata ? { metadata: input.metadata } : {},
    };

    this.getLogger().info(LogSource.AUTH, 'Token created', {
      tokenId: id,
      userId: input.userId,
      type: input.type,
    });

    return token;
  }

  /**
   * Create JWT access token.
   * @param params - JWT creation parameters.
   * @param params.userId - User identifier.
   * @param params.email - User email.
   * @param params.name - User name.
   * @param params.roles - User roles.
   * @param params.scope - Token scope.
   * @returns JWT token string.
   * @throws Error when JWT creation fails.
   */
  public createJwt(params: IJwtParams): string {
    const config = this.getConfig();
    const now = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
    const payload: JwtPayload = {
      sub: params.userId,
      email: params.email,
      name: params.name,
      roles: params.roles,
      scope: params.scope ?? [],
      iat: now,
      exp: now + config.jwt.accessTokenTTL,
    };

    return jwt.sign(payload, config.jwt.privateKey, {
      algorithm: config.jwt.algorithm as Algorithm,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  }

  /**
   * Validate an authentication token.
   * @param tokenString - Token string to validate.
   * @returns Promise resolving to validation result.
   */
  public async validateToken(tokenString: string): Promise<TokenValidationResult> {
    const isJwt = tokenString.includes('.') && tokenString.split('.').length === THREE;
    if (isJwt) {
      return this.validateJwt(tokenString);
    }

    return await this.validateRegularToken(tokenString);
  }

  /**
   * Revoke a specific token.
   * @param tokenId - ID of the token to revoke.
   * @returns Promise that resolves when token is revoked.
   */
  public async revokeToken(tokenId: string): Promise<void> {
    await this.getDb().execute(
      'UPDATE auth_tokens SET is_revoked = true WHERE id = ?',
      [tokenId],
    );

    this.getLogger().info(LogSource.AUTH, 'Token revoked', { tokenId });
  }

  /**
   * Revoke all tokens for a specific user.
   * @param userId - ID of the user whose tokens to revoke.
   * @param type - Optional token type filter.
   * @returns Promise that resolves when tokens are revoked.
   */
  public async revokeUserTokens(userId: string, type?: string): Promise<void> {
    let sql = 'UPDATE auth_tokens SET is_revoked = true WHERE userId = ?';
    const params: unknown[] = [userId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    await this.getDb().execute(sql, params);

    this.getLogger().info(LogSource.AUTH, 'User tokens revoked', {
      userId,
      type,
    });
  }

  /**
   * List all active tokens for a user.
   * @param userId - ID of the user whose tokens to list.
   * @returns Promise resolving to array of user tokens.
   */
  public async listUserTokens(userId: string): Promise<AuthToken[]> {
    const result = await this.getDb().query<ITokenRow>(
      `SELECT * FROM auth_tokens
       WHERE userId = ? AND is_revoked = false
       ORDER BY createdAt DESC`,
      [userId],
    );

    return this.mapRowsToTokens(result);
  }

  /**
   * Clean up expired tokens from the database.
   * @returns Promise resolving to the number of tokens cleaned up.
   */
  public async cleanupExpiredTokens(): Promise<number> {
    const result = await this.getDb().query<{ count: number }>(
      "SELECT COUNT(*) as count FROM auth_tokens WHERE expires_at < datetime('now')",
    );

    const { count } = result[ZERO] ?? { count: ZERO };

    if (count > ZERO) {
      await this.getDb().execute(
        "DELETE FROM auth_tokens WHERE expires_at < datetime('now')",
      );

      this.getLogger().info(LogSource.AUTH, 'Expired tokens cleaned up', { count });
    }

    return count;
  }

  /**
   * Get logger instance.
   * @returns Logger instance.
   */
  private getLogger(): ILogger {
    this.logger ??= LoggerService.getInstance();
    return this.logger;
  }

  /**
   * Get database instance.
   * @returns Database instance.
   */
  private getDb(): IDatabaseRepository {
    this.db ??= DatabaseService.getInstance() as unknown as IDatabaseRepository;
    return this.db;
  }

  /**
   * Get token service configuration.
   * @returns Token service configuration.
   */
  private getConfig(): IAuthConfig {
    this.config ??= {
      jwt: {
        accessTokenTTL: 900,
        refreshTokenTTL: 2592000,
        algorithm: 'RS256',
        issuer: 'systemprompt-os',
        audience: 'systemprompt-os',
        keyStorePath: '',
        privateKey: '',
        publicKey: '',
      },
      session: {
        maxConcurrent: 5,
        absoluteTimeout: 86400,
        inactivityTimeout: 3600,
      },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 900,
        passwordMinLength: 8,
        requirePasswordChange: false,
      },
    };
    return this.config;
  }

  /**
   * Validate regular (non-JWT) token.
   * @param tokenString - Token string to validate.
   * @returns Promise resolving to validation result.
   */
  private async validateRegularToken(tokenString: string): Promise<TokenValidationResult> {
    const parts = tokenString.split('.');
    if (parts.length !== TWO) {
      return {
 valid: false,
reason: 'Invalid token format'
};
    }

    const [tokenId, tokenValue] = parts;
    if (!tokenId || !tokenValue) {
      return {
 valid: false,
reason: 'Invalid token format'
};
    }

    const hashedToken = this.hashToken(tokenValue);
    const result = await this.getDb().query<ITokenRow>(
      'SELECT * FROM auth_tokens WHERE id = ? AND token_hash = ?',
      [tokenId, hashedToken],
    );

    const tokenData = result[ZERO];
    if (!tokenData) {
      return {
 valid: false,
reason: 'Token not found'
};
    }

    if (tokenData.isRevoked) {
      return {
 valid: false,
reason: 'Token revoked'
};
    }

    if (new Date(tokenData.expiresAt) < new Date()) {
      return {
 valid: false,
reason: 'Token expired'
};
    }

    await this.updateTokenUsage(tokenId);
    const token = this.mapRowToToken(tokenData, tokenString);

    return {
      valid: true,
      userId: token.userId,
      scope: token.scope,
      token,
    };
  }

  /**
   * Validate JWT token.
   * @param token - JWT token string.
   * @returns Validation result.
   */
  private validateJwt(token: string): TokenValidationResult {
    try {
      const config = this.getConfig();
      const decoded = jwt.verify(token, config.jwt.publicKey, {
        algorithms: [config.jwt.algorithm as Algorithm],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }) as JwtPayload;

      return {
        valid: true,
        userId: decoded.sub,
        scope: decoded.scope,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid JWT';
      return {
        valid: false,
        reason: errorMessage,
      };
    }
  }

  /**
   * Update token last used timestamp.
   * @param tokenId - Token ID to update.
   * @returns Promise that resolves when update is complete.
   */
  private async updateTokenUsage(tokenId: string): Promise<void> {
    await this.getDb().execute(
      'UPDATE auth_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
      [tokenId],
    );
  }

  /**
   * Map database row to AuthToken object.
   * @param row - Database row.
   * @param tokenString - Token string.
   * @returns AuthToken object.
   */
  private mapRowToToken(row: ITokenRow, tokenString: string): AuthToken {
    const token: AuthToken = {
      id: row.id,
      userId: row.userId,
      token: tokenString,
      type: row.type as TokenType,
      scope: JSON.parse(row.scope) as string[],
      expiresAt: new Date(row.expiresAt),
      createdAt: new Date(row.createdAt),
      isRevoked: false,
      ...row.lastUsedAt ? { lastUsedAt: new Date(row.lastUsedAt) } : {},
      ...row.metadata ? { metadata: JSON.parse(row.metadata) as Record<string, unknown> } : {},
    };

    return token;
  }

  /**
   * Map database rows to AuthToken array.
   * @param rows - Database rows.
   * @returns Array of AuthToken objects.
   */
  private mapRowsToTokens(rows: ITokenRow[]): AuthToken[] {
    return rows.map((row): AuthToken => { return {
      id: row.id,
      userId: row.userId,
      token: `${row.id}.***`,
      type: row.type as TokenType,
      scope: JSON.parse(row.scope) as string[],
      expiresAt: new Date(row.expiresAt),
      createdAt: new Date(row.createdAt),
      isRevoked: Boolean(row.isRevoked),
      ...row.lastUsedAt ? { lastUsedAt: new Date(row.lastUsedAt) } : {},
      ...row.metadata ? { metadata: JSON.parse(row.metadata) as Record<string, unknown> } : {},
    } });
  }

  /**
   * Generate a unique token ID.
   * @returns Random token ID as hex string.
   */
  private generateTokenId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate a cryptographically secure token value.
   * @returns Random token value as base64url string.
   */
  private generateTokenValue(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Hash token for secure storage.
   * @param token - Token value to hash.
   * @returns SHA-256 hash of the token.
   */
  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  /**
   * Get default TTL for different token types.
   * @param type - Token type.
   * @returns TTL in seconds.
   */
  private getDefaultTtl(type: string): number {
    const config = this.getConfig();
    switch (type) {
      case 'access':
        return config.jwt.accessTokenTTL;
      case 'refresh':
        return config.jwt.refreshTokenTTL;
      case 'api':
        return 365 * 24 * SIXTY * SIXTY;
      case 'personal':
        return 90 * 24 * SIXTY * SIXTY;
      case 'service':
        return ZERO;
      default:
        return 24 * SIXTY * SIXTY;
    }
  }
}
