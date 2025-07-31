/**
 * Auth Module - Authentication and authorization system.
 * Clean singleton implementation following module standards.
 * @module auth
 */

import { ModulesStatus, ModulesType } from '@/modules/core/modules/types/database.generated';
import type { IModule } from '@/modules/core/modules/types';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { ProvidersService } from '@/modules/core/auth/services/providers.service';
import { TokenService } from '@/modules/core/auth/services/token.service';
import { SessionService } from '@/modules/core/auth/services/session.service';
import { AuthService } from '@/modules/core/auth/services/auth.service';
import { AuthCodeService } from '@/modules/core/auth/services/auth-code.service';
import { OAuth2ConfigurationService } from '@/modules/core/auth/services/oauth2-config.service';
import { JwtKeyService } from '@/modules/core/auth/services/jwt-key.service';
import type { IAuthModuleExports } from '@/modules/core/auth/types/index';
import { getModuleRegistry } from '@/modules/loader';
import { ModuleName } from '@/modules/types/module-names.types';

/**
 * AuthModule provides authentication and authorization.
 * Clean singleton implementation focused on service exposure.
 */
export class AuthModule implements IModule<IAuthModuleExports> {
  public readonly name = 'auth';
  public readonly version = '2.0.0';
  public readonly type = ModulesType.CORE;
  public readonly description = 'Authentication and authorization system';
  public readonly dependencies = ['logger', 'database', 'events'];
  public status: ModulesStatus = ModulesStatus.PENDING;
  private providersService!: ProvidersService;
  private tokenService!: TokenService;
  private sessionService!: SessionService;
  private authService!: AuthService;
  private authCodeService!: AuthCodeService;
  private oauth2ConfigService!: OAuth2ConfigurationService;
  private jwtKeyService!: JwtKeyService;
  private logger!: ILogger;
  private database!: DatabaseService;
  private initialized = false;
  private started = false;
  get exports(): IAuthModuleExports {
    return {
      authService: () => { return this.authService },
      sessionService: () => { return this.sessionService },
      tokenService: () => { return this.tokenService },
      providersService: () => { return this.providersService },
      oauth2ConfigService: () => { return this.oauth2ConfigService },
      authCodeService: () => { return this.authCodeService }
    };
  }

  /**
   * Initialize the auth module.
   */
  async initialize(): Promise<void> {
    this.database = DatabaseService.getInstance();
    this.logger = LoggerService.getInstance();
    if (this.initialized) {
      throw new Error('Auth module already initialized');
    }

    try {
      this.logger = LoggerService.getInstance();
      this.database = DatabaseService.getInstance();

      this.initializeServices();
      await this.initializeProviders();

      this.initialized = true;
      this.logger.info(LogSource.AUTH, 'Auth module initialized', { version: this.version });
    } catch (error) {
      throw new Error(
        `Failed to initialize auth module: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Start the auth module.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Auth module not initialized');
    }

    if (this.started) {
      return;
    }

    try {
      this.status = ModulesStatus.RUNNING;
      this.started = true;
      this.logger.info(LogSource.AUTH, 'Auth module started');
    } catch (error) {
      this.status = ModulesStatus.STOPPED;
      throw error;
    }
  }

  /**
   * Stop the auth module.
   */
  async stop(): Promise<void> {
    this.status = ModulesStatus.STOPPED;
    this.started = false;
    this.logger.info(LogSource.AUTH, 'Auth module stopped');
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const providers = this.providersService.getAllProviderInstances();
      return {
        healthy: true,
        message: `Auth module healthy. ${providers.length} provider(s) loaded.`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Auth module unhealthy: ${String(error)}`,
      };
    }
  }

  /**
   * Get logger instance.
   */
  getLogger(): ILogger {
    return this.logger;
  }

  /**
   * Initialize core auth services.
   */
  private initializeServices(): void {
    this.jwtKeyService = JwtKeyService.getInstance();
    this.jwtKeyService.initialize(this.logger);

    this.tokenService = TokenService.initialize(this.database, this.logger);
    this.sessionService = SessionService.initialize(this.database, this.logger);
    this.authCodeService = AuthCodeService.initialize(this.database, this.logger);
    this.oauth2ConfigService = OAuth2ConfigurationService.getInstance();
    this.authService = AuthService.initialize(this.database, this.logger);
    this.providersService = ProvidersService.getInstance();
  }

  /**
   * Initialize auth providers.
   */
  private async initializeProviders(): Promise<void> {
    await this.providersService.initialize();
  }
}

/**
 * Create a new AuthModule instance.
 */
export const createModule = (): AuthModule => {
  return new AuthModule();
};

/**
 * Create and initialize a new AuthModule instance.
 */
export const initialize = async (): Promise<AuthModule> => {
  const authModule = new AuthModule();
  await authModule.initialize();
  return authModule;
};

/**
 * Gets the Auth module with type safety and validation.
 * @returns The Auth module with guaranteed typed exports.
 * @throws {Error} If Auth module is not available or missing required exports.
 */
export const getAuthModule = (): IModule<IAuthModuleExports> => {
  const registry = getModuleRegistry();
  const authModule = registry.get(ModuleName.AUTH) as IModule<IAuthModuleExports>;

  if (!authModule) {
    throw new Error('Auth module not found in registry');
  }

  if (!authModule.exports) {
    throw new Error('Auth module not properly initialized');
  }

  return authModule;
};

export default AuthModule;
