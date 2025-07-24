import {
 existsSync, mkdirSync, readFileSync
} from 'fs';
import {
 dirname, join, resolve
} from 'path';
import { fileURLToPath } from 'url';
import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { ProviderRegistry } from '@/modules/core/auth/providers/registry.js';
import type { IdentityProvider } from '@/modules/core/auth/types/provider-interface.js';
import { TunnelService } from '@/modules/core/auth/services/tunnel-service.js';
import { TokenService } from '@/modules/core/auth/services/token.service.js';
import { AuthService } from '@/modules/core/auth/services/auth.service.js';
import { UserService } from '@/modules/core/auth/services/user-service.js';
import { AuthCodeService } from '@/modules/core/auth/services/auth-code-service.js';
import { MFAService } from '@/modules/core/auth/services/mfa.service.js';
import { AuditService } from '@/modules/core/auth/services/audit.service.js';
import { ConfigurationError } from '@/modules/core/auth/utils/errors.js';
import type {
  AuthConfig,
  AuthModuleExports,
  AuthToken,
  LoginInput,
  LoginResult,
  TokenCreateInput,
  TokenValidationResult,
} from '@/modules/core/auth/types/index.js';

const _filename = fileURLToPath(import.meta.url);
import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED } from './constants';



const _dirname = dirname(_filename);

/**

 * AuthModule class.

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
  private logger!: ILogger;
  private database!: DatabaseService;
  private initialized = false;
  private started = false;
  get exports(): AuthModuleExports {
    return {
      service: () => this.authService,,
      tokenService: () => this.tokenService,,
      userService: () => this.userService,,
      authCodeService: () => this.authCodeService,,
      mfaService: () => this.mfaService,,
      auditService: () => this.auditService,,
      getProvider: (id: string) => { return this.getProvider(id) },
      getAllProviders: () => this.getAllProviders(),,
      createToken: async (input: TokenCreateInput) => { return await this.createToken(input) },
      validateToken: async (token: string) => { return await this.validateToken(token) },
      hasProvider: (id: string) => { return this.hasProvider(id) },
      getProviderRegistry: () => this.getProviderRegistry(),,
      reloadProviders: async () => { await this.reloadProviders(); },
    };
  }

  /**
 *  * Initialize the auth module.
   */
  async initialize(): Promise<void> {
    if (this.initialized === true) {
      throw new ConfigurationError('Auth module already initialized');
    }

    try {
      this.logger = LoggerService.getInstance();

      this.database = DatabaseService.getInstance();

      this.config = this.buildConfig();

      const keyStorePath = this.config.jwt.keyStorePath ?? './state/auth/keys';
      const absolutePath = resolve(process.cwd(), keyStorePath);

      if (existsSync(absolutePath) === false) {
        mkdirSync(absolutePath, { recursive: true });
        this.logger.info(`Created key store directory: ${absolutePath}`);
      }

      const privateKeyPath = join(absolutePath, 'private.key');
      const publicKeyPath = join(absolutePath, 'public.key');

      if (existsSync(privateKeyPath) === false || existsSync(publicKeyPath) === false) {
        this.logger.info('JWT keys not found, generating new keys...');

        
        const { generateJWTKeyPair } = await import('@/modules/core/auth/cli/generatekey.js');










        await generateJWTKeyPair({
          type: 'jwt',
          algorithm: 'RS256',
          outputDir: absolutePath,
          format: 'pem'
        });

        this.logger.info('JWT keys generated successfully');
      }

      const jwtConfig = {
        ...this.config.jwt,
        privateKey: readFileSync(privateKeyPath, 'utf8'),
        publicKey: readFileSync(publicKeyPath, 'utf8'),
      };

      this.tokenService = new TokenService({ jwt: jwtConfig }, this.logger);
      this.userService = new UserService(this.database, this.logger);
      this.authCodeService = new AuthCodeService(this.database, this.logger);
      this.mfaService = new MFAService(this.database, this.logger);
      this.auditService = new AuditService(this.database, this.logger);

      this.authService = new AuthService(
        this.logger,
        this.database,
        this.tokenService,
        this.userService,
        this.authCodeService
      );

      const providersPath = join(_dirname, 'providers');
      this.providerRegistry = new ProviderRegistry(providersPath, this.logger);
      await this.providerRegistry.initialize();

      if (process.env['NODE_ENV'] !== 'production') {
        const tunnelConfig = {
          port: parseInt(process.env['PORT'] ?? '3000', TEN),
          ...process.env['TUNNEL_DOMAIN'] && { permanentDomain: process.env['TUNNEL_DOMAIN'] },
        };
        this.tunnelService = new TunnelService(tunnelConfig, this.logger);
      }

      this.initialized = true;
      this.logger.info('Auth module initialized', { version: this.version });
    } catch (error) {
      throw new ConfigurationError(
        `Failed to initialize auth module: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
 *  * Start the auth module.
   */
  async start(): Promise<void> {
    if (this.initialized === false) {
      throw new Error('Auth module not initialized');
    }

    if (this.started === true) {
      return;
    }

    try {
      const schemaPath = join(_dirname, 'database', 'schema.sql');
      if (existsSync(schemaPath)) {
        const schema = readFileSync(schemaPath, 'utf8');
        const statements = schema.split(';').filter((s) => s.trim() !== '');

        for (const statement of statements) {
          if (statement.trim() !== '') {
            try {
              await this.database.execute(statement);
            } catch (error) {
              if (error instanceof Error && error.message.includes('duplicate column') === false) {
                this.logger.warn('Schema statement warning', { error: error.message });
              }
            }
          }
        }

        this.logger.info('Auth database schema updated');
      }

      setInterval(
        () => {
          this.tokenService
            .cleanupExpiredTokens()
            .catch((err) => { this.logger.error('Token cleanup failed', err); });
        },
        24 * SECONDS_PER_MINUTE * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND
      ); // Daily

      this.status = ModuleStatus.RUNNING;
      this.started = true;
      this.logger.info('Auth module started');
    } catch (error) {
      this.status = ModuleStatus.STOPPED;
      throw error;
    }
  }

  /**
 *  * Stop the auth module.
   */
  async stop(): Promise<void> {
    if (this.tunnelService !== null) {
      await this.tunnelService.stop();
    }
    this.status = ModuleStatus.STOPPED;
    this.started = false;
    this.logger.info('Auth module stopped');
  }

  /**
 *  * Health check.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const providers = this.providerRegistry?.getAllProviders() ?? [];
      return {
        healthy: true,
        message: `Auth module healthy. ${providers.length} provider(s) loaded.`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Auth module unhealthy: ${error}`,
      };
    }
  }

  /**
 *  * Get logger instance.
   */
  getLogger(): ILogger {
    return this.logger;
  }

  async login(input: LoginInput): Promise<LoginResult> {
    return await this.authService.login(input);
  }

  async logout(sessionId: string): Promise<void> {
    await this.authService.logout(sessionId);
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    return await this.authService.refreshAccessToken(refreshToken);
  }

  async createToken(input: TokenCreateInput): Promise<AuthToken> {
    return await this.tokenService.createToken(input);
  }

  async validateToken(token: string): Promise<TokenValidationResult> {
    return await this.tokenService.validateToken(token);
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.tokenService.revokeToken(tokenId);
  }

  async revokeUserTokens(userId: string, type?: string): Promise<void> {
    await this.tokenService.revokeUserTokens(userId, type);
  }

  async listUserTokens(userId: string): Promise<AuthToken[]> {
    return await this.tokenService.listUserTokens(userId);
  }

  async cleanupExpiredTokens(): Promise<number> {
    return await this.tokenService.cleanupExpiredTokens();
  }

  getProvider(providerId: string): IdentityProvider | undefined {
    return this.providerRegistry?.getProvider(providerId);
  }

  getAllProviders(): IdentityProvider[] {
    return this.providerRegistry?.getAllProviders() ?? [];
  }

  hasProvider(providerId: string): boolean {
    return this.providerRegistry?.hasProvider(providerId) ?? false;
  }

  getProviderRegistry(): ProviderRegistry | null {
    return this.providerRegistry;
  }

  async reloadProviders(): Promise<void> {
    await this.providerRegistry?.initialize();
  }

  getTunnelService(): TunnelService | null {
    return this.tunnelService;
  }

  getTunnelStatus(): unknown {
    if (this.tunnelService === null) {
      return {
        active: false,
        type: 'none'
      };
    }
    return this.tunnelService.getStatus();
  }

  getPublicUrl(): string | null {
    if (this.tunnelService === null) {
      return null;
    }
    return this.tunnelService.getPublicUrl();
  }

  /**
 *  * Build configuration with defaults.
   */
  private buildConfig(): AuthConfig {
    return {
      jwt: {
        algorithm: 'RS256',
        issuer: 'systemprompt-os',
        audience: 'systemprompt-os',
        accessTokenTTL: 900, // 15 minutes
        refreshTokenTTL: 2592000, // THIRTY days
        keyStorePath: process.env['JWT_KEY_PATH'] ?? './state/auth/keys',
        privateKey: '', // Loaded at runtime
        publicKey: '', // Loaded at runtime
      },
      session: {
        maxConcurrent: FIVE,
        absoluteTimeout: SECONDS_PER_DAY, // 24 hours
        inactivityTimeout: SECONDS_PER_HOUR, // ONE hour
      },
      security: {
        maxLoginAttempts: FIVE,
        lockoutDuration: 900, // 15 minutes
        passwordMinLength: 8,
        requirePasswordChange: false,
      },
    };
  }
}

export const createModule = (): AuthModule => {
  return new AuthModule();
};

export const initialize = async (): Promise<AuthModule> => {
  const authModule = new AuthModule();
  await authModule.initialize();
  return authModule;
};

export default AuthModule;
