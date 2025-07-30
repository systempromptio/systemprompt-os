import { createHash, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import type {
  IAuthConfig,
  IJwtParams,
  JwtPayload,
  TokenCreateInput,
  TokenType,
  TokenValidationResult,
} from '@/modules/core/auth/types/index';
import type { IAuthTokensRow } from '@/modules/core/auth/types/database.generated';
import type { ILogger } from '@/modules/core/logger/types/index';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { TokenRepository } from '@/modules/core/auth/repositories/token.repository';
import {
  MILLISECONDS_PER_SECOND,
  SIXTY,
  THREE,
  TWO,
  ZERO,
} from '@/constants/numbers';

/**
 * Token management service.
 * Handles creation, validation, and management of authentication tokens.
 */
export class TokenService {
  private static instance: TokenService | undefined;
  private logger: ILogger | undefined;
  private tokenRepository: TokenRepository | undefined;
  private config: IAuthConfig | undefined;

  /**
   * Private constructor for singleton pattern.
   * @private
   */
  private constructor() {
  }

  /**
   * Initialize TokenService with database and logger.
   * @param database - Database service instance.
   * @param logger - Logger instance.
   * @returns TokenService instance.
   */
  public static initialize(database: DatabaseService, logger: ILogger): TokenService {
    const instance = TokenService.getInstance();
    instance.logger = logger;
    instance.tokenRepository = new TokenRepository(database);
    return instance;
  }

  /**
   * Get singleton instance.
   * @returns The TokenService instance.
   */
  public static getInstance(): TokenService {
    TokenService.instance ??= new TokenService();
    return TokenService.instance;
  }

  /**
   * Create a new authentication token.
   * @param input - Token creation parameters.
   * @returns Promise resolving to the created token.
   */
  public async createToken(input: TokenCreateInput): Promise<{ token: string; row: IAuthTokensRow }> {
    const id = this.generateTokenId();
    const tokenValue = this.generateTokenValue();
    const hashedToken = this.hashToken(tokenValue);

    const ttl = input.expires_in ?? this.getDefaultTtl(input.type);
    const expiresAt = new Date(Date.now() + ttl * MILLISECONDS_PER_SECOND);

    await this.getTokenRepository().insertToken(
      id,
      input.user_id,
      hashedToken,
      input.type,
      input.name || `${input.type} token`,
      input.scopes,
      expiresAt.toISOString(),
    );

    const tokenRow: IAuthTokensRow = {
      id,
      user_id: input.user_id,
      name: input.name || `${input.type} token`,
      token_hash: hashedToken,
      type: input.type,
      expires_at: expiresAt.toISOString(),
      last_used_at: null,
      is_revoked: 0,
      created_at: new Date().toISOString(),
    };

    this.getLogger().info(LogSource.AUTH, 'Token created', {
      tokenId: id,
      user_id: input.user_id,
      type: input.type,
    });

    return {
      token: `${id}.${tokenValue}`,
      row: tokenRow
    };
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
      algorithm: config.jwt.algorithm as jwt.Algorithm,
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
    await this.getTokenRepository().revokeToken(tokenId);

    this.getLogger().info(LogSource.AUTH, 'Token revoked', { tokenId });
  }

  /**
   * Revoke all tokens for a specific user.
   * @param user_id - ID of the user whose tokens to revoke.
   * @param type - Optional token type filter.
   * @returns Promise that resolves when tokens are revoked.
   */
  public async revokeUserTokens(user_id: string, type?: string): Promise<void> {
    await this.getTokenRepository().revokeUserTokens(user_id, type);

    this.getLogger().info(LogSource.AUTH, 'User tokens revoked', {
      user_id,
      type,
    });
  }

  /**
   * List all active tokens for a user.
   * @param user_id - ID of the user whose tokens to list.
   * @returns Promise resolving to array of user tokens.
   */
  public async listUserTokens(user_id: string): Promise<IAuthTokensRow[]> {
    const result = await this.getTokenRepository().findTokensByUserId(user_id);

    return result;
  }

  /**
   * Clean up expired tokens from the database.
   * @returns Promise resolving to the number of tokens cleaned up.
   */
  public async cleanupExpiredTokens(): Promise<number> {
    const count = await this.getTokenRepository().countExpiredTokens();

    if (count > ZERO) {
      await this.getTokenRepository().deleteExpiredTokens();

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
   * Get token repository instance.
   * @returns Token repository instance.
   * @throws Error if repository not initialized.
   */
  private getTokenRepository(): TokenRepository {
    if (!this.tokenRepository) {
      throw new Error('TokenService not properly initialized with database');
    }
    return this.tokenRepository;
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
    const invalidFormatResult = {
      valid: false,
      reason: 'Invalid token format',
    } as const;

    const parts = tokenString.split('.');
    if (parts.length !== TWO) {
      return invalidFormatResult;
    }

    const [tokenId, tokenValue] = parts;
    if (this.isInvalidTokenPart(tokenId) || this.isInvalidTokenPart(tokenValue)) {
      return invalidFormatResult;
    }

    const hashedToken = this.hashToken(tokenValue!);
    const tokenData = await this.getTokenRepository().findTokenByIdAndHash(tokenId!, hashedToken);

    const validationError = this.getTokenValidationError(tokenData);
    if (validationError !== null) {
      return validationError;
    }

    await this.getTokenRepository().updateTokenUsage(tokenId!);
    const scopes = await this.getTokenRepository().getTokenScopes(tokenData!.id);

    return {
      valid: true,
      userId: tokenData!.user_id,
      scopes,
    };
  }

  /**
   * Check if token part is invalid.
   * @param part - Token part to validate.
   * @returns True if invalid.
   */
  private isInvalidTokenPart(part: string | undefined): boolean {
    return part === undefined || part === '';
  }

  /**
   * Get token validation error if any.
   * @param tokenData - Token data from database.
   * @returns Validation error or null if valid.
   */
  private getTokenValidationError(tokenData: IAuthTokensRow | null): TokenValidationResult | null {
    if (tokenData === null) {
      return {
      valid: false,
      reason: 'Token not found',
    };
    }

    if (tokenData.is_revoked !== 0) {
      return {
      valid: false,
      reason: 'Token revoked',
    };
    }

    if (tokenData.expires_at !== null && new Date(tokenData.expires_at) < new Date()) {
      return {
      valid: false,
      reason: 'Token expired',
    };
    }

    return null;
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
        algorithms: [config.jwt.algorithm as jwt.Algorithm],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      });

      const payload = this.parseJwtPayload(decoded);
      if (payload === null) {
        return {
          valid: false,
          reason: 'Invalid JWT payload',
        };
      }

      return {
        valid: true,
        userId: payload.sub,
        scopes: payload.scope,
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
   * Parse JWT payload safely.
   * @param payload - Raw JWT payload.
   * @returns Parsed payload or null if invalid.
   */
  private parseJwtPayload(payload: unknown): JwtPayload | null {
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const obj = payload as Record<string, unknown>;
    return this.extractJwtFields(obj);
  }

  /**
   * Extract JWT fields from object.
   * @param obj - Object to extract from.
   * @returns JWT payload or null.
   */
  private extractJwtFields(obj: Record<string, unknown>): JwtPayload | null {
    if (!this.hasValidJwtFields(obj)) {
      return null;
    }

    const result: JwtPayload = {
      sub: String(obj.sub),
      email: String(obj.email),
      name: String(obj.name),
      roles: this.filterStringArray(Array.isArray(obj.roles) ? obj.roles : []),
      scope: this.filterStringArray(Array.isArray(obj.scope) ? obj.scope : []),
      iat: typeof obj.iat === 'number' ? obj.iat : 0,
      exp: typeof obj.exp === 'number' ? obj.exp : 0,
    };

    if (typeof obj.jti === 'string') {
      result.jti = obj.jti;
    }

    return result;
  }

  /**
   * Check if object has valid JWT fields.
   * @param obj - Object to check.
   * @returns True if valid.
   */
  private hasValidJwtFields(obj: Record<string, unknown>): boolean {
    return typeof obj.sub === 'string'
           && typeof obj.email === 'string'
           && typeof obj.name === 'string'
           && Array.isArray(obj.roles)
           && Array.isArray(obj.scope);
  }

  /**
   * Filter array to only string values.
   * @param arr - Array to filter.
   * @returns Filtered string array.
   */
  private filterStringArray(arr: unknown[]): string[] {
    return arr.filter((item): item is string => { return typeof item === 'string' });
  }

  /**
   * Parse token type from string.
   * @param type - Token type string.
   * @returns Parsed token type.
   */
  private parseTokenType(type: string): TokenType {
    switch (type) {
      case 'access':
      case 'refresh':
      case 'api':
      case 'personal':
      case 'service':
        return type;
      default:
        return 'api';
    }
  }

  /**
   * Parse last used at timestamp.
   * @param lastUsedAt - Last used timestamp string.
   * @returns Parsed date or null.
   */
  private parseLastUsedAt(lastUsedAt: string | null): Date | null {
    return lastUsedAt === null ? null : new Date(lastUsedAt);
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
   * Create access and refresh token pair.
   * @param userId - User ID.
   * @param user_id
   * @param sessionId - Session ID.
   * @returns Promise resolving to token pair.
   */
  async createTokenPair(
    user_id: string,
    sessionId?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessTokenResult = await this.createToken({
      user_id,
      name: 'access_token',
      type: 'access',
      scopes: ['read', 'write'],
    });

    const refreshTokenResult = await this.createToken({
      user_id,
      name: 'refresh_token',
      type: 'refresh',
      scopes: ['refresh'],
      expiresIn: this.getConfig().jwt.refreshTokenTTL
    });

    return {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token
    };
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
