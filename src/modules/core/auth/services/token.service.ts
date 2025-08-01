/**
 * Token management service.
 * @file Token service implementation.
 * @module auth/services/token
 */

import { createHash, randomBytes } from 'crypto';
import type {
  IAuthTokensRow,
  IJwtCreateParams,
  TokenCreateInput,
  TokenValidationResult
} from '@/modules/core/auth/types/manual';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource, getLoggerService } from '@/modules/core/logger/index';
import { TokenRepository } from '@/modules/core/auth/repositories/token.repository';
import { TokenConfigService } from '@/modules/core/auth/services/token-config.service';
import { JwtUtilService } from '@/modules/core/auth/services/jwt-util.service';
import {
 MILLISECONDS_PER_SECOND, ZERO
} from '@/constants/numbers';

/**
 * Token management service.
 * Handles creation, validation, and management of authentication tokens.
 */
export class TokenService {
  private static instance: TokenService | undefined;
  private logger: ILogger | undefined;
  private tokenRepository: TokenRepository | undefined;
  private readonly configService: TokenConfigService;
  private readonly jwtUtilService: JwtUtilService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.configService = TokenConfigService.getInstance();
    this.jwtUtilService = JwtUtilService.getInstance();
  }

  /**
   * Initialize TokenService with database and logger.
   * @param database - Database service instance.
   * @param logger - Logger instance.
   * @returns TokenService instance.
   */
  public static initialize(
    database: import('@/modules/core/database/services/database.service').DatabaseService,
    logger: ILogger
  ): TokenService {
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
    TokenService.instance ||= new TokenService();
    return TokenService.instance;
  }

  /**
   * Create a new authentication token.
   * @param input - Token creation parameters.
   * @returns Promise resolving to the created token.
   */
  public async createToken(
    input: TokenCreateInput
  ): Promise<{ token: string; row: IAuthTokensRow }> {
    const id = this.generateTokenId();
    const tokenValue = this.generateTokenValue();
    const hashedToken = this.hashToken(tokenValue);

    const ttl = input.expires_in ?? this.configService.getDefaultTtl(input.type);
    const expiresAt = new Date(Date.now() + ttl * MILLISECONDS_PER_SECOND);

    await this.getTokenRepository().insertToken(
      id,
      input.user_id,
      hashedToken,
      input.type,
      input.name || `${input.type} token`,
      input.scopes,
      expiresAt.toISOString()
    );

    const tokenRow: IAuthTokensRow = {
      id,
      user_id: input.user_id,
      name: input.name || `${input.type} token`,
      token_hash: hashedToken,
      type: input.type,
      expires_at: expiresAt.toISOString(),
      last_used_at: null,
      is_revoked: ZERO,
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
   * @returns JWT token string.
   */
  public createJwt(params: IJwtCreateParams): string {
    const config = this.configService.getConfig();
    return this.jwtUtilService.createJwt(params, config.jwt.accessTokenTTL);
  }

  /**
   * Validate an authentication token.
   * @param tokenString - Token string to validate.
   * @returns Promise resolving to validation result.
   */
  public async validateToken(tokenString: string): Promise<TokenValidationResult> {
    if (this.jwtUtilService.isJwtFormat(tokenString)) {
      return this.jwtUtilService.validateJwt(tokenString);
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
   * @param userId - ID of the user whose tokens to revoke.
   * @param type - Optional token type filter.
   * @returns Promise that resolves when tokens are revoked.
   */
  public async revokeUserTokens(userId: string, type?: string): Promise<void> {
    await this.getTokenRepository().revokeUserTokens(userId, type);
    this.getLogger().info(LogSource.AUTH, 'User tokens revoked', {
      user_id: userId,
      type,
    });
  }

  /**
   * List all active tokens for a user.
   * @param userId - ID of the user whose tokens to list.
   * @returns Promise resolving to array of user tokens.
   */
  public async listUserTokens(userId: string): Promise<IAuthTokensRow[]> {
    return await this.getTokenRepository().findTokensByUserId(userId);
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
   * Create token pair (access + refresh).
   * @param params - JWT creation parameters.
   * @returns Promise resolving to token pair.
   */
  public async createTokenPair(params: IJwtCreateParams): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const config = this.configService.getConfig();
    const accessToken = this.jwtUtilService.createJwt(
      params,
      config.jwt.accessTokenTTL
    );
    const refreshToken = this.jwtUtilService.createJwt(
      {
 ...params,
scope: ['refresh']
},
      config.jwt.refreshTokenTTL
    );

    return {
 accessToken,
refreshToken
};
  }

  /**
   * Validate regular (non-JWT) token.
   * @param tokenString - Token string to validate.
   * @returns Promise resolving to validation result.
   */
  private async validateRegularToken(tokenString: string): Promise<TokenValidationResult> {
    if (!tokenString.includes('.')) {
      return {
 valid: false,
error: 'Invalid token format'
};
    }

    const [tokenId, tokenValue] = tokenString.split('.');
    if (!tokenId || !tokenValue) {
      return {
 valid: false,
error: 'Invalid token format'
};
    }

    const hashedValue = this.hashToken(tokenValue);
    const tokenRecord = await this.getTokenRepository().findTokenByIdAndHash(
      tokenId,
      hashedValue
    );

    if (!tokenRecord) {
      return {
 valid: false,
error: 'Token not found'
};
    }

    if (tokenRecord.is_revoked) {
      return {
 valid: false,
error: 'Token revoked'
};
    }

    const now = new Date();
    const expiresAt = new Date(tokenRecord.expires_at as string);
    if (now > expiresAt) {
      return {
 valid: false,
error: 'Token expired'
};
    }

    await this.getTokenRepository().updateTokenUsage(tokenId);

    return {
      valid: true,
      token: tokenRecord,
      userId: tokenRecord.user_id,
    };
  }

  /**
   * Generate unique token ID.
   * @returns Unique token ID string.
   */
  private generateTokenId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate secure token value.
   * @returns Secure token value string.
   */
  private generateTokenValue(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Hash token value for secure storage.
   * @param tokenValue - Token value to hash.
   * @returns Hashed token value.
   */
  private hashToken(tokenValue: string): string {
    return createHash('sha256').update(tokenValue)
.digest('hex');
  }

  /**
   * Get logger instance.
   * @returns Logger instance.
   */
  private getLogger(): ILogger {
    this.logger ||= getLoggerService();
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
}
