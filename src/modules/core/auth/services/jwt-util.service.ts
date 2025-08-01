/**
 * JWT utility service for JWT token operations.
 * @file JWT utility service implementation.
 * @module auth/services/jwt-util
 */

import * as jwt from 'jsonwebtoken';
import type {
  IJwtCreateParams,
  JwtPayload,
  TokenValidationResult
} from '@/modules/core/auth/types/manual';
import { TokenConfigService } from '@/modules/core/auth/services/token-config.service';
import { MILLISECONDS_PER_SECOND, THREE } from '@/constants/numbers';

/**
 * JWT utility service for creating and validating JWT tokens.
 */
export class JwtUtilService {
  private static instance: JwtUtilService | undefined;
  private readonly configService: TokenConfigService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.configService = TokenConfigService.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns JWT utility service instance.
   */
  public static getInstance(): JwtUtilService {
    JwtUtilService.instance ||= new JwtUtilService();
    return JwtUtilService.instance;
  }

  /**
   * Create JWT token.
   * @param params - JWT creation parameters.
   * @param expiresIn - Token expiration time in seconds.
   * @returns JWT token string.
   */
  public createJwt(params: IJwtCreateParams, expiresIn: number): string {
    const config = this.configService.getConfig();
    const now = Date.now();
    const tokenId = this.generateTokenId();

    const payload: JwtPayload = {
      sub: params.userId,
      userId: params.userId,
      jti: tokenId,
      iat: Math.floor(now / MILLISECONDS_PER_SECOND),
      exp: Math.floor(now / MILLISECONDS_PER_SECOND) + expiresIn,
      ...params.email && { email: params.email },
      ...params.name && { name: params.name },
      ...params.roles && { roles: params.roles },
      ...params.scope && { scope: params.scope },
    };

    return jwt.sign(payload, config.jwt.privateKey, {
      algorithm: config.jwt.algorithm as jwt.Algorithm,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  }

  /**
   * Validate JWT token.
   * @param token - JWT token to validate.
   * @returns Token validation result.
   */
  public validateJwt(token: string): TokenValidationResult {
    const config = this.configService.getConfig();

    try {
      const decoded = jwt.verify(token, config.jwt.publicKey, {
        algorithms: [config.jwt.algorithm as jwt.Algorithm],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }) as JwtPayload;

      return {
        valid: true,
        payload: decoded as Record<string, unknown>,
        userId: decoded.userId,
        scopes: decoded.scope,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid token',
        reason: this.getErrorReason(error),
      };
    }
  }

  /**
   * Check if token string appears to be a JWT.
   * @param tokenString - Token string to check.
   * @returns True if token appears to be JWT format.
   */
  public isJwtFormat(tokenString: string): boolean {
    return tokenString.includes('.') && tokenString.split('.').length === THREE;
  }

  /**
   * Generate unique token ID.
   * @returns Unique token ID string.
   */
  private generateTokenId(): string {
    return Math.random().toString(36)
.substring(2, 15)
           + Math.random().toString(36)
.substring(2, 15);
  }

  /**
   * Get error reason from JWT verification error.
   * @param error - JWT verification error.
   * @returns Human-readable error reason.
   */
  private getErrorReason(error: unknown): string {
    if (error instanceof jwt.TokenExpiredError) {
      return 'Token expired';
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return 'Invalid token format';
    }
    if (error instanceof jwt.NotBeforeError) {
      return 'Token not active yet';
    }
    return 'Token validation failed';
  }
}
