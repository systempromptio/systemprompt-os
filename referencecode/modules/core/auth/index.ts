/**
 * @fileoverview Enhanced Auth module with MFA, tokens, and audit
 * @module modules/core/auth
 */

import { Service, Inject } from 'typedi';
import type { GlobalConfiguration } from '@/modules/core/config/types/index.js';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import { ProviderRegistry } from './providers/registry.js';
import type { IdentityProvider } from './types/provider-interface.js';
import { TunnelService } from './services/tunnel-service.js';
import { MFAService } from './services/mfa.service.js';
import { TokenService } from './services/token.service.js';
import { AuthAuditService } from './services/audit.service.js';
import { AuthService } from './services/auth.service.js';
import { ConfigurationError } from './utils/errors.js';
import type {
  AuthConfig,
  LoginInput,
  LoginResult,
  MFASetupResult,
  TokenCreateInput,
  AuthToken,
  AuthAuditEntry,
  TokenValidationResult,
} from './types/index.js';

// Get the directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

@Service()
export class AuthModule implements IModule {
  name = 'auth';
  version = '2.0.0';
  type = 'service' as const;
  status = ModuleStatus.STOPPED;

  private config!: AuthConfig;
  private providerRegistry: ProviderRegistry | null = null;
  private tunnelService: TunnelService | null = null;
  private mfaService!: MFAService;
  private tokenService!: TokenService;
  private auditService!: AuthAuditService;
  private authService!: AuthService;

  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject(TYPES.Config) private readonly globalConfig: GlobalConfiguration,
  ) {}

  async initialize(): Promise<void> {
    // Build config with defaults
    this.config = this.buildConfig(this.globalConfig?.modules?.['auth']);

    // Ensure key store directory exists
    const keyStorePath = this.config.jwt.keyStorePath || './state/auth/keys';
    const absolutePath = resolve(process.cwd(), keyStorePath);

    if (!existsSync(absolutePath)) {
      mkdirSync(absolutePath, { recursive: true });
      this.logger.info(`Created key store directory: ${absolutePath}`);
    }

    // Load JWT keys
    const privateKeyPath = join(absolutePath, 'private.pem');
    const publicKeyPath = join(absolutePath, 'public.pem');

    if (!existsSync(privateKeyPath) || !existsSync(publicKeyPath)) {
      throw new ConfigurationError('JWT keys not found. Run "auth generatekey" to create them.');
    }

    const jwtConfig = {
      ...this.config.jwt,
      privateKey: readFileSync(privateKeyPath, 'utf8'),
      publicKey: readFileSync(publicKeyPath, 'utf8'),
    };

    // Initialize services
    this.mfaService = new MFAService(this.config.mfa, this.logger);
    this.tokenService = new TokenService({ jwt: jwtConfig }, this.logger);
    this.auditService = new AuthAuditService(this.config.audit, this.logger);
    this.authService = new AuthService(
      this.mfaService,
      this.tokenService,
      this.auditService,
      {
        session: this.config.session,
        security: this.config.security,
      },
      this.logger,
    );

    // Initialize provider registry
    const providersPath = join(__dirname, 'providers');
    this.providerRegistry = new ProviderRegistry(providersPath, this.logger);
    await this.providerRegistry.initialize();

    // Initialize tunnel service for local development
    if (process.env['NODE_ENV'] !== 'production') {
      const tunnelConfig = {
        port: parseInt(process.env['PORT'] || '3000', 10),
        ...(process.env['TUNNEL_DOMAIN'] && { permanentDomain: process.env['TUNNEL_DOMAIN'] }),
      };
      this.tunnelService = new TunnelService(tunnelConfig, this.logger);
    }

    this.logger.info('Auth module initialized', { version: this.version });
  }

  async start(): Promise<void> {
    // Run database migrations for enhanced schema
    try {
      const { DatabaseService } = await import(
        '@/modules/core/database/services/database.service.js'
      );
      const db = DatabaseService.getInstance();

      // Read and execute enhancement schema
      const schemaPath = join(__dirname, 'database', 'schema-enhancements.sql');
      if (existsSync(schemaPath)) {
        const schema = readFileSync(schemaPath, 'utf8');
        const statements = schema.split(';').filter((s) => s.trim());

        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await db.execute(statement);
            } catch (error) {
              // Ignore errors for "column already exists" etc.
              if (error instanceof Error && !error.message.includes('duplicate column')) {
                this.logger.warn('Schema statement warning', { error: error.message });
              }
            }
          }
        }

        this.logger.info('Auth database schema updated');
      }
    } catch (error) {
      this.logger.error('Failed to update auth schema', error);
    }

    // Start cleanup intervals
    setInterval(
      () => {
        this.tokenService
          .cleanupExpiredTokens()
          .catch((err) => this.logger.error('Token cleanup failed', err));
      },
      24 * 60 * 60 * 1000,
    ); // Daily

    setInterval(
      () => {
        this.auditService
          .cleanupOldEntries()
          .catch((err) => this.logger.error('Audit cleanup failed', err));
      },
      24 * 60 * 60 * 1000,
    ); // Daily

    this.logger.info('Auth module started');
  }

  async stop(): Promise<void> {
    if (this.tunnelService) {
      await this.tunnelService.stop();
    }
    this.logger.info('Auth module stopped');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const providers = this.providerRegistry?.getAllProviders() || [];
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

  // Auth service methods

  async login(input: LoginInput): Promise<LoginResult> {
    return this.authService.login(input);
  }

  async completeMFALogin(sessionId: string, code: string): Promise<LoginResult> {
    return this.authService.completeMFALogin(sessionId, code);
  }

  async logout(sessionId: string): Promise<void> {
    return this.authService.logout(sessionId);
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    return this.authService.refreshAccessToken(refreshToken);
  }

  // MFA methods

  async setupMFA(userId: string): Promise<MFASetupResult> {
    // Get user email
    const { DatabaseService } = await import('../database/services/database.service.js');
    const db = DatabaseService.getInstance();
    const result = await db.query<{ email: string }>('SELECT email FROM auth_users WHERE id = ?', [
      userId,
    ]);
    const email = result[0]?.email || userId;

    return this.mfaService.setupMFA(userId, email);
  }

  async enableMFA(userId: string, code: string): Promise<boolean> {
    return this.mfaService.enableMFA(userId, code);
  }

  async disableMFA(userId: string): Promise<void> {
    return this.mfaService.disableMFA(userId);
  }

  async verifyMFA(userId: string, code: string): Promise<boolean> {
    return this.mfaService.verifyMFA({ userId, code });
  }

  async regenerateBackupCodes(userId: string): Promise<string[]> {
    return this.mfaService.regenerateBackupCodes(userId);
  }

  // Token methods

  async createToken(input: TokenCreateInput): Promise<AuthToken> {
    return this.tokenService.createToken(input);
  }

  async validateToken(token: string): Promise<TokenValidationResult> {
    return this.tokenService.validateToken(token);
  }

  async revokeToken(tokenId: string): Promise<void> {
    return this.tokenService.revokeToken(tokenId);
  }

  async revokeUserTokens(userId: string, type?: string): Promise<void> {
    return this.tokenService.revokeUserTokens(userId, type);
  }

  async listUserTokens(userId: string): Promise<AuthToken[]> {
    return this.tokenService.listUserTokens(userId);
  }

  async cleanupExpiredTokens(): Promise<number> {
    return this.tokenService.cleanupExpiredTokens();
  }

  // Audit methods

  async getAuditLogs(filters?: Record<string, unknown>): Promise<AuthAuditEntry[]> {
    return this.auditService.getAuditEntries(filters);
  }

  async getFailedLoginAttempts(email: string, since: Date): Promise<number> {
    return this.auditService.getFailedLoginAttempts(email, since);
  }

  async cleanupAuditLogs(): Promise<number> {
    return this.auditService.cleanupOldEntries();
  }

  // Provider methods (existing)

  getProvider(providerId: string): IdentityProvider | undefined {
    return this.providerRegistry?.getProvider(providerId);
  }

  getAllProviders(): IdentityProvider[] {
    return this.providerRegistry?.getAllProviders() || [];
  }

  hasProvider(providerId: string): boolean {
    return this.providerRegistry?.hasProvider(providerId) || false;
  }

  getProviderRegistry(): ProviderRegistry | null {
    return this.providerRegistry;
  }

  async reloadProviders(): Promise<void> {
    await this.providerRegistry?.initialize();
  }

  // Tunnel service methods

  getTunnelService(): TunnelService | null {
    return this.tunnelService;
  }

  getTunnelStatus(): any {
    if (!this.tunnelService) {
      return { active: false, type: 'none' };
    }
    return this.tunnelService.getStatus();
  }

  getPublicUrl(): string | null {
    if (!this.tunnelService) {
      return null;
    }
    return this.tunnelService.getPublicUrl();
  }

  // CLI command

  async getCommand(): Promise<unknown> {
    const { Command } = await import('commander');
    const { command: generateKeyCommand } = await import('./cli/generatekey.js');
    const { command: providersCommand } = await import('./cli/providers.js');
    const { command: dbCommand } = await import('./cli/db.js');
    const { command: roleCommand } = await import('./cli/role.js');
    const { createMFACommand } = await import('./cli/mfa.command.js');
    const { createTokenCommand } = await import('./cli/token.command.js');
    const { createAuditCommand } = await import('./cli/audit.command.js');

    const cmd = new Command('auth').description('Authentication and authorization utilities');

    // Add existing commands using the new pattern
    const commands = [
      { name: 'generatekey', command: generateKeyCommand },
      { name: 'providers', command: providersCommand },
      { name: 'db', command: dbCommand },
      { name: 'role', command: roleCommand },
    ];

    // Register each command
    commands.forEach(({ name, command }) => {
      if (command) {
        const subCmd = new Command(name).description(command.description || `${name} command`);

        // Add options if defined
        if ('options' in command && command.options) {
          Object.entries(command.options).forEach(([key, value]: [string, any]) => {
            if (value.short) {
              subCmd.option(`-${value.short}, --${key}`, value.description);
            } else {
              subCmd.option(`--${key}`, value.description);
            }
          });
        }

        // Add arguments if defined
        if ('arguments' in command && command.arguments) {
          command.arguments.forEach((arg: any) => {
            if (arg.required) {
              subCmd.argument(`<${arg.name}>`, arg.description);
            } else {
              subCmd.argument(`[${arg.name}]`, arg.description);
            }
          });
        }

        // Set action handler
        subCmd.action(async (...args) => {
          const options = args[args.length - 1];
          const context = {
            cwd: process.cwd(),
            args: {},
            options,
            module: this,
          };

          // Map positional arguments
          if ('arguments' in command && command.arguments && Array.isArray(command.arguments)) {
            (command.arguments as any[]).forEach((arg: any, index: number) => {
              (context.args as any)[arg.name] = args[index];
            });
          }

          if ('execute' in command) {
            await command.execute(context);
          }
        });

        cmd.addCommand(subCmd);
      }
    });

    // Add function-based commands
    if (createMFACommand) {
      cmd.addCommand(createMFACommand(this));
    }
    if (createTokenCommand) {
      cmd.addCommand(createTokenCommand(this));
    }
    if (createAuditCommand) {
      cmd.addCommand(createAuditCommand(this));
    }

    return cmd;
  }

  /**
   * Build configuration with defaults
   */
  private buildConfig(contextConfig?: Record<string, unknown>): AuthConfig {
    // Helper to safely access nested config properties
    const getConfigValue = (path: string, defaultValue: unknown): unknown => {
      const keys = path.split('.');
      let value: unknown = contextConfig;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = (value as Record<string, unknown>)[key];
        } else {
          return defaultValue;
        }
      }

      return value ?? defaultValue;
    };
    return {
      jwt: {
        algorithm: String(getConfigValue('jwt.algorithm', 'RS256')),
        issuer: String(getConfigValue('jwt.issuer', 'systemprompt-os')),
        audience: String(getConfigValue('jwt.audience', 'systemprompt-os')),
        accessTokenTTL: Number(getConfigValue('jwt.accessTokenTTL', 900)), // 15 minutes
        refreshTokenTTL: Number(getConfigValue('jwt.refreshTokenTTL', 2592000)), // 30 days
        keyStorePath: String(getConfigValue('keyStorePath', './state/auth/keys')),
        privateKey: '', // Loaded at runtime
        publicKey: '', // Loaded at runtime
      },
      mfa: {
        enabled: getConfigValue('mfa.enabled', true) !== false,
        appName: String(getConfigValue('mfa.appName', 'SystemPrompt OS')),
        backupCodeCount: Number(getConfigValue('mfa.backupCodeCount', 8)),
        windowSize: Number(getConfigValue('mfa.windowSize', 1)),
      },
      session: {
        maxConcurrent: Number(getConfigValue('session.maxConcurrent', 5)),
        absoluteTimeout: Number(getConfigValue('session.absoluteTimeout', 86400)), // 24 hours
        inactivityTimeout: Number(getConfigValue('session.inactivityTimeout', 3600)), // 1 hour
      },
      security: {
        maxLoginAttempts: Number(getConfigValue('security.maxLoginAttempts', 5)),
        lockoutDuration: Number(getConfigValue('security.lockoutDuration', 900)), // 15 minutes
        passwordMinLength: Number(getConfigValue('security.passwordMinLength', 8)),
        requirePasswordChange: Boolean(getConfigValue('security.requirePasswordChange', false)),
      },
      audit: {
        enabled: getConfigValue('audit.enabled', true) !== false,
        retentionDays: Number(getConfigValue('audit.retentionDays', 90)),
      },
    };
  }
}

// Export for dynamic loading
export default AuthModule;
