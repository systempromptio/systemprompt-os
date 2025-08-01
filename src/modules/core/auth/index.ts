/**
 * Auth module - Auto-generated type-safe implementation.
 * @file Auth module entry point with full Zod validation.
 * @module modules/core/auth
 */

import { BaseModule } from '../modules/base/BaseModule';
import { ModulesType } from '../modules/types/manual';
import { AuthService } from './services/auth.service';
import { ProvidersService } from './services/providers.service';
import { AuthCodeService } from './services/auth-code.service';
import { OAuthService } from './services/oauth.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { OAuth2ConfigurationService } from './services/oauth2-config.service';
import {
  AuthModuleExportsSchema,
  AuthServiceSchema,
  type IAuthModuleExports
} from './types/auth.service.generated';
import type { ZodSchema } from 'zod';

/**
 * Auth module implementation using BaseModule.
 * Provides authentication services with full Zod validation.
 */
export class AuthModule extends BaseModule<IAuthModuleExports> {
  public readonly name = 'auth' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'Authentication and authorization system';
  public readonly dependencies = ['logger', 'database', 'events'] as const;
  private authService!: AuthService;
  private providersService!: ProvidersService;
  private authCodeService!: AuthCodeService;
  private oauthService!: OAuthService;
  private sessionService!: SessionService;
  private tokenService!: TokenService;
  private oauth2ConfigService!: OAuth2ConfigurationService;
  
  get exports(): IAuthModuleExports & {
    // DEPRECATED: These exports violate module rules and should be removed
    // All functionality should be accessed through the main service() method
    providersService: () => ProvidersService;
    authCodeService: () => AuthCodeService;
    authService: () => AuthService;
    oauthService: () => OAuthService;
    oauth2ConfigService: () => OAuth2ConfigurationService;
    sessionService: () => SessionService;
    tokenService: () => TokenService;
  } {
    return {
      service: (): AuthService => {
        this.ensureInitialized();
        return this.validateServiceStructure(
          this.authService,
          AuthServiceSchema,
          'AuthService'
        );
      },
      // DEPRECATED: Direct service access - violates module architecture
      providersService: (): ProvidersService => {
        this.ensureInitialized();
        return this.providersService;
      },
      authCodeService: (): AuthCodeService => {
        this.ensureInitialized();
        return this.authCodeService;
      },
      authService: (): AuthService => {
        this.ensureInitialized();
        return this.authService;
      },
      oauthService: (): OAuthService => {
        this.ensureInitialized();
        return this.oauthService;
      },
      // Additional services that server code expects
      oauth2ConfigService: () => {
        this.ensureInitialized();
        return this.oauth2ConfigService;
      },
      sessionService: () => {
        this.ensureInitialized();
        return this.sessionService;
      },
      tokenService: () => {
        this.ensureInitialized();
        return this.tokenService;
      }
    };
  }

  /**
   * Get the Zod schema for this module's exports.
   * @returns The Zod schema for validating module exports.
   */
  protected getExportsSchema(): ZodSchema {
    return AuthModuleExportsSchema;
  }

  /**
   * Initialize the module.
   */
  protected async initializeModule(): Promise<void> {
    // Initialize AuthCodeService with the required dependencies
    const { DatabaseService } = await import('@/modules/core/database/services/database.service');
    const { LoggerService } = await import('@/modules/core/logger/services/logger.service');
    
    const database = DatabaseService.getInstance();
    const logger = LoggerService.getInstance();
    
    AuthCodeService.initialize(database, logger);
    
    this.authService = AuthService.getInstance();
    this.providersService = ProvidersService.getInstance();
    this.authCodeService = AuthCodeService.getInstance();
    this.oauthService = OAuthService.getInstance();
    this.sessionService = SessionService.getInstance();
    this.tokenService = TokenService.getInstance();
    this.oauth2ConfigService = OAuth2ConfigurationService.getInstance();
    
    await this.authService.initialize();
  }
}

/**
 * Create and return a new auth module instance.
 * @returns A new auth module instance.
 */
export const createModule = (): AuthModule => {
  return new AuthModule();
};

/**
 * Export module instance.
 */
export const authModule = new AuthModule();

/**
 * Initialize the auth module.
 * @returns Promise that resolves when the module is initialized.
 */
export const initialize = async (): Promise<void> => {
  await authModule.initialize();
};

/**
 * Gets the Auth module with type safety and validation.
 * @returns The Auth module with guaranteed typed exports.
 * @throws {Error} If Auth module is not available or missing required exports.
 */
export const getAuthModule = (): AuthModule => {
  return authModule;
};
