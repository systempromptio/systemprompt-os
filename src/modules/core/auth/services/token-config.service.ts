/**
 * Token configuration service for managing auth configuration.
 * @file Token configuration service implementation.
 * @module auth/services/token-config
 */

import type { IAuthConfig } from '@/modules/core/auth/types/manual';
import { JwtKeyService } from '@/modules/core/auth/services/jwt-key.service';
import { SIXTY } from '@/constants/numbers';

/**
 * Token configuration service for managing authentication configuration.
 */
export class TokenConfigService {
  private static instance: TokenConfigService | undefined;
  private config: IAuthConfig | undefined;
  private readonly jwtKeyService: JwtKeyService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.jwtKeyService = JwtKeyService.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns Token configuration service instance.
   */
  public static getInstance(): TokenConfigService {
    TokenConfigService.instance ||= new TokenConfigService();
    return TokenConfigService.instance;
  }

  /**
   * Get token service configuration with defaults.
   * @returns Token service configuration.
   */
  public getConfig(): IAuthConfig {
    this.config ||= this.createDefaultConfig();
    return this.config;
  }

  /**
   * Set custom configuration.
   * @param config - Custom configuration to use.
   */
  public setConfig(config: IAuthConfig): void {
    this.config = config;
  }

  /**
   * Get default TTL for token type.
   * @param type - Token type.
   * @returns TTL in seconds.
   */
  public getDefaultTtl(type: string): number {
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
        return 0;
      default:
        return 24 * SIXTY * SIXTY;
    }
  }

  /**
   * Create default configuration.
   * @returns Default auth configuration.
   */
  private createDefaultConfig(): IAuthConfig {
    return {
      jwt: {
        accessTokenTTL: 900,
        refreshTokenTTL: 2592000,
        algorithm: 'RS256',
        issuer: 'systemprompt-os',
        audience: 'systemprompt-os',
        keyStorePath: './state/auth/keys',
        privateKey: this.jwtKeyService.getPrivateKey(),
        publicKey: this.jwtKeyService.getPublicKey(),
      },
      session: {
        maxConcurrent: 5,
        absoluteTimeout: 86400,
        inactivityTimeout: 3600,
      },
      security: {
        maxLoginAttempts: 3,
        lockoutDuration: 900,
        passwordMinLength: 8,
        requirePasswordChange: false,
      },
      api: {
        tokenTTL: 3600,
      },
    };
  }
}
