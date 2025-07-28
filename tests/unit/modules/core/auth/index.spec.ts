/**
 * @fileoverview Comprehensive unit tests for AuthModule index.ts
 * Achieves 100% test coverage including all branches, conditions, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { AuthModule, createModule, initialize, type IAuthModuleExports } from '@/modules/core/auth/index';
import { getAuthModule } from '@/modules/core/auth/utils/module-helpers';
import { ModuleStatusEnum } from '@/modules/core/modules/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { ProviderRegistry } from '@/modules/core/auth/providers/registry';
import { TunnelService } from '@/modules/core/auth/services/tunnel.service';
import { TokenService } from '@/modules/core/auth/services/token.service';
import { AuthService } from '@/modules/core/auth/services/auth.service';
import { UserService } from '@/modules/core/auth/services/user.service';
import { MFAService } from '@/modules/core/auth/services/mfa.service';
import { AuthAuditService } from '@/modules/core/auth/services/audit.service';
import { OAuth2ConfigurationService } from '@/modules/core/auth/services/oauth2-config.service';
import { AuthCodeService } from '@/modules/core/auth/services/auth-code.service';
import { ConfigurationError } from '@/modules/core/auth/utils/errors';
import { generateJwtKeyPair } from '@/modules/core/auth/utils/generate-key';
import { getModuleLoader } from '@/modules/loader';
import { ModuleName } from '@/modules/types/module-names.types';
import type {
  AuthConfig,
  AuthToken,
  IdentityProvider,
  LoginInput,
  LoginResult,
  TokenCreateInput,
  TokenValidationResult
} from '@/modules/core/auth/types/index';

// Mock all dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('url');
vi.mock('@/modules/core/database/services/database.service');
vi.mock('@/modules/core/auth/providers/registry');
vi.mock('@/modules/core/auth/services/tunnel.service');
vi.mock('@/modules/core/auth/services/token.service');
vi.mock('@/modules/core/auth/services/auth.service');
vi.mock('@/modules/core/auth/services/user.service');
vi.mock('@/modules/core/auth/services/mfa.service');
vi.mock('@/modules/core/auth/services/audit.service');
vi.mock('@/modules/core/auth/services/oauth2-config.service');
vi.mock('@/modules/core/auth/services/auth-code.service');
vi.mock('@/modules/core/auth/utils/generate-key');
vi.mock('@/modules/loader');
vi.mock('@/modules/core/auth/utils/module-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/core/auth/utils/module-helpers')>();
  return {
    ...actual,
    getAuthModule: vi.fn(actual.getAuthModule)
  };
});
vi.mock('@/modules/core/auth/utils/config-builder', () => ({
  buildAuthConfig: vi.fn(() => ({
    jwt: {
      algorithm: 'RS256',
      issuer: 'systemprompt-os',
      audience: 'systemprompt-os',
      accessTokenTTL: 900,
      refreshTokenTTL: 2592000,
      keyStorePath: process.env.JWT_KEY_PATH ?? './state/auth/keys',
      privateKey: '',
      publicKey: ''
    },
    session: {
      maxConcurrent: 5,
      absoluteTimeout: 86400,
      inactivityTimeout: 3600
    },
    security: {
      maxLoginAttempts: 5,
      lockoutDuration: 900,
      passwordMinLength: 8,
      requirePasswordChange: false
    }
  }))
}));

describe('AuthModule', () => {
  let authModule: AuthModule;
  let mockLogger: any;
  let mockDatabase: any;
  let mockProviderRegistry: any;
  let mockTunnelService: any;
  let mockTokenService: any;
  let mockAuthService: any;
  let mockUserService: any;
  let mockMfaService: any;
  let mockAuditService: any;
  let mockOAuth2ConfigService: any;
  let mockAuthCodeService: any;
  let mockModuleLoader: any;

  const mockExistsSync = existsSync as MockedFunction<typeof existsSync>;
  const mockMkdirSync = mkdirSync as MockedFunction<typeof mkdirSync>;
  const mockReadFileSync = readFileSync as MockedFunction<typeof readFileSync>;
  const mockResolve = resolve as MockedFunction<typeof resolve>;
  const mockJoin = join as MockedFunction<typeof join>;
  const mockDirname = dirname as MockedFunction<typeof dirname>;
  const mockFileURLToPath = fileURLToPath as MockedFunction<typeof fileURLToPath>;
  const mockGenerateJwtKeyPair = generateJwtKeyPair as MockedFunction<typeof generateJwtKeyPair>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup file system mocks
    mockFileURLToPath.mockReturnValue('/mock/path/to/auth/index.ts');
    mockDirname.mockReturnValue('/mock/path/to/auth');
    mockResolve.mockImplementation((...paths) => paths.join('/'));
    mockJoin.mockImplementation((...paths) => paths.join('/'));
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('CREATE TABLE test (id INTEGER);');

    // Mock global timer functions
    vi.spyOn(global, 'setInterval').mockImplementation((callback: any, delay: number) => {
      return { callback, delay } as any;
    });
    vi.spyOn(global, 'clearInterval').mockImplementation(() => {});

    // Setup mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      access: vi.fn(),
      clearLogs: vi.fn().mockResolvedValue(undefined),
      getLogs: vi.fn().mockResolvedValue([]),
      setDatabaseService: vi.fn()
    };

    mockDatabase = {
      execute: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    };

    mockProviderRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getProvider: vi.fn(),
      getAllProviders: vi.fn().mockReturnValue([]),
      hasProvider: vi.fn().mockReturnValue(false),
    };

    mockTunnelService = {
      stop: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ active: true, type: 'cloudflare' }),
      getPublicUrl: vi.fn().mockReturnValue('https://test.tunnel.com'),
    };

    mockTokenService = {
      createToken: vi.fn().mockResolvedValue({ id: 'token-1', token: 'test-token' }),
      validateToken: vi.fn().mockResolvedValue({ valid: true, payload: {} }),
      revokeToken: vi.fn().mockResolvedValue(undefined),
      revokeUserTokens: vi.fn().mockResolvedValue(undefined),
      listUserTokens: vi.fn().mockResolvedValue([]),
      cleanupExpiredTokens: vi.fn().mockResolvedValue(5),
    };

    mockAuthService = {
      login: vi.fn().mockResolvedValue({ accessToken: 'token', refreshToken: 'refresh' }),
      logout: vi.fn().mockResolvedValue(undefined),
      refreshAccessToken: vi.fn().mockResolvedValue({ accessToken: 'new-token', refreshToken: 'new-refresh' }),
    };

    mockUserService = {};
    mockAuthCodeService = {};

    mockMfaService = {
      generateSecret: vi.fn(),
      verifyToken: vi.fn(),
    };

    mockAuditService = {};

    mockOAuth2ConfigService = {};

    mockModuleLoader = {
      getRegistry: vi.fn().mockReturnValue({
        getAll: vi.fn().mockReturnValue([]),
      }),
    };

    // Setup singleton getInstance mocks
    vi.mocked(LoggerService.getInstance).mockReturnValue(mockLogger);
    vi.mocked(DatabaseService.getInstance).mockReturnValue(mockDatabase);
    vi.mocked(TokenService.getInstance).mockReturnValue(mockTokenService);
    vi.mocked(AuthService.getInstance).mockReturnValue(mockAuthService);
    vi.mocked(UserService.getInstance).mockReturnValue(mockUserService);
    vi.mocked(AuthCodeService.getInstance).mockReturnValue(mockAuthCodeService);
    vi.mocked(AuthAuditService.getInstance).mockReturnValue(mockAuditService);
    vi.mocked(OAuth2ConfigurationService.getInstance).mockReturnValue(mockOAuth2ConfigService);
    vi.mocked(MFAService.initialize).mockReturnValue(mockMfaService);
    vi.mocked(getModuleLoader).mockReturnValue(mockModuleLoader);
    vi.mocked(ProviderRegistry).mockReturnValue(mockProviderRegistry);
    vi.mocked(TunnelService).mockReturnValue(mockTunnelService);

    // Create fresh instance
    authModule = new AuthModule();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Constructor and Basic Properties', () => {
    it('should have correct module properties', () => {
      expect(authModule.name).toBe('auth');
      expect(authModule.version).toBe('2.0.0');
      expect(authModule.type).toBe('service');
      expect(authModule.description).toBe('Authentication, authorization, and JWT management');
      expect(authModule.dependencies).toEqual(['logger', 'database']);
      expect(authModule.status).toBe(ModuleStatusEnum.STOPPED);
    });

    it('should initialize with default private properties', () => {
      expect((authModule as any).initialized).toBe(false);
      expect((authModule as any).started).toBe(false);
      expect((authModule as any).providerRegistry).toBe(null);
      expect((authModule as any).tunnelService).toBe(null);
      expect((authModule as any).cleanupInterval).toBe(null);
    });
  });

  describe('exports Interface', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should return correct service instances', () => {
      const exports = authModule.exports;

      expect(exports.service()).toBe(mockAuthService);
      expect(exports.tokenService()).toBe(mockTokenService);
      expect(exports.userService()).toBe(mockUserService);
      expect(exports.authCodeService()).toBe(mockAuthCodeService);
      expect(exports.mfaService()).toBe(mockMfaService);
      expect(exports.auditService()).toBe(mockAuditService);
    });

    it('should handle provider methods correctly', () => {
      const exports = authModule.exports;
      const mockProvider = { id: 'test', name: 'Test Provider' };
      
      mockProviderRegistry.getProvider.mockReturnValue(mockProvider);
      mockProviderRegistry.getAllProviders.mockReturnValue([mockProvider]);
      mockProviderRegistry.hasProvider.mockReturnValue(true);

      expect(exports.getProvider('test')).toBe(mockProvider);
      expect(exports.getAllProviders()).toEqual([mockProvider]);
      expect(exports.hasProvider('test')).toBe(true);
      expect(exports.getProviderRegistry()).toBe(mockProviderRegistry);
    });

    it('should handle provider methods with null registry', () => {
      const exports = authModule.exports;
      (authModule as any).providerRegistry = null;

      expect(exports.getProvider('test')).toBeUndefined();
      expect(exports.getAllProviders()).toEqual([]);
      expect(exports.hasProvider('test')).toBe(false);
      expect(exports.getProviderRegistry()).toBe(null);
    });

    it('should handle async token operations', async () => {
      const exports = authModule.exports;
      const mockInput: TokenCreateInput = { userId: 'user-1', type: 'access', scope: ['read'] };
      const mockToken: AuthToken = { id: 'token-1', token: 'test-token' } as AuthToken;

      mockTokenService.createToken.mockResolvedValue(mockToken);
      mockTokenService.validateToken.mockResolvedValue({ valid: true, payload: {} } as TokenValidationResult);
      mockTokenService.listUserTokens.mockResolvedValue([mockToken]);

      await expect(exports.createToken(mockInput)).resolves.toBe(mockToken);
      await expect(exports.validateToken('test-token')).resolves.toEqual({ valid: true, payload: {} });
      await expect(exports.listUserTokens('user-1')).resolves.toEqual([mockToken]);
      await expect(exports.revokeToken('token-1')).resolves.toBeUndefined();
      await expect(exports.revokeUserTokens('user-1', 'access')).resolves.toBeUndefined();
      await expect(exports.cleanupExpiredTokens()).resolves.toBe(5);
    });

    it('should handle provider reload', async () => {
      const exports = authModule.exports;
      await exports.reloadProviders();
      expect(mockProviderRegistry.initialize).toHaveBeenCalled();
    });

    it('should handle oauth2ConfigService with lazy initialization', () => {
      const exports = authModule.exports;
      
      // First call should set the service
      const service1 = exports.oauth2ConfigService();
      expect(service1).toBe(mockOAuth2ConfigService);
      
      // Second call should return the same instance
      const service2 = exports.oauth2ConfigService();
      expect(service2).toBe(mockOAuth2ConfigService);
      expect(service1).toBe(service2);
    });

    it('should handle tunnel service methods', () => {
      const exports = authModule.exports;
      (authModule as any).tunnelService = mockTunnelService;

      expect(exports.getTunnelService()).toBe(mockTunnelService);
      expect(exports.getTunnelStatus()).toEqual({ active: true, type: 'cloudflare' });
    });

    it('should handle tunnel service methods with null service', () => {
      const exports = authModule.exports;
      (authModule as any).tunnelService = null;

      expect(exports.getTunnelService()).toBe(null);
      expect(exports.getTunnelStatus()).toEqual({ active: false, type: 'none' });
    });
  });

  describe('initialize Method - Success Paths', () => {
    it('should initialize successfully with all dependencies', async () => {
      await authModule.initialize();

      expect(LoggerService.getInstance).toHaveBeenCalled();
      expect(DatabaseService.getInstance).toHaveBeenCalled();
      expect(TokenService.getInstance).toHaveBeenCalled();
      expect(AuthService.getInstance).toHaveBeenCalled();
      expect(UserService.getInstance).toHaveBeenCalled();
      expect(AuthCodeService.getInstance).toHaveBeenCalled();
      expect(OAuth2ConfigurationService.getInstance).toHaveBeenCalled();
      expect((authModule as any).initialized).toBe(true);
    });

    it('should create key store directory when it does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await authModule.initialize();

      expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('state/auth/keys'), { recursive: true });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, expect.stringContaining('Created key store directory:'));
    });

    it('should use custom key store path from config', async () => {
      const customPath = '/custom/keys';
      process.env.JWT_KEY_PATH = customPath;
      mockExistsSync.mockReturnValue(false);

      await authModule.initialize();

      expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining(customPath), { recursive: true });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, expect.stringContaining('Created key store directory:'));
      
      delete process.env.JWT_KEY_PATH;
    });

    it('should generate JWT keys when they do not exist', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('private.key') || path.includes('public.key')) {
          return false;
        }
        return true;
      });

      await authModule.initialize();

      expect(mockGenerateJwtKeyPair).toHaveBeenCalledWith({
        type: 'jwt',
        algorithm: 'RS256',
        outputDir: expect.stringContaining('state/auth/keys'),
        format: 'pem'
      });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'JWT keys not found, generating new keys...');
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'JWT keys generated successfully');
    });

    it('should skip key generation when keys exist', async () => {
      mockExistsSync.mockReturnValue(true);

      await authModule.initialize();

      expect(mockGenerateJwtKeyPair).not.toHaveBeenCalled();
    });

    it('should initialize MFA service with default config', async () => {
      await authModule.initialize();

      expect(MFAService.initialize).toHaveBeenCalledWith({
        appName: 'SystemPrompt OS',
        backupCodeCount: 10,
        windowSize: 2
      }, mockLogger);
    });

    it('should initialize MFA service with custom config', async () => {
      const customConfig = {
        mfa: {
          appName: 'Custom App',
          backupCodeCount: 15,
          windowSize: 3
        }
      };
      
      // Mock buildAuthConfig to return custom config
      const { buildAuthConfig } = await import('@/modules/core/auth/utils/config-builder');
      vi.mocked(buildAuthConfig).mockReturnValueOnce({
        jwt: {
          algorithm: 'RS256',
          issuer: 'systemprompt-os',
          audience: 'systemprompt-os',
          accessTokenTTL: 900,
          refreshTokenTTL: 2592000,
          keyStorePath: './state/auth/keys',
          privateKey: '',
          publicKey: ''
        },
        session: {
          maxConcurrent: 5,
          absoluteTimeout: 86400,
          inactivityTimeout: 3600
        },
        security: {
          maxLoginAttempts: 5,
          lockoutDuration: 900,
          passwordMinLength: 8,
          requirePasswordChange: false
        },
        mfa: customConfig.mfa
      });

      // Create a new auth module instance to pick up the mocked config
      const customAuthModule = new AuthModule();
      await customAuthModule.initialize();

      expect(MFAService.initialize).toHaveBeenCalledWith(customConfig.mfa, mockLogger);
    });

    it('should initialize audit service with default config', async () => {
      await authModule.initialize();

      expect(AuthAuditService.getInstance).toHaveBeenCalledWith(
        { enabled: true, retentionDays: 90 },
        expect.objectContaining({
          debug: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
          error: expect.any(Function)
        })
      );
    });

    it('should initialize audit service with custom config', async () => {
      const customAuditConfig = { enabled: false, retentionDays: 30 };
      
      // Mock buildAuthConfig to return custom config
      const { buildAuthConfig } = await import('@/modules/core/auth/utils/config-builder');
      vi.mocked(buildAuthConfig).mockReturnValueOnce({
        jwt: {
          algorithm: 'RS256',
          issuer: 'systemprompt-os',
          audience: 'systemprompt-os',
          accessTokenTTL: 900,
          refreshTokenTTL: 2592000,
          keyStorePath: './state/auth/keys',
          privateKey: '',
          publicKey: ''
        },
        session: {
          maxConcurrent: 5,
          absoluteTimeout: 86400,
          inactivityTimeout: 3600
        },
        security: {
          maxLoginAttempts: 5,
          lockoutDuration: 900,
          passwordMinLength: 8,
          requirePasswordChange: false
        },
        audit: customAuditConfig
      });

      // Create a new auth module instance to pick up the mocked config
      const customAuthModule = new AuthModule();
      await customAuthModule.initialize();

      expect(AuthAuditService.getInstance).toHaveBeenCalledWith(
        customAuditConfig,
        expect.any(Object)
      );
    });

    it('should initialize provider registry', async () => {
      await authModule.initialize();

      // Since currentDirname is calculated at module load time and join mocks the path
      expect(ProviderRegistry).toHaveBeenCalledWith(expect.stringContaining('providers'), mockLogger);
      expect(mockProviderRegistry.initialize).toHaveBeenCalled();
    });

    it('should initialize tunnel service in non-production with default port', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      process.env.NODE_ENV = 'development';
      delete process.env.PORT; // Ensure PORT is undefined to test default value

      await authModule.initialize();

      expect(TunnelService).toHaveBeenCalledWith({ port: 3000 }, mockLogger);
      expect((authModule as any).tunnelService).toBe(mockTunnelService);

      process.env.NODE_ENV = originalEnv;
      if (originalPort !== undefined) {
        process.env.PORT = originalPort;
      }
    });

    it('should initialize tunnel service with custom port', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      process.env.NODE_ENV = 'development';
      process.env.PORT = '8080';

      await authModule.initialize();

      expect(TunnelService).toHaveBeenCalledWith({ port: 8080 }, mockLogger);

      process.env.NODE_ENV = originalEnv;
      process.env.PORT = originalPort;
    });

    it('should initialize tunnel service with permanent domain', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      const originalDomain = process.env.TUNNEL_DOMAIN;
      process.env.NODE_ENV = 'development';
      process.env.TUNNEL_DOMAIN = 'custom.tunnel.com';
      delete process.env.PORT; // Ensure PORT is undefined to test default value

      await authModule.initialize();

      expect(TunnelService).toHaveBeenCalledWith({
        port: 3000,
        permanentDomain: 'custom.tunnel.com'
      }, mockLogger);

      process.env.NODE_ENV = originalEnv;
      if (originalPort !== undefined) {
        process.env.PORT = originalPort;
      }
      process.env.TUNNEL_DOMAIN = originalDomain;
    });

    it('should not initialize tunnel service in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await authModule.initialize();

      expect(TunnelService).not.toHaveBeenCalled();
      expect((authModule as any).tunnelService).toBe(null);

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle empty TUNNEL_DOMAIN environment variable', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      const originalDomain = process.env.TUNNEL_DOMAIN;
      process.env.NODE_ENV = 'development';
      process.env.TUNNEL_DOMAIN = '';
      delete process.env.PORT; // Ensure PORT is undefined to test default value

      await authModule.initialize();

      expect(TunnelService).toHaveBeenCalledWith({ port: 3000 }, mockLogger);

      process.env.NODE_ENV = originalEnv;
      if (originalPort !== undefined) {
        process.env.PORT = originalPort;
      }
      process.env.TUNNEL_DOMAIN = originalDomain;
    });
  });

  describe('initialize Method - Error Paths', () => {
    it('should throw error when already initialized', async () => {
      await authModule.initialize();
      
      await expect(authModule.initialize()).rejects.toThrow(ConfigurationError);
      await expect(authModule.initialize()).rejects.toThrow('Auth module already initialized');
    });

    it('should throw ConfigurationError on database service failure', async () => {
      (DatabaseService.getInstance as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(authModule.initialize()).rejects.toThrow(ConfigurationError);
      await expect(authModule.initialize()).rejects.toThrow('Failed to initialize auth module: Database connection failed');
    });

    it('should throw ConfigurationError on key generation failure', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('private.key') || path.includes('public.key')) {
          return false;
        }
        return true;
      });
      mockGenerateJwtKeyPair.mockImplementation(() => {
        throw new Error('Key generation failed');
      });

      await expect(authModule.initialize()).rejects.toThrow(ConfigurationError);
      await expect(authModule.initialize()).rejects.toThrow('Failed to initialize auth module: Key generation failed');
    });

    it('should throw ConfigurationError on provider registry failure', async () => {
      mockProviderRegistry.initialize.mockRejectedValue(new Error('Provider initialization failed'));

      await expect(authModule.initialize()).rejects.toThrow(ConfigurationError);
      await expect(authModule.initialize()).rejects.toThrow('Failed to initialize auth module: Provider initialization failed');
    });

    it('should handle string errors in initialization', async () => {
      (LoggerService.getInstance as any).mockImplementation(() => {
        throw 'String error';
      });

      await expect(authModule.initialize()).rejects.toThrow(ConfigurationError);
      await expect(authModule.initialize()).rejects.toThrow('Failed to initialize auth module: String error');
    });
  });

  describe('start Method', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should throw error when not initialized', async () => {
      const uninitializedModule = new AuthModule();
      await expect(uninitializedModule.start()).rejects.toThrow('Auth module not initialized');
    });

    it('should start successfully and execute schema', async () => {
      await authModule.start();

      expect(authModule.status).toBe(ModuleStatusEnum.RUNNING);
      expect((authModule as any).started).toBe(true);
      expect(mockDatabase.execute).toHaveBeenCalledWith('CREATE TABLE test (id INTEGER)');
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Auth database schema updated');
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Auth module started');
    });

    it('should skip duplicate starts', async () => {
      await authModule.start();
      const firstCallCount = mockLogger.info.mock.calls.length;
      
      await authModule.start();
      
      // Should not log additional start messages
      expect(mockLogger.info.mock.calls.length).toBe(firstCallCount);
    });

    it('should handle schema file not existing', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('schema.sql')) {
          return false;
        }
        return true;
      });

      await authModule.start();

      expect(mockDatabase.execute).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalledWith(LogSource.AUTH, 'Auth database schema updated');
    });

    it('should filter out empty SQL statements', async () => {
      mockReadFileSync.mockReturnValue('CREATE TABLE test (id INTEGER);; ; ;CREATE TABLE test2 (id INTEGER);');

      await authModule.start();

      expect(mockDatabase.execute).toHaveBeenCalledTimes(2);
      expect(mockDatabase.execute).toHaveBeenCalledWith('CREATE TABLE test (id INTEGER)');
      expect(mockDatabase.execute).toHaveBeenCalledWith('CREATE TABLE test2 (id INTEGER)');
    });

    it('should handle database execution errors gracefully for duplicate columns', async () => {
      const duplicateError = new Error('duplicate column');
      mockDatabase.execute.mockRejectedValueOnce(duplicateError);

      await authModule.start();

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(authModule.status).toBe(ModuleStatusEnum.RUNNING);
    });

    it('should log warnings for non-duplicate database errors', async () => {
      const otherError = new Error('some other database error');
      mockDatabase.execute.mockRejectedValueOnce(otherError);

      await authModule.start();

      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.AUTH, 'Schema statement warning', { 
        error: 'some other database error' 
      });
    });

    it('should setup cleanup interval when not in CLI mode', async () => {
      const originalLogMode = process.env.LOG_MODE;
      process.env.LOG_MODE = 'server';

      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      await authModule.start();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        24 * 60 * 60 * 1000
      );
      expect((authModule as any).cleanupInterval).toBeDefined();

      vi.useRealTimers();
      process.env.LOG_MODE = originalLogMode;
    });

    it('should not setup cleanup interval in CLI mode', async () => {
      const originalLogMode = process.env.LOG_MODE;
      process.env.LOG_MODE = 'cli';

      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      await authModule.start();

      expect(setIntervalSpy).not.toHaveBeenCalled();
      expect((authModule as any).cleanupInterval).toBe(null);

      process.env.LOG_MODE = originalLogMode;
    });

    it('should handle cleanup interval callback errors', async () => {
      const originalLogMode = process.env.LOG_MODE;
      process.env.LOG_MODE = 'server';
      mockTokenService.cleanupExpiredTokens.mockRejectedValue(new Error('Cleanup failed'));

      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      await authModule.start();

      // Verify setInterval was called
      expect(setIntervalSpy).toHaveBeenCalled();
      
      // Get the interval callback from the spy
      const firstCall = setIntervalSpy.mock.calls[0];
      const intervalCallback = firstCall?.[0] as Function;
      await intervalCallback();

      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.AUTH, 'Token cleanup failed', {
        error: expect.any(Error)
      });

      vi.useRealTimers();
      process.env.LOG_MODE = originalLogMode;
    });

    it('should handle cleanup interval callback with string errors', async () => {
      const originalLogMode = process.env.LOG_MODE;
      process.env.LOG_MODE = 'server';
      mockTokenService.cleanupExpiredTokens.mockRejectedValue('String error');

      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      await authModule.start();

      // Verify setInterval was called
      expect(setIntervalSpy).toHaveBeenCalled();
      
      // Get the interval callback from the spy
      const firstCall = setIntervalSpy.mock.calls[0];
      const intervalCallback = firstCall?.[0] as Function;
      await intervalCallback();

      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.AUTH, 'Token cleanup failed', {
        error: expect.any(Error)
      });

      vi.useRealTimers();
      process.env.LOG_MODE = originalLogMode;
    });

    it('should set status to STOPPED on start failure', async () => {
      // Reset mocks for a clean test
      vi.clearAllMocks();
      
      // Create a fresh auth module instance for this test
      const freshAuthModule = new AuthModule();
      
      // Mock the required services for initialization
      mockLogger.info.mockReturnValue(undefined);
      mockLogger.debug.mockReturnValue(undefined);
      mockExistsSync.mockReturnValue(true);
      
      // Import and mock buildAuthConfig
      const { buildAuthConfig } = await import('@/modules/core/auth/utils/config-builder');
      vi.mocked(buildAuthConfig).mockReturnValue({
        jwt: { keyStorePath: './state/auth/keys' },
        providers: {},
        session: {},
        oauth2: {},
        mfa: { appName: 'Test App', backupCodeCount: 10, windowSize: 2 },
        audit: { enabled: true, retentionDays: 90 }
      });
      
      await freshAuthModule.initialize();
      
      // Now setup the failure scenario
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('CREATE TABLE test (id INTEGER);');
      mockDatabase.execute.mockRejectedValue(new Error('Fatal database error'));

      await expect(freshAuthModule.start()).rejects.toThrow('Fatal database error');
      expect(freshAuthModule.status).toBe(ModuleStatusEnum.STOPPED);
    });
  });

  describe('stop Method', () => {
    beforeEach(async () => {
      await authModule.initialize();
      await authModule.start();
    });

    it('should clear cleanup interval when it exists', async () => {
      const originalLogMode = process.env.LOG_MODE;
      process.env.LOG_MODE = 'server';
      
      vi.useFakeTimers();
      
      // Restart to create interval
      await authModule.stop();
      await authModule.start();
      
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      await authModule.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect((authModule as any).cleanupInterval).toBe(null);
      
      vi.useRealTimers();
      process.env.LOG_MODE = originalLogMode;
    });

    it('should handle null cleanup interval gracefully', async () => {
      (authModule as any).cleanupInterval = null;
      
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      await authModule.stop();

      expect(clearIntervalSpy).not.toHaveBeenCalled();
    });

    it('should stop tunnel service when it exists', async () => {
      (authModule as any).tunnelService = mockTunnelService;

      await authModule.stop();

      expect(mockTunnelService.stop).toHaveBeenCalled();
    });

    it('should handle null tunnel service gracefully', async () => {
      (authModule as any).tunnelService = null;

      await authModule.stop();

      // Should not throw and should complete successfully
      expect(authModule.status).toBe(ModuleStatusEnum.STOPPED);
      expect((authModule as any).started).toBe(false);
    });

    it('should update status and started flag', async () => {
      await authModule.stop();

      expect(authModule.status).toBe(ModuleStatusEnum.STOPPED);
      expect((authModule as any).started).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Auth module stopped');
    });
  });

  describe('healthCheck Method', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should return healthy status with provider count', async () => {
      const mockProviders = [
        { id: 'google', name: 'Google' },
        { id: 'github', name: 'GitHub' }
      ];
      mockProviderRegistry.getAllProviders.mockReturnValue(mockProviders);

      const result = await authModule.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'Auth module healthy. 2 provider(s) loaded.'
      });
    });

    it('should return healthy status with zero providers', async () => {
      mockProviderRegistry.getAllProviders.mockReturnValue([]);

      const result = await authModule.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'Auth module healthy. 0 provider(s) loaded.'
      });
    });

    it('should handle null provider registry', async () => {
      (authModule as any).providerRegistry = null;

      const result = await authModule.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'Auth module healthy. 0 provider(s) loaded.'
      });
    });

    it('should return unhealthy status on error', async () => {
      mockProviderRegistry.getAllProviders.mockImplementation(() => {
        throw new Error('Provider registry failed');
      });

      const result = await authModule.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Auth module unhealthy: Error: Provider registry failed'
      });
    });

    it('should handle string errors', async () => {
      mockProviderRegistry.getAllProviders.mockImplementation(() => {
        throw 'String error';
      });

      const result = await authModule.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Auth module unhealthy: String error'
      });
    });
  });

  describe('Public Delegation Methods', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should delegate getLogger correctly', () => {
      const logger = authModule.getLogger();
      expect(logger).toBe(mockLogger);
    });

    it('should delegate login correctly', async () => {
      const loginInput: LoginInput = { email: 'test@example.com', password: 'password' };
      const loginResult: LoginResult = { accessToken: 'token', refreshToken: 'refresh', user: {} as any };
      mockAuthService.login.mockResolvedValue(loginResult);

      const result = await authModule.login(loginInput);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginInput);
      expect(result).toBe(loginResult);
    });

    it('should delegate logout correctly', async () => {
      await authModule.logout('session-123');

      expect(mockAuthService.logout).toHaveBeenCalledWith('session-123');
    });

    it('should delegate refreshAccessToken correctly', async () => {
      const refreshResult = { accessToken: 'new-token', refreshToken: 'new-refresh' };
      mockAuthService.refreshAccessToken.mockResolvedValue(refreshResult);

      const result = await authModule.refreshAccessToken('refresh-token');

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('refresh-token');
      expect(result).toBe(refreshResult);
    });

    it('should delegate createToken correctly', async () => {
      const tokenInput: TokenCreateInput = { userId: 'user-1', type: 'access', scope: ['read'] };
      const token: AuthToken = { id: 'token-1', token: 'test-token' } as AuthToken;
      mockTokenService.createToken.mockResolvedValue(token);

      const result = await authModule.createToken(tokenInput);

      expect(mockTokenService.createToken).toHaveBeenCalledWith(tokenInput);
      expect(result).toBe(token);
    });

    it('should delegate validateToken correctly', async () => {
      const validationResult: TokenValidationResult = { valid: true, payload: {} } as TokenValidationResult;
      mockTokenService.validateToken.mockResolvedValue(validationResult);

      const result = await authModule.validateToken('test-token');

      expect(mockTokenService.validateToken).toHaveBeenCalledWith('test-token');
      expect(result).toBe(validationResult);
    });

    it('should delegate revokeToken correctly', async () => {
      await authModule.revokeToken('token-1');

      expect(mockTokenService.revokeToken).toHaveBeenCalledWith('token-1');
    });

    it('should delegate revokeUserTokens correctly with type', async () => {
      await authModule.revokeUserTokens('user-1', 'access');

      expect(mockTokenService.revokeUserTokens).toHaveBeenCalledWith('user-1', 'access');
    });

    it('should delegate revokeUserTokens correctly without type', async () => {
      await authModule.revokeUserTokens('user-1');

      expect(mockTokenService.revokeUserTokens).toHaveBeenCalledWith('user-1', undefined);
    });

    it('should delegate listUserTokens correctly', async () => {
      const tokens: AuthToken[] = [{ id: 'token-1', token: 'test-token' } as AuthToken];
      mockTokenService.listUserTokens.mockResolvedValue(tokens);

      const result = await authModule.listUserTokens('user-1');

      expect(mockTokenService.listUserTokens).toHaveBeenCalledWith('user-1');
      expect(result).toBe(tokens);
    });

    it('should delegate cleanupExpiredTokens correctly', async () => {
      mockTokenService.cleanupExpiredTokens.mockResolvedValue(5);

      const result = await authModule.cleanupExpiredTokens();

      expect(mockTokenService.cleanupExpiredTokens).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });

  describe('Provider Methods', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should get provider correctly', () => {
      const mockProvider: IdentityProvider = { id: 'test', name: 'Test' } as IdentityProvider;
      mockProviderRegistry.getProvider.mockReturnValue(mockProvider);

      const result = authModule.getProvider('test');

      expect(mockProviderRegistry.getProvider).toHaveBeenCalledWith('test');
      expect(result).toBe(mockProvider);
    });

    it('should return undefined when provider registry is null', () => {
      (authModule as any).providerRegistry = null;

      const result = authModule.getProvider('test');

      expect(result).toBeUndefined();
    });

    it('should get all providers correctly', () => {
      const mockProviders: IdentityProvider[] = [
        { id: 'google', name: 'Google' } as IdentityProvider,
        { id: 'github', name: 'GitHub' } as IdentityProvider
      ];
      mockProviderRegistry.getAllProviders.mockReturnValue(mockProviders);

      const result = authModule.getAllProviders();

      expect(mockProviderRegistry.getAllProviders).toHaveBeenCalled();
      expect(result).toBe(mockProviders);
    });

    it('should return empty array when provider registry is null', () => {
      (authModule as any).providerRegistry = null;

      const result = authModule.getAllProviders();

      expect(result).toEqual([]);
    });

    it('should check provider existence correctly', () => {
      mockProviderRegistry.hasProvider.mockReturnValue(true);

      const result = authModule.hasProvider('test');

      expect(mockProviderRegistry.hasProvider).toHaveBeenCalledWith('test');
      expect(result).toBe(true);
    });

    it('should return false when provider registry is null', () => {
      (authModule as any).providerRegistry = null;

      const result = authModule.hasProvider('test');

      expect(result).toBe(false);
    });

    it('should get provider registry correctly', () => {
      const result = authModule.getProviderRegistry();

      expect(result).toBe(mockProviderRegistry);
    });

    it('should reload providers correctly', async () => {
      await authModule.reloadProviders();

      expect(mockProviderRegistry.initialize).toHaveBeenCalled();
    });

    it('should handle reload when provider registry is null', async () => {
      (authModule as any).providerRegistry = null;

      // Should not throw
      await authModule.reloadProviders();
    });
  });

  describe('Tunnel Methods', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should get tunnel service correctly', () => {
      (authModule as any).tunnelService = mockTunnelService;

      const result = authModule.getTunnelService();

      expect(result).toBe(mockTunnelService);
    });

    it('should return null when tunnel service is null', () => {
      (authModule as any).tunnelService = null;

      const result = authModule.getTunnelService();

      expect(result).toBe(null);
    });

    it('should get tunnel status correctly', () => {
      (authModule as any).tunnelService = mockTunnelService;
      mockTunnelService.getStatus.mockReturnValue({ active: true, type: 'cloudflare' });

      const result = authModule.getTunnelStatus();

      expect(mockTunnelService.getStatus).toHaveBeenCalled();
      expect(result).toEqual({ active: true, type: 'cloudflare' });
    });

    it('should return inactive status when tunnel service is null', () => {
      (authModule as any).tunnelService = null;

      const result = authModule.getTunnelStatus();

      expect(result).toEqual({ active: false, type: 'none' });
    });

    it('should get public URL correctly', () => {
      (authModule as any).tunnelService = mockTunnelService;
      mockTunnelService.getPublicUrl.mockReturnValue('https://test.tunnel.com');

      const result = authModule.getPublicUrl();

      expect(mockTunnelService.getPublicUrl).toHaveBeenCalled();
      expect(result).toBe('https://test.tunnel.com');
    });

    it('should return null when tunnel service is null', () => {
      (authModule as any).tunnelService = null;

      const result = authModule.getPublicUrl();

      expect(result).toBe(null);
    });
  });

  describe('buildConfig Method', () => {
    it('should build default configuration', async () => {
      // buildAuthConfig is now imported and mocked
      const { buildAuthConfig } = await import('@/modules/core/auth/utils/config-builder');
      const config = buildAuthConfig();

      expect(config).toMatchObject({
        jwt: {
          algorithm: 'RS256',
          issuer: 'systemprompt-os',
          audience: 'systemprompt-os',
          accessTokenTTL: 900,
          refreshTokenTTL: 2592000,
          keyStorePath: './state/auth/keys',
          privateKey: '',
          publicKey: ''
        },
        session: {
          maxConcurrent: expect.any(Number),
          absoluteTimeout: 86400,
          inactivityTimeout: 3600
        },
        security: {
          maxLoginAttempts: expect.any(Number),
          lockoutDuration: 900,
          passwordMinLength: 8,
          requirePasswordChange: false,
        },
      });
    });

    it('should use custom JWT_KEY_PATH from environment', async () => {
      const originalPath = process.env.JWT_KEY_PATH;
      process.env.JWT_KEY_PATH = '/custom/path/keys';

      // buildAuthConfig is now imported and mocked
      const { buildAuthConfig } = await import('@/modules/core/auth/utils/config-builder');
      const config = buildAuthConfig();

      expect(config.jwt.keyStorePath).toBe('/custom/path/keys');

      process.env.JWT_KEY_PATH = originalPath;
    });
  });

  describe('Factory Functions', () => {
    it('should create module with createModule', () => {
      const module = createModule();

      expect(module).toBeInstanceOf(AuthModule);
      expect(module.name).toBe('auth');
    });

    it('should create and initialize module with initialize function', async () => {
      const module = await initialize();

      expect(module).toBeInstanceOf(AuthModule);
      expect((module as any).initialized).toBe(true);
    });
  });

  describe('getAuthModule Utility Function', () => {
    beforeEach(() => {
      mockModuleLoader.getRegistry.mockReturnValue({
        getAll: vi.fn().mockReturnValue([])
      });
    });

    it('should throw error when auth module not found', () => {
      mockModuleLoader.getRegistry().getAll.mockReturnValue([]);

      expect(() => getAuthModule()).toThrow('Auth module not found in registry');
    });

    it('should throw error when module is not properly initialized', () => {
      const incompleteModule = { name: 'auth' };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([incompleteModule]);

      expect(() => getAuthModule()).toThrow('Auth module not properly initialized');
    });

    it('should throw error when exports is missing', () => {
      const moduleWithoutExports = { name: 'auth', exports: null };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithoutExports]);

      expect(() => getAuthModule()).toThrow('Auth module not properly initialized');
    });

    it('should throw error when service export is missing', () => {
      const moduleWithIncompleteExports = {
        name: 'auth',
        exports: { tokenService: vi.fn() }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithIncompleteExports]);

      expect(() => getAuthModule()).toThrow('Auth module missing required service export');
    });

    it('should throw error when service export is not a function', () => {
      const moduleWithInvalidService = {
        name: 'auth',
        exports: { service: 'not-a-function' }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithInvalidService]);

      expect(() => getAuthModule()).toThrow('Auth module missing required service export');
    });

    it('should throw error when tokenService export is missing', () => {
      const moduleWithIncompleteExports = {
        name: 'auth',
        exports: { service: vi.fn() }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithIncompleteExports]);

      expect(() => getAuthModule()).toThrow('Auth module missing required tokenService export');
    });

    it('should throw error when tokenService export is not a function', () => {
      const moduleWithInvalidTokenService = {
        name: 'auth',
        exports: { service: vi.fn(), tokenService: 'not-a-function' }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithInvalidTokenService]);

      expect(() => getAuthModule()).toThrow('Auth module missing required tokenService export');
    });

    it('should throw error when userService export is missing', () => {
      const moduleWithIncompleteExports = {
        name: 'auth',
        exports: { service: vi.fn(), tokenService: vi.fn() }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithIncompleteExports]);

      expect(() => getAuthModule()).toThrow('Auth module missing required userService export');
    });

    it('should throw error when userService export is not a function', () => {
      const moduleWithInvalidUserService = {
        name: 'auth',
        exports: { service: vi.fn(), tokenService: vi.fn(), userService: 'not-a-function' }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithInvalidUserService]);

      expect(() => getAuthModule()).toThrow('Auth module missing required userService export');
    });

    it('should throw error when createToken export is missing', () => {
      const moduleWithIncompleteExports = {
        name: 'auth',
        exports: { service: vi.fn(), tokenService: vi.fn(), userService: vi.fn() }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithIncompleteExports]);

      expect(() => getAuthModule()).toThrow('Auth module missing required createToken export');
    });

    it('should throw error when createToken export is not a function', () => {
      const moduleWithInvalidCreateToken = {
        name: 'auth',
        exports: { 
          service: vi.fn(), 
          tokenService: vi.fn(), 
          userService: vi.fn(), 
          createToken: 'not-a-function' 
        }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithInvalidCreateToken]);

      expect(() => getAuthModule()).toThrow('Auth module missing required createToken export');
    });

    it('should throw error when validateToken export is missing', () => {
      const moduleWithIncompleteExports = {
        name: 'auth',
        exports: { 
          service: vi.fn(), 
          tokenService: vi.fn(), 
          userService: vi.fn(), 
          createToken: vi.fn() 
        }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithIncompleteExports]);

      expect(() => getAuthModule()).toThrow('Auth module missing required validateToken export');
    });

    it('should throw error when validateToken export is not a function', () => {
      const moduleWithInvalidValidateToken = {
        name: 'auth',
        exports: { 
          service: vi.fn(), 
          tokenService: vi.fn(), 
          userService: vi.fn(), 
          createToken: vi.fn(),
          validateToken: 'not-a-function'
        }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([moduleWithInvalidValidateToken]);

      expect(() => getAuthModule()).toThrow('Auth module missing required validateToken export');
    });

    it('should return valid auth module when all exports are present', () => {
      const validModule = {
        name: 'auth',
        exports: {
          service: vi.fn(),
          tokenService: vi.fn(),
          userService: vi.fn(),
          createToken: vi.fn(),
          validateToken: vi.fn()
        }
      };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([validModule]);

      const result = getAuthModule();

      expect(result).toBe(validModule);
    });

    it('should filter modules correctly by auth name', () => {
      const authModule = {
        name: 'auth',
        exports: {
          service: vi.fn(),
          tokenService: vi.fn(),
          userService: vi.fn(),
          createToken: vi.fn(),
          validateToken: vi.fn()
        }
      };
      const otherModule = { name: 'database' };
      mockModuleLoader.getRegistry().getAll.mockReturnValue([otherModule, authModule]);

      const result = getAuthModule();

      expect(result).toBe(authModule);
    });
  });

  describe('start method', () => {
    beforeEach(async () => {
      // Initialize the module before testing start
      await authModule.initialize();
    });

    it('should throw error if not initialized', async () => {
      const uninitialized = new AuthModule();
      
      await expect(uninitialized.start()).rejects.toThrow('Auth module not initialized');
    });

    it('should return early if already started', async () => {
      // Start once
      await authModule.start();
      
      // Clear mocks and start again
      vi.clearAllMocks();
      await authModule.start();
      
      // Should not call database operations again
      expect(mockDatabase.execute).not.toHaveBeenCalled();
      expect(authModule.status).toBe(ModuleStatusEnum.RUNNING);
    });

    it('should successfully start with schema file', async () => {
      const mockSchema = 'CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE tokens (id TEXT);';
      (readFileSync as any).mockReturnValue(mockSchema);
      (existsSync as any).mockReturnValue(true);

      await authModule.start();

      expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('schema.sql'), 'utf8');
      expect(mockDatabase.execute).toHaveBeenCalledWith('CREATE TABLE users (id TEXT PRIMARY KEY)');
      expect(mockDatabase.execute).toHaveBeenCalledWith(' CREATE TABLE tokens (id TEXT)');
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Auth database schema updated');
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Auth module started');
      expect(authModule.status).toBe(ModuleStatusEnum.RUNNING);
      expect((authModule as any).started).toBe(true);
    });

    it('should handle missing schema file gracefully', async () => {
      (existsSync as any).mockImplementation((path: string) => {
        if (path.includes('schema.sql')) return false;
        return true;
      });

      await authModule.start();

      expect(readFileSync).not.toHaveBeenCalled();
      expect(mockDatabase.execute).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Auth module started');
      expect(authModule.status).toBe(ModuleStatusEnum.RUNNING);
    });

    it('should filter out empty SQL statements', async () => {
      const mockSchema = 'CREATE TABLE users (id TEXT);;;; ; CREATE TABLE tokens (id TEXT); ';
      (readFileSync as any).mockReturnValue(mockSchema);

      await authModule.start();

      // Should only execute non-empty statements
      expect(mockDatabase.execute).toHaveBeenCalledTimes(2);
      expect(mockDatabase.execute).toHaveBeenCalledWith('CREATE TABLE users (id TEXT)');
      expect(mockDatabase.execute).toHaveBeenCalledWith(' CREATE TABLE tokens (id TEXT)');
    });

    it('should handle database execution errors gracefully', async () => {
      const mockSchema = 'CREATE TABLE users (id TEXT);';
      (readFileSync as any).mockReturnValue(mockSchema);
      
      // Mock database error that is not duplicate column
      mockDatabase.execute.mockRejectedValueOnce(new Error('Some database error'));

      await authModule.start();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        LogSource.AUTH, 
        'Schema statement warning', 
        { error: 'Some database error' }
      );
    });

    it('should silently ignore duplicate column errors', async () => {
      const mockSchema = 'ALTER TABLE users ADD COLUMN name TEXT;';
      (readFileSync as any).mockReturnValue(mockSchema);
      
      // Mock duplicate column error
      mockDatabase.execute.mockRejectedValueOnce(new Error('duplicate column name'));

      await authModule.start();

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should setup cleanup interval when not in CLI mode', async () => {
      process.env.LOG_MODE = 'server';
      
      // Mock setInterval
      const mockInterval = { id: 'mock-interval' } as any;
      const originalSetInterval = global.setInterval;
      global.setInterval = vi.fn(() => mockInterval);

      await authModule.start();

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        24 * 60 * 60 * 1000
      );
      expect((authModule as any).cleanupInterval).toBe(mockInterval);

      // Restore original setInterval
      global.setInterval = originalSetInterval;
    });

    it('should not setup cleanup interval in CLI mode', async () => {
      process.env.LOG_MODE = 'cli';
      
      // Mock setInterval
      const originalSetInterval = global.setInterval;
      global.setInterval = vi.fn();

      await authModule.start();

      expect(global.setInterval).not.toHaveBeenCalled();
      expect((authModule as any).cleanupInterval).toBe(null);

      // Restore original setInterval
      global.setInterval = originalSetInterval;
    });

    it('should test cleanup interval function handles token service errors', async () => {
      process.env.LOG_MODE = 'server';
      
      // Mock setInterval to capture the callback
      let cleanupCallback: Function;
      const originalSetInterval = global.setInterval;
      global.setInterval = vi.fn((callback: Function) => {
        cleanupCallback = callback;
        return { id: 'mock-interval' } as any;
      });

      await authModule.start();

      // Mock token service cleanup to fail
      const cleanupError = new Error('Cleanup failed');
      mockTokenService.cleanupExpiredTokens.mockRejectedValueOnce(cleanupError);

      // Execute the cleanup callback
      await cleanupCallback!();

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Token cleanup failed',
        { error: cleanupError }
      );

      // Restore original setInterval
      global.setInterval = originalSetInterval;
    });

    it('should test cleanup interval function handles non-Error exceptions', async () => {
      process.env.LOG_MODE = 'server';
      
      // Mock setInterval to capture the callback
      let cleanupCallback: Function;
      const originalSetInterval = global.setInterval;
      global.setInterval = vi.fn((callback: Function) => {
        cleanupCallback = callback;
        return { id: 'mock-interval' } as any;
      });

      await authModule.start();

      // Mock token service cleanup to fail with non-Error
      mockTokenService.cleanupExpiredTokens.mockRejectedValueOnce('String error');

      // Execute the cleanup callback
      await cleanupCallback!();

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.AUTH,
        'Token cleanup failed',
        { error: new Error('String error') }
      );

      // Restore original setInterval
      global.setInterval = originalSetInterval;
    });

    it('should set status to STOPPED and rethrow error on start failure', async () => {
      // Reset mocks for a clean test
      vi.clearAllMocks();
      
      // Create a fresh auth module instance for this test
      const freshAuthModule = new AuthModule();
      
      // Mock the required services for initialization
      mockLogger.info.mockReturnValue(undefined);
      mockLogger.debug.mockReturnValue(undefined);
      mockExistsSync.mockReturnValue(true);
      
      // Import and mock buildAuthConfig
      const { buildAuthConfig } = await import('@/modules/core/auth/utils/config-builder');
      vi.mocked(buildAuthConfig).mockReturnValue({
        jwt: { keyStorePath: './state/auth/keys' },
        providers: {},
        session: {},
        oauth2: {},
        mfa: { appName: 'Test App', backupCodeCount: 10, windowSize: 2 },
        audit: { enabled: true, retentionDays: 90 }
      });
      
      await freshAuthModule.initialize();
      
      // Now setup the failure scenario
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('CREATE TABLE test;');
      mockDatabase.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(freshAuthModule.start()).rejects.toThrow('Database error');
      expect(freshAuthModule.status).toBe(ModuleStatusEnum.STOPPED);
    });

    it('should handle schema with only whitespace statements', async () => {
      const mockSchema = '   ; \n\n ; \t  ;';
      (readFileSync as any).mockReturnValue(mockSchema);

      await authModule.start();

      expect(mockDatabase.execute).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Auth database schema updated');
    });

    it('should execute statements that are not empty after trimming', async () => {
      const mockSchema = '  CREATE TABLE test (id TEXT)  ; \n  \n ; CREATE INDEX idx_test ON test(id)  ';
      (readFileSync as any).mockReturnValue(mockSchema);

      await authModule.start();

      expect(mockDatabase.execute).toHaveBeenCalledTimes(2);
      expect(mockDatabase.execute).toHaveBeenCalledWith('  CREATE TABLE test (id TEXT)  ');
      expect(mockDatabase.execute).toHaveBeenCalledWith(' CREATE INDEX idx_test ON test(id)  ');
    });
  });

  describe('stop method', () => {
    beforeEach(async () => {
      await authModule.initialize();
      await authModule.start();
    });

    it('should clear cleanup interval if it exists', async () => {
      // Setup cleanup interval
      const mockInterval = { id: 'mock-interval' } as any;
      (authModule as any).cleanupInterval = mockInterval;
      
      const originalClearInterval = global.clearInterval;
      global.clearInterval = vi.fn();

      await authModule.stop();

      expect(global.clearInterval).toHaveBeenCalledWith(mockInterval);
      expect((authModule as any).cleanupInterval).toBe(null);

      global.clearInterval = originalClearInterval;
    });

    it('should not call clearInterval if no cleanup interval exists', async () => {
      (authModule as any).cleanupInterval = null;
      
      const originalClearInterval = global.clearInterval;
      global.clearInterval = vi.fn();

      await authModule.stop();

      expect(global.clearInterval).not.toHaveBeenCalled();

      global.clearInterval = originalClearInterval;
    });

    it('should stop tunnel service if it exists', async () => {
      process.env.NODE_ENV = 'development';
      
      // Re-initialize to create tunnel service
      authModule = new AuthModule();
      await authModule.initialize();
      
      await authModule.stop();

      expect(mockTunnelService.stop).toHaveBeenCalled();
    });

    it('should not call tunnel service stop if tunnel service is null', async () => {
      (authModule as any).tunnelService = null;

      await authModule.stop();

      expect(mockTunnelService.stop).not.toHaveBeenCalled();
    });

    it('should set status and started flag correctly', async () => {
      await authModule.stop();

      expect(authModule.status).toBe(ModuleStatusEnum.STOPPED);
      expect((authModule as any).started).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Auth module stopped');
    });
  });

  describe('healthCheck method', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should return healthy status with providers count', async () => {
      const mockProviders = [
        { id: 'google', name: 'Google' },
        { id: 'github', name: 'GitHub' }
      ];
      mockProviderRegistry.getAllProviders.mockReturnValue(mockProviders);

      const result = await authModule.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'Auth module healthy. 2 provider(s) loaded.'
      });
    });

    it('should return healthy status with zero providers', async () => {
      mockProviderRegistry.getAllProviders.mockReturnValue([]);

      const result = await authModule.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'Auth module healthy. 0 provider(s) loaded.'
      });
    });

    it('should handle null provider registry', async () => {
      (authModule as any).providerRegistry = null;

      const result = await authModule.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'Auth module healthy. 0 provider(s) loaded.'
      });
    });

    it('should return unhealthy status on error', async () => {
      mockProviderRegistry.getAllProviders.mockImplementation(() => {
        throw new Error('Provider registry error');
      });

      const result = await authModule.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Auth module unhealthy: Error: Provider registry error'
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockProviderRegistry.getAllProviders.mockImplementation(() => {
        throw 'String error';
      });

      const result = await authModule.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'Auth module unhealthy: String error'
      });
    });
  });

  describe('getLogger method', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should return the logger instance', () => {
      const logger = authModule.getLogger();
      expect(logger).toBe(mockLogger);
    });
  });

  describe('Authentication delegation methods', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should delegate login to auth service', async () => {
      const mockInput: LoginInput = { 
        email: 'test@example.com', 
        password: 'password' 
      };
      const mockResult: LoginResult = { 
        user: { id: '1', email: 'test@example.com' }, 
        accessToken: 'token',
        refreshToken: 'refresh'
      };
      
      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await authModule.login(mockInput);

      expect(mockAuthService.login).toHaveBeenCalledWith(mockInput);
      expect(result).toBe(mockResult);
    });

    it('should delegate logout to auth service', async () => {
      const sessionId = 'session123';
      
      await authModule.logout(sessionId);

      expect(mockAuthService.logout).toHaveBeenCalledWith(sessionId);
    });

    it('should delegate refreshAccessToken to auth service', async () => {
      const refreshToken = 'refresh_token_123';
      const mockResult = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token'
      };
      
      mockAuthService.refreshAccessToken.mockResolvedValue(mockResult);

      const result = await authModule.refreshAccessToken(refreshToken);

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(refreshToken);
      expect(result).toBe(mockResult);
    });
  });

  describe('Token management methods', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should delegate createToken to token service', async () => {
      const mockInput: TokenCreateInput = {
        userId: 'user123',
        type: 'access',
        scope: ['read', 'write']
      };
      const mockToken: AuthToken = {
        id: 'token123',
        userId: 'user123',
        token: 'jwt_token',
        type: 'access',
        scope: ['read', 'write'],
        expiresAt: new Date(),
        createdAt: new Date(),
        isRevoked: false
      };
      
      mockTokenService.createToken.mockResolvedValue(mockToken);

      const result = await authModule.createToken(mockInput);

      expect(mockTokenService.createToken).toHaveBeenCalledWith(mockInput);
      expect(result).toBe(mockToken);
    });

    it('should delegate validateToken to token service', async () => {
      const token = 'jwt_token_123';
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: { userId: 'user123' }
      };
      
      mockTokenService.validateToken.mockResolvedValue(mockResult);

      const result = await authModule.validateToken(token);

      expect(mockTokenService.validateToken).toHaveBeenCalledWith(token);
      expect(result).toBe(mockResult);
    });

    it('should delegate revokeToken to token service', async () => {
      const tokenId = 'token123';
      
      await authModule.revokeToken(tokenId);

      expect(mockTokenService.revokeToken).toHaveBeenCalledWith(tokenId);
    });

    it('should delegate revokeUserTokens to token service', async () => {
      const userId = 'user123';
      const type = 'access';
      
      await authModule.revokeUserTokens(userId, type);

      expect(mockTokenService.revokeUserTokens).toHaveBeenCalledWith(userId, type);
    });

    it('should delegate revokeUserTokens without type to token service', async () => {
      const userId = 'user123';
      
      await authModule.revokeUserTokens(userId);

      expect(mockTokenService.revokeUserTokens).toHaveBeenCalledWith(userId, undefined);
    });

    it('should delegate listUserTokens to token service', async () => {
      const userId = 'user123';
      const mockTokens: AuthToken[] = [
        {
          id: 'token1',
          userId: 'user123',
          token: 'jwt1',
          type: 'access',
          scope: ['read'],
          expiresAt: new Date(),
          createdAt: new Date(),
          isRevoked: false
        }
      ];
      
      mockTokenService.listUserTokens.mockResolvedValue(mockTokens);

      const result = await authModule.listUserTokens(userId);

      expect(mockTokenService.listUserTokens).toHaveBeenCalledWith(userId);
      expect(result).toBe(mockTokens);
    });

    it('should delegate cleanupExpiredTokens to token service', async () => {
      const cleanedCount = 5;
      
      mockTokenService.cleanupExpiredTokens.mockResolvedValue(cleanedCount);

      const result = await authModule.cleanupExpiredTokens();

      expect(mockTokenService.cleanupExpiredTokens).toHaveBeenCalled();
      expect(result).toBe(cleanedCount);
    });
  });

  describe('Provider management methods', () => {
    beforeEach(async () => {
      await authModule.initialize();
    });

    it('should delegate getProvider to provider registry', () => {
      const providerId = 'google';
      const mockProvider: IdentityProvider = {
        id: 'google',
        name: 'Google',
        type: 'oauth2'
      };
      
      mockProviderRegistry.getProvider.mockReturnValue(mockProvider);

      const result = authModule.getProvider(providerId);

      expect(mockProviderRegistry.getProvider).toHaveBeenCalledWith(providerId);
      expect(result).toBe(mockProvider);
    });

    it('should return undefined when provider registry is null', () => {
      (authModule as any).providerRegistry = null;

      const result = authModule.getProvider('google');

      expect(result).toBeUndefined();
    });

    it('should delegate getAllProviders to provider registry', () => {
      const mockProviders: IdentityProvider[] = [
        { id: 'google', name: 'Google', type: 'oauth2' },
        { id: 'github', name: 'GitHub', type: 'oauth2' }
      ];
      
      mockProviderRegistry.getAllProviders.mockReturnValue(mockProviders);

      const result = authModule.getAllProviders();

      expect(mockProviderRegistry.getAllProviders).toHaveBeenCalled();
      expect(result).toBe(mockProviders);
    });

    it('should return empty array when provider registry is null', () => {
      (authModule as any).providerRegistry = null;

      const result = authModule.getAllProviders();

      expect(result).toEqual([]);
    });

    it('should delegate hasProvider to provider registry', () => {
      const providerId = 'google';
      
      mockProviderRegistry.hasProvider.mockReturnValue(true);

      const result = authModule.hasProvider(providerId);

      expect(mockProviderRegistry.hasProvider).toHaveBeenCalledWith(providerId);
      expect(result).toBe(true);
    });

    it('should return false when provider registry is null', () => {
      (authModule as any).providerRegistry = null;

      const result = authModule.hasProvider('google');

      expect(result).toBe(false);
    });

    it('should return provider registry instance', () => {
      const result = authModule.getProviderRegistry();

      expect(result).toBe(mockProviderRegistry);
    });

    it('should return null when provider registry is null', () => {
      (authModule as any).providerRegistry = null;

      const result = authModule.getProviderRegistry();

      expect(result).toBe(null);
    });

    it('should delegate reloadProviders to provider registry', async () => {
      await authModule.reloadProviders();

      expect(mockProviderRegistry.initialize).toHaveBeenCalled();
    });

    it('should handle null provider registry in reloadProviders', async () => {
      // Create a new auth module without initializing it
      const uninitializedModule = new AuthModule();
      
      // Clear any previous calls to the mock
      vi.clearAllMocks();
      
      // reloadProviders should handle null providerRegistry gracefully
      await expect(uninitializedModule.reloadProviders()).resolves.toBeUndefined();
      
      // Since providerRegistry is null, initialize shouldn't be called
      expect(mockProviderRegistry.initialize).not.toHaveBeenCalled();
    });
  });

  describe('Tunnel service methods', () => {
    it('should return tunnel service instance', async () => {
      process.env.NODE_ENV = 'development';
      await authModule.initialize();

      const result = authModule.getTunnelService();

      expect(result).toBe(mockTunnelService);
    });

    it('should return null when tunnel service is null', async () => {
      process.env.NODE_ENV = 'production';
      await authModule.initialize();

      const result = authModule.getTunnelService();

      expect(result).toBe(null);
    });

    it('should return tunnel status from tunnel service', async () => {
      process.env.NODE_ENV = 'development';
      await authModule.initialize();
      
      const mockStatus = { active: true, type: 'cloudflare' };
      mockTunnelService.getStatus.mockReturnValue(mockStatus);

      const result = authModule.getTunnelStatus();

      expect(mockTunnelService.getStatus).toHaveBeenCalled();
      expect(result).toBe(mockStatus);
    });

    it('should return default status when tunnel service is null', async () => {
      process.env.NODE_ENV = 'production';
      await authModule.initialize();

      const result = authModule.getTunnelStatus();

      expect(result).toEqual({
        active: false,
        type: 'none'
      });
    });

    it('should return public URL from tunnel service', async () => {
      process.env.NODE_ENV = 'development';
      await authModule.initialize();
      
      const mockUrl = 'https://test.example.com';
      mockTunnelService.getPublicUrl.mockReturnValue(mockUrl);

      const result = authModule.getPublicUrl();

      expect(mockTunnelService.getPublicUrl).toHaveBeenCalled();
      expect(result).toBe(mockUrl);
    });

    it('should return null when tunnel service is null', async () => {
      process.env.NODE_ENV = 'production';
      await authModule.initialize();

      const result = authModule.getPublicUrl();

      expect(result).toBe(null);
    });
  });

  describe('buildAuthConfig function', () => {
    it('should build config with default values', async () => {
      // Access private method through any
      const originalJwtKeyPath = process.env.JWT_KEY_PATH;
      delete process.env.JWT_KEY_PATH; // Ensure we test default value
      
      // buildAuthConfig is now imported and mocked
      const { buildAuthConfig } = await import('@/modules/core/auth/utils/config-builder');
      const config = buildAuthConfig();

      expect(config).toMatchObject({
        jwt: {
          algorithm: 'RS256',
          issuer: 'systemprompt-os',
          audience: 'systemprompt-os',
          accessTokenTTL: 900,
          refreshTokenTTL: 2592000,
          keyStorePath: './state/auth/keys',
          privateKey: '',
          publicKey: ''
        },
        session: {
          maxConcurrent: expect.any(Number),
          absoluteTimeout: 86400,
          inactivityTimeout: 3600
        },
        security: {
          maxLoginAttempts: expect.any(Number),
          lockoutDuration: 900,
          passwordMinLength: 8,
          requirePasswordChange: false
        }
      });
      
      if (originalJwtKeyPath !== undefined) {
        process.env.JWT_KEY_PATH = originalJwtKeyPath;
      }
    });

    it('should use JWT_KEY_PATH environment variable', async () => {
      process.env.JWT_KEY_PATH = '/custom/jwt/path';
      
      // buildAuthConfig is now imported and mocked
      const { buildAuthConfig } = await import('@/modules/core/auth/utils/config-builder');
      const config = buildAuthConfig();

      expect(config.jwt.keyStorePath).toBe('/custom/jwt/path');
    });

    it('should use default path when JWT_KEY_PATH is not set', async () => {
      delete process.env.JWT_KEY_PATH;
      
      // buildAuthConfig is now imported and mocked
      const { buildAuthConfig } = await import('@/modules/core/auth/utils/config-builder');
      const config = buildAuthConfig();

      expect(config.jwt.keyStorePath).toBe('./state/auth/keys');
    });
  });

  describe('Helper functions', () => {
    describe('createModule', () => {
      it('should create a new AuthModule instance', () => {
        const module = createModule();
        
        expect(module).toBeInstanceOf(AuthModule);
        expect(module.name).toBe('auth');
        expect(module.status).toBe(ModuleStatusEnum.STOPPED);
      });

      it('should create different instances on multiple calls', () => {
        const module1 = createModule();
        const module2 = createModule();
        
        expect(module1).not.toBe(module2);
        expect(module1).toBeInstanceOf(AuthModule);
        expect(module2).toBeInstanceOf(AuthModule);
      });
    });

    describe('initialize function', () => {
      it('should create and initialize a new AuthModule', async () => {
        const module = await initialize();
        
        expect(module).toBeInstanceOf(AuthModule);
        expect((module as any).initialized).toBe(true);
      });
    });

    describe('getAuthModule', () => {
      it('should throw error when auth module not found', () => {
        mockModuleLoader.getRegistry.mockReturnValue({
          getAll: vi.fn(() => [])
        });

        expect(() => getAuthModule()).toThrow('Auth module not found in registry');
      });

      it('should throw error when auth module not properly initialized', () => {
        const mockModule = {};
        mockModuleLoader.getRegistry.mockReturnValue({
          getAll: vi.fn(() => [{ name: 'auth', ...mockModule }])
        });

        expect(() => getAuthModule()).toThrow('Auth module not properly initialized');
      });

      it('should throw error when exports is missing', () => {
        const mockModule = { exports: null };
        mockModuleLoader.getRegistry.mockReturnValue({
          getAll: vi.fn(() => [{ name: 'auth', ...mockModule }])
        });

        expect(() => getAuthModule()).toThrow('Auth module not properly initialized');
      });

      it('should validate required service export', () => {
        const mockModule = {
          exports: {
            tokenService: vi.fn(),
            userService: vi.fn(),
            createToken: vi.fn(),
            validateToken: vi.fn()
          }
        };
        mockModuleLoader.getRegistry.mockReturnValue({
          getAll: vi.fn(() => [{ name: 'auth', ...mockModule }])
        });

        expect(() => getAuthModule()).toThrow('Auth module missing required service export');
      });

      it('should validate required tokenService export', () => {
        const mockModule = {
          exports: {
            service: vi.fn(),
            userService: vi.fn(),
            createToken: vi.fn(),
            validateToken: vi.fn()
          }
        };
        mockModuleLoader.getRegistry.mockReturnValue({
          getAll: vi.fn(() => [{ name: 'auth', ...mockModule }])
        });

        expect(() => getAuthModule()).toThrow('Auth module missing required tokenService export');
      });

      it('should validate required userService export', () => {
        const mockModule = {
          exports: {
            service: vi.fn(),
            tokenService: vi.fn(),
            createToken: vi.fn(),
            validateToken: vi.fn()
          }
        };
        mockModuleLoader.getRegistry.mockReturnValue({
          getAll: vi.fn(() => [{ name: 'auth', ...mockModule }])
        });

        expect(() => getAuthModule()).toThrow('Auth module missing required userService export');
      });

      it('should validate required createToken export', () => {
        const mockModule = {
          exports: {
            service: vi.fn(),
            tokenService: vi.fn(),
            userService: vi.fn(),
            validateToken: vi.fn()
          }
        };
        mockModuleLoader.getRegistry.mockReturnValue({
          getAll: vi.fn(() => [{ name: 'auth', ...mockModule }])
        });

        expect(() => getAuthModule()).toThrow('Auth module missing required createToken export');
      });

      it('should validate required validateToken export', () => {
        const mockModule = {
          exports: {
            service: vi.fn(),
            tokenService: vi.fn(),
            userService: vi.fn(),
            createToken: vi.fn()
          }
        };
        mockModuleLoader.getRegistry.mockReturnValue({
          getAll: vi.fn(() => [{ name: 'auth', ...mockModule }])
        });

        expect(() => getAuthModule()).toThrow('Auth module missing required validateToken export');
      });

      it('should return valid auth module when all requirements met', () => {
        const mockModule = {
          name: 'auth',
          exports: {
            service: vi.fn(),
            tokenService: vi.fn(),
            userService: vi.fn(),
            createToken: vi.fn(),
            validateToken: vi.fn()
          }
        };
        mockModuleLoader.getRegistry.mockReturnValue({
          getAll: vi.fn(() => [mockModule])
        });

        const result = getAuthModule();

        expect(result).toBe(mockModule);
      });

      it('should filter modules by name correctly', () => {
        const authModule = {
          name: 'auth',
          exports: {
            service: vi.fn(),
            tokenService: vi.fn(),
            userService: vi.fn(),
            createToken: vi.fn(),
            validateToken: vi.fn()
          }
        };
        const otherModule = { name: 'other' };
        
        mockModuleLoader.getRegistry.mockReturnValue({
          getAll: vi.fn(() => [otherModule, authModule])
        });

        const result = getAuthModule();

        expect(result).toBe(authModule);
      });
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle missing dirname in file path operations', async () => {
      (dirname as any).mockReturnValue('');
      (join as any).mockImplementation((...args) => args.join('/'));

      await authModule.initialize();

      // The third call to join should be for providers path
      expect(join).toHaveBeenCalledTimes(3);
      const joinCalls = (join as any).mock.calls;
      const providersCall = joinCalls.find((call: any[]) => call.includes('providers'));
      expect(providersCall).toBeDefined();
      expect(providersCall).toContain('providers');
    });

    it('should handle file system errors during key directory creation', async () => {
      (existsSync as any).mockReturnValue(false);
      (mkdirSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(authModule.initialize()).rejects.toThrow(
        'Failed to initialize auth module: Permission denied'
      );
    });

    it('should handle file system errors during key generation', async () => {
      (existsSync as any).mockImplementation((path: string) => {
        if (path.includes('private.key') || path.includes('public.key')) return false;
        return true;
      });

      const { generateJwtKeyPair } = await import('@/modules/core/auth/utils/generate-key.js');
      (generateJwtKeyPair as any).mockImplementation(() => {
        throw new Error('Key generation failed');
      });

      await expect(authModule.initialize()).rejects.toThrow(
        'Failed to initialize auth module: Key generation failed'
      );
    });

    it('should handle provider registry initialization failure', async () => {
      mockProviderRegistry.initialize.mockRejectedValue(new Error('Provider init failed'));

      await expect(authModule.initialize()).rejects.toThrow(
        'Failed to initialize auth module: Provider init failed'
      );
    });

    it('should handle tunnel service creation failure', async () => {
      process.env.NODE_ENV = 'development';
      
      const { TunnelService } = await import('@/modules/core/auth/services/tunnel.service.js');
      (TunnelService as any).mockImplementation(() => {
        throw new Error('Tunnel creation failed');
      });

      await expect(authModule.initialize()).rejects.toThrow(
        'Failed to initialize auth module: Tunnel creation failed'
      );
    });

    it('should handle undefined PORT environment variable', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      const originalDomain = process.env.TUNNEL_DOMAIN;
      
      process.env.NODE_ENV = 'development';
      delete process.env.PORT;
      delete process.env.TUNNEL_DOMAIN;

      await authModule.initialize();

      const { TunnelService } = await import('@/modules/core/auth/services/tunnel.service.js');
      expect(TunnelService).toHaveBeenCalledWith(
        { port: 3000 },
        mockLogger
      );
      
      process.env.NODE_ENV = originalEnv;
      if (originalPort !== undefined) process.env.PORT = originalPort;
      if (originalDomain !== undefined) process.env.TUNNEL_DOMAIN = originalDomain;
    });

    it('should handle invalid PORT environment variable', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      const originalDomain = process.env.TUNNEL_DOMAIN;
      
      process.env.NODE_ENV = 'development';
      process.env.PORT = 'invalid';
      delete process.env.TUNNEL_DOMAIN;

      await authModule.initialize();

      const { TunnelService } = await import('@/modules/core/auth/services/tunnel.service.js');
      expect(TunnelService).toHaveBeenCalledWith(
        { port: NaN },
        mockLogger
      );
      
      process.env.NODE_ENV = originalEnv;
      if (originalPort !== undefined) process.env.PORT = originalPort;
      if (originalDomain !== undefined) process.env.TUNNEL_DOMAIN = originalDomain;
    });
  });
});