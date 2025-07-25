import {
  existsSync, mkdirSync, readFileSync
} from 'fs';
import {
  dirname, join, resolve
} from 'path';
import { fileURLToPath } from 'url';
import { type IModule, ModuleStatus } from '@/modules/core/modules/types/index';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { ProviderRegistry } from '@/modules/core/auth/providers/registry';
import { TunnelService } from '@/modules/core/auth/services/tunnel-service';
import { TokenService } from '@/modules/core/auth/services/token.service';
import { AuthService } from '@/modules/core/auth/services/auth.service';
import { UserService } from '@/modules/core/auth/services/user-service';
import { MFAService } from '@/modules/core/auth/services/mfa.service';
import { AuditService } from '@/modules/core/auth/services/audit.service';
import { OAuth2ConfigurationService } from '@/modules/core/auth/services/oauth2-config.service';
import { ConfigurationError } from '@/modules/core/auth/utils/errors';
import { generateJwtKeyPair } from '@/modules/core/auth/utils/generate-key';
import {
  FIVE, TEN
} from '@/const/numbers';
import type {
  AuthConfig,
  AuthModuleExports,
  AuthToken,
  IdentityProvider,
  LoginInput,
  LoginResult,
  TokenCreateInput,
  TokenValidationResult
} from '@/modules/core/auth/types/index';
import { AuthCodeService } from './services/auth-code.service';

const filename = fileURLToPath(import.meta.url);
const currentDirname = dirname(filename);

/**
 * AuthModule provides authentication, authorization, and JWT token management.
 * Handles user authentication through multiple identity providers, token lifecycle management,
 * and secure session handling with support for OAuth2, MFA, and audit logging.
 */
export class AuthModule implements IModule {
  public readonly name = 'auth';
  public readonly version = '2.0.0';
  public readonly type = 'service' as const;
  public readonly description = 'Authentication, authorization, and JWT management';
  public readonly dependencies = ['logger', 'database'];
  public status = ModuleStatus.STOPPED;
  private config!: AuthConfig;
  private providerRegistry: ProviderRegistry | null = null;
  private tunnelService: TunnelService | null = null;
  private tokenService!: TokenService;
  private authService!: AuthService;
  private userService!: UserService;
  private authCodeService!: AuthCodeService;
  private mfaService!: MFAService;
  private auditService!: AuditService;
  private oauth2ConfigService!: OAuth2ConfigurationService;
  private logger!: ILogger;
  private database!: DatabaseService;
  private initialized = false;
  private started = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  get exports(): AuthModuleExports {
    return {
      service: (): AuthService => { return this.authService },
      tokenService: (): TokenService => { return this.tokenService },
      userService: (): UserService => { return this.userService },
      authCodeService: (): AuthCodeService => { return this.authCodeService },
      mfaService: (): MFAService => { return this.mfaService },
      auditService: (): AuditService => { return this.auditService },
      getProvider: (id: string): IdentityProvider | undefined => { return this.getProvider(id) },
      getAllProviders: (): IdentityProvider[] => { return this.getAllProviders() },
      createToken: async (input: TokenCreateInput): Promise<AuthToken> => {
        return await this.createToken(input);
      },
      validateToken: async (token: string): Promise<TokenValidationResult> => {
        return await this.validateToken(token);
      },
      hasProvider: (id: string): boolean => { return this.hasProvider(id) },
      getProviderRegistry: (): ProviderRegistry | null => { return this.getProviderRegistry() },
      reloadProviders: async (): Promise<void> => { await this.reloadProviders(); },
      oauth2ConfigService: (): OAuth2ConfigurationService => { return this.oauth2ConfigService },
    };
  }

  /**
   * Initialize the auth module.
   */
  async initialize(): Promise<void> {
    this.database = DatabaseService.getInstance();
    this.logger = LoggerService.getInstance();
    if (this.initialized) {
      throw new ConfigurationError('Auth module already initialized');
    }

    try {
      this.logger = LoggerService.getInstance();

      this.database = DatabaseService.getInstance();

      this.config = this.buildConfig();

      const keyStorePath = this.config.jwt.keyStorePath !== ''
        ? this.config.jwt.keyStorePath
        : './state/auth/keys';
      const absolutePath = resolve(process.cwd(), keyStorePath);

      if (!existsSync(absolutePath)) {
        mkdirSync(absolutePath, { recursive: true });
        this.logger.info(LogSource.AUTH, `Created key store directory: ${absolutePath}`);
      }

      const privateKeyPath = join(absolutePath, 'private.key');
      const publicKeyPath = join(absolutePath, 'public.key');

      if (!existsSync(privateKeyPath) || !existsSync(publicKeyPath)) {
        this.logger.info(LogSource.AUTH, 'JWT keys not found, generating new keys...');

        await generateJwtKeyPair({
          type: 'jwt',
          algorithm: 'RS256',
          outputDir: absolutePath,
          format: 'pem'
        });

        this.logger.info(LogSource.AUTH, 'JWT keys generated successfully');
      }

      this.tokenService = TokenService.getInstance();
      this.userService = UserService.getInstance();
      this.authCodeService = AuthCodeService.getInstance();
      this.mfaService = MFAService.getInstance();
      this.auditService = AuditService.getInstance();
      this.oauth2ConfigService = OAuth2ConfigurationService.getInstance();

      this.authService = AuthService.getInstance();

      const providersPath = join(currentDirname, 'providers');
      this.providerRegistry = new ProviderRegistry(providersPath, this.logger);
      await this.providerRegistry.initialize();

      if (process.env.NODE_ENV !== 'production') {
        const tunnelConfig = {
          port: parseInt(process.env.PORT ?? '3000', TEN),
          ...process.env.TUNNEL_DOMAIN !== undefined && process.env.TUNNEL_DOMAIN !== ''
            && { permanentDomain: process.env.TUNNEL_DOMAIN },
        };
        this.tunnelService = new TunnelService(tunnelConfig, this.logger);
      }

      this.initialized = true;
      this.logger.info(LogSource.AUTH, 'Auth module initialized', { version: this.version });
    } catch (error) {
      throw new ConfigurationError(
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
      const schemaPath = join(currentDirname, 'database', 'schema.sql');
      if (existsSync(schemaPath)) {
        const schema = readFileSync(schemaPath, 'utf8');
        const statements = schema.split(';').filter((statement) => {
          return statement.trim() !== '';
        });

        for (const statement of statements) {
          if (statement.trim() !== '') {
            try {
              await this.database.execute(statement);
            } catch (error) {
              if (error instanceof Error && !error.message.includes('duplicate column')) {
                this.logger.warn(LogSource.AUTH, 'Schema statement warning', { error: error.message });
              }
            }
          }
        }

        this.logger.info(LogSource.AUTH, 'Auth database schema updated');
      }

      if (process.env.LOG_MODE !== 'cli') {
        const intervalId = setInterval(
          () => {
            this.tokenService
              .cleanupExpiredTokens()
              .catch((err) => { this.logger.error(LogSource.AUTH, 'Token cleanup failed', {
                error: err instanceof Error ? err : new Error(String(err))
              }); });
          },
          24 * 60 * 60 * 1000
        );

        this.cleanupInterval = intervalId;
      }

      this.status = ModuleStatus.RUNNING;
      this.started = true;
      this.logger.info(LogSource.AUTH, 'Auth module started');
    } catch (error) {
      this.status = ModuleStatus.STOPPED;
      throw error;
    }
  }

  /**
   * Stop the auth module.
   */
  async stop(): Promise<void> {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.tunnelService !== null) {
      await this.tunnelService.stop();
    }
    this.status = ModuleStatus.STOPPED;
    this.started = false;
    this.logger.info(LogSource.AUTH, 'Auth module stopped');
  }

  /**
   * Health check.
   * @returns Promise resolving to health status object.
   */
  healthCheck(): { healthy: boolean; message?: string } {
    try {
      const providers = this.providerRegistry?.getAllProviders() ?? [];
      return {
        healthy: true,
        message: `Auth module healthy. ${String(providers.length)} provider(s) loaded.`,
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
   * @returns The logger instance.
   */
  getLogger(): ILogger {
    return this.logger;
  }

  /**
   * Authenticate a user with the provided credentials.
   * @param input - The login input containing credentials.
   * @returns Promise resolving to login result with tokens and user info.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    return this.authService.login(input);
  }

  /**
   * Log out a user by terminating their session.
   * @param sessionId - The session ID to terminate.
   * @returns Promise that resolves when logout is complete.
   */
  async logout(sessionId: string): Promise<void> {
    await this.authService.logout(sessionId);
  }

  /**
   * Refresh an access token using a valid refresh token.
   * @param refreshToken - The refresh token to use.
   * @returns Promise resolving to new access and refresh tokens.
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    return await this.authService.refreshAccessToken(refreshToken);
  }

  /**
   * Create a new authentication token.
   * @param input - The token creation input parameters.
   * @returns Promise resolving to the created token.
   */
  async createToken(input: TokenCreateInput): Promise<AuthToken> {
    return await this.tokenService.createToken(input);
  }

  /**
   * Validate an authentication token.
   * @param token - The token to validate.
   * @returns Promise resolving to validation result.
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    return await this.tokenService.validateToken(token);
  }

  /**
   * Revoke a specific token by its ID.
   * @param tokenId - The ID of the token to revoke.
   * @returns Promise that resolves when token is revoked.
   */
  async revokeToken(tokenId: string): Promise<void> {
    await this.tokenService.revokeToken(tokenId);
  }

  /**
   * Revoke all tokens for a specific user, optionally filtered by type.
   * @param userId - The user ID whose tokens to revoke.
   * @param type - Optional token type filter.
   * @returns Promise that resolves when tokens are revoked.
   */
  async revokeUserTokens(userId: string, type?: string): Promise<void> {
    await this.tokenService.revokeUserTokens(userId, type);
  }

  /**
   * List all active tokens for a specific user.
   * @param userId - The user ID to list tokens for.
   * @returns Promise resolving to array of user's tokens.
   */
  async listUserTokens(userId: string): Promise<AuthToken[]> {
    return await this.tokenService.listUserTokens(userId);
  }

  /**
   * Clean up expired tokens from the system.
   * @returns Promise resolving to number of tokens cleaned up.
   */
  async cleanupExpiredTokens(): Promise<number> {
    return await this.tokenService.cleanupExpiredTokens();
  }

  /**
   * Get an identity provider by its ID.
   * @param providerId - The provider ID to look up.
   * @returns The identity provider or undefined if not found.
   */
  getProvider(providerId: string): IdentityProvider | undefined {
    return this.providerRegistry?.getProvider(providerId);
  }

  /**
   * Get all registered identity providers.
   * @returns Array of all identity providers.
   */
  getAllProviders(): IdentityProvider[] {
    return this.providerRegistry?.getAllProviders() ?? [];
  }

  /**
   * Check if a provider with the given ID exists.
   * @param providerId - The provider ID to check.
   * @returns True if provider exists, false otherwise.
   */
  hasProvider(providerId: string): boolean {
    return this.providerRegistry?.hasProvider(providerId) ?? false;
  }

  /**
   * Get the provider registry instance.
   * @returns The provider registry or null if not initialized.
   */
  getProviderRegistry(): ProviderRegistry | null {
    return this.providerRegistry;
  }

  /**
   * Reload all identity providers from the filesystem.
   * @returns Promise that resolves when providers are reloaded.
   */
  async reloadProviders(): Promise<void> {
    await this.providerRegistry?.initialize();
  }

  /**
   * Get the tunnel service instance for development environments.
   * @returns The tunnel service or null if not available.
   */
  getTunnelService(): TunnelService | null {
    return this.tunnelService;
  }

  /**
   * Get the current tunnel status.
   * @returns The tunnel status object.
   */
  getTunnelStatus(): unknown {
    if (this.tunnelService === null) {
      return {
        active: false,
        type: 'none'
      };
    }
    return this.tunnelService.getStatus();
  }

  /**
   * Get the public URL from the tunnel service.
   * @returns The public URL or null if tunnel is not active.
   */
  getPublicUrl(): string | null {
    if (this.tunnelService === null) {
      return null;
    }
    return this.tunnelService.getPublicUrl();
  }

  /**
   * Build configuration with defaults.
   * @returns The complete authentication configuration.
   */
  private buildConfig(): AuthConfig {
    return {
      jwt: {
        algorithm: 'RS256',
        issuer: 'systemprompt-os',
        audience: 'systemprompt-os',
        accessTokenTtl: 900,
        refreshTokenTtl: 2592000,
        keyStorePath: process.env.JWT_KEY_PATH ?? './state/auth/keys',
        privateKey: '',
        publicKey: ''
      },
      session: {
        maxConcurrent: FIVE,
        absoluteTimeout: 86400,
        inactivityTimeout: 3600
      },
      security: {
        maxLoginAttempts: FIVE,
        lockoutDuration: 900,
        passwordMinLength: 8,
        requirePasswordChange: false,
      },
    };
  }
}

/**
 * Create a new AuthModule instance.
 * @returns A new AuthModule instance.
 */
export const createModule = (): AuthModule => {
  return new AuthModule();
};

/**
 * Create and initialize a new AuthModule instance.
 * @returns Promise resolving to an initialized AuthModule instance.
 */
export const initialize = async (): Promise<AuthModule> => {
  const authModule = new AuthModule();
  await authModule.initialize();
  return authModule;
};

export default AuthModule;
