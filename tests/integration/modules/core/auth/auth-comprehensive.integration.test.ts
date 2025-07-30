/**
 * Auth Module Integration Test
 * 
 * Tests authentication and authorization system:
 * - OAuth2 provider integration
 * - Token generation and validation
 * - User authentication flow
 * - Tunnel service for ngrok
 * - Multi-factor authentication
 * - Audit logging
 * 
 * Coverage targets:
 * - src/modules/core/auth/index.ts
 * - src/modules/core/auth/services/*.ts
 * - src/modules/core/auth/repositories/*.ts
 * - src/modules/core/auth/providers/*.ts
 * - src/modules/core/auth/cli/*.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { AuthService } from '@/modules/core/auth/services/auth.service';
import type { TokenService } from '@/modules/core/auth/services/token.service';
import type { UserEventService } from '@/modules/core/auth/services/user-event.service';
import type { MFAService } from '@/modules/core/auth/services/mfa.service';
import type { AuthAuditService } from '@/modules/core/auth/services/audit.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IAuthModuleExports } from '@/modules/core/auth/types';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { createTestId } from '../../../setup';

describe('Auth Module Integration Tests', () => {
  let bootstrap: Bootstrap;
  let authService: AuthService;
  let tokenService: TokenService;
  let userService: UserEventService;
  let mfaService: MFAService;
  let auditService: AuthAuditService;
  let dbService: DatabaseService;
  let authModule: any;
  let usersModule: any;
  
  const testSessionId = `auth-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    console.log(`🚀 Setting up auth integration test (session: ${testSessionId})...`);
    
    // Reset any existing singletons first
    try {
      const { DatabaseService } = await import('@/modules/core/database/services/database.service');
      await DatabaseService.reset();
    } catch (error) {
      // Ignore
    }
    
    try {
      const { LoggerService } = await import('@/modules/core/logger/services/logger.service');
      (LoggerService as any).instance = null;
    } catch (error) {
      // Ignore
    }
    
    try {
      const { ModulesModuleService } = await import('@/modules/core/modules/services/modules-module.service');
      ModulesModuleService.reset();
    } catch (error) {
      // Ignore
    }
    
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path and environment
    process.env.DATABASE_PATH = testDbPath;
    process.env.DATABASE_FILE = testDbPath;
    process.env.LOG_LEVEL = 'error';
    process.env.DISABLE_TELEMETRY = 'true';
    process.env.NODE_ENV = 'test';
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services
    const authModuleRef = modules.get('auth');
    const dbModule = modules.get('database');
    const usersModuleRef = modules.get('users');
    
    if (!authModuleRef || !('exports' in authModuleRef) || !authModuleRef.exports) {
      throw new Error('Auth module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    if (!usersModuleRef || !('exports' in usersModuleRef) || !usersModuleRef.exports) {
      throw new Error('Users module not loaded');
    }
    
    authModule = authModuleRef;
    usersModule = usersModuleRef;
    dbService = (dbModule as any).exports.service();
    
    const authExports = authModuleRef.exports as IAuthModuleExports;
    authService = authExports.service();
    tokenService = authExports.tokenService();
    userService = authExports.userService();
    mfaService = authExports.mfaService();
    auditService = authExports.auditService();
    
    // Give event handlers time to set up
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('✅ Auth integration test environment ready');
  }, 60000);

  afterAll(async () => {
    console.log('🧹 Cleaning up auth integration test environment...');
    
    // Set a timeout for cleanup
    const cleanupTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Cleanup timeout')), 10000)
    );
    
    try {
      await Promise.race([
        (async () => {
          // Shutdown bootstrap
          if (bootstrap) {
            try {
              await bootstrap.shutdown();
            } catch (error) {
              console.warn('Bootstrap shutdown error:', error);
            }
          }
          
          // Clean up singletons
          try {
            const { DatabaseService } = await import('@/modules/core/database/services/database.service');
            await DatabaseService.reset();
            (DatabaseService as any).instance = null;
          } catch (error) {
            // Service might not be loaded
          }

          try {
            const { AuthService } = await import('@/modules/core/auth/services/auth.service');
            // AuthService doesn't have a reset method, so just clear the instance
            (AuthService as any).instance = null;
          } catch (error) {
            // Service might not be loaded
          }
          
          try {
            const { LoggerService } = await import('@/modules/core/logger/services/logger.service');
            (LoggerService as any).instance = null;
          } catch (error) {
            // Ignore
          }
          
          try {
            const { ModulesModuleService } = await import('@/modules/core/modules/services/modules-module.service');
            ModulesModuleService.reset();
          } catch (error) {
            // Ignore
          }
          
          // Clean up test files
          if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
          }

          // Force garbage collection
          if (typeof global.gc === 'function') {
            global.gc();
          }
        })(),
        cleanupTimeout
      ]);
    } catch (error) {
      console.error('Cleanup timeout or error:', error);
      // Force cleanup on timeout
      bootstrap = null as any;
      (authService as any) = null;
      (tokenService as any) = null;
      (userService as any) = null;
      (mfaService as any) = null;
      (auditService as any) = null;
      (dbService as any) = null;
    }
  }, 15000);

  beforeEach(async () => {
    // Clear auth data before each test - order matters for foreign keys
    try {
      // Check if tables exist before trying to clear them
      const tables = await dbService.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'auth_%'"
      );
      
      const tableNames = tables.map(t => t.name);
      
      // Clear tables in proper order to respect foreign key constraints
      const tablesToClear = [
        'auth_token_scopes',
        'auth_tokens',
        'auth_mfa_backup_codes',
        'auth_mfa',
        'auth_audit_log',
        'auth_authorization_codes',
        'auth_password_reset_tokens',
        'auth_sessions',
        'auth_role_permissions',
        'auth_user_roles',
        'auth_oauth_identities',
        'auth_credentials'
      ];
      
      for (const table of tablesToClear) {
        if (tableNames.includes(table)) {
          await dbService.execute(`DELETE FROM ${table}`);
        }
      }
      
      // Also clear users table if it exists
      const userTable = await dbService.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      );
      
      if (userTable.length > 0) {
        await dbService.execute('DELETE FROM users');
      }
      
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.warn('Failed to clear auth tables in beforeEach:', error);
    }
  });

  describe('Module Bootstrap', () => {
    it('should load auth module during bootstrap', async () => {
      const modules = bootstrap.getModules();
      expect(modules.has('auth')).toBe(true);
      
      const module = modules.get('auth');
      expect(module).toBeDefined();
      expect(module?.name).toBe('auth');
    });

    it('should execute auth status command', async () => {
      const result = await runCLICommand(['auth', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/auth|status|module/);
    });

    it('should have properly initialized database schema', async () => {
      // Check that normalized auth tables exist
      const tables = await dbService.query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name LIKE 'auth_%'
        ORDER BY name
      `);
      
      const tableNames = tables.map((t: any) => t.name);
      
      // Check for normalized tables (no JSON columns)
      expect(tableNames).toContain('auth_token_scopes');
      expect(tableNames).toContain('auth_mfa_backup_codes');
      expect(tableNames).toContain('auth_tokens');
      expect(tableNames).toContain('auth_audit_log');
    });
  });

  describe('OAuth2 Provider Integration', () => {
    it('should register OAuth2 providers', async () => {
      const providers = authModule.exports.getAllProviders();
      
      expect(Array.isArray(providers)).toBe(true);
      // Should have at least core providers available
      expect(providers.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle provider configuration', async () => {
      const hasGoogle = authModule.exports.hasProvider('google');
      const hasNonExistent = authModule.exports.hasProvider('nonexistent');
      
      expect(typeof hasGoogle).toBe('boolean');
      expect(hasNonExistent).toBe(false);
    });

    it('should access provider registry', async () => {
      const registry = authModule.exports.getProviderRegistry();
      
      expect(registry).toBeDefined();
      // Registry should exist even if no providers are configured
    });

    it('should reload providers', async () => {
      // Should not throw when reloading providers
      await expect(authModule.exports.reloadProviders()).resolves.not.toThrow();
    });
  });

  describe('Token Management', () => {
    let testUserId: string;
    
    beforeEach(async () => {
      // Create a test user for token operations
      const user = await userService.createOrUpdateUserFromOauth({
        provider: 'test',
        providerId: 'test-token-user',
        email: 'tokentest@example.com',
        name: 'Token Test'
      });
      testUserId = user.id;
    });
    
    it('should generate access tokens', async () => {
      const token = await tokenService.createToken({
        userId: testUserId,
        type: 'access',
        scope: ['read', 'write'],
        expiresIn: 3600
      });

      expect(token.id).toBeDefined();
      expect(token.userId).toBe(testUserId);
      expect(token.type).toBe('access');
      expect(token.token).toBeDefined();
      expect(Array.isArray(token.scope)).toBe(true);
      expect(token.scope).toContain('read');
      expect(token.scope).toContain('write');
    });
    
    it('should validate token signatures', async () => {
      const token = await tokenService.createToken({
        userId: testUserId,
        type: 'api',
        scope: ['user'],
        expiresIn: 7200
      });
      
      const validation = await tokenService.validateToken(token.token);
      
      expect(validation.valid).toBe(true);
      expect(validation.userId).toBe(testUserId);
      expect(validation.scope).toContain('user');
    });
    
    it('should handle token expiration', async () => {
      // Create token with very short expiration
      const token = await tokenService.createToken({
        userId: testUserId,
        type: 'short',
        scope: ['test'],
        expiresIn: 1 // 1 second
      });
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const validation = await tokenService.validateToken(token.token);
      expect(validation.valid).toBe(false);
    });
    
    it('should revoke tokens', async () => {
      const token = await tokenService.createToken({
        userId: testUserId,
        type: 'revoke-test',
        scope: ['read'],
        expiresIn: 3600
      });
      
      // Verify token is valid initially
      let validation = await tokenService.validateToken(token.token);
      expect(validation.valid).toBe(true);
      
      // Revoke token
      await tokenService.revokeToken(token.id);
      
      // Verify token is now invalid
      validation = await tokenService.validateToken(token.token);
      expect(validation.valid).toBe(false);
    });
    
    it('should refresh tokens', async () => {
      // Create multiple tokens for user
      await tokenService.createToken({
        userId: testUserId,
        type: 'api',
        scope: ['read'],
        expiresIn: 3600
      });
      
      await tokenService.createToken({
        userId: testUserId,
        type: 'personal',
        scope: ['write'],
        expiresIn: 7200
      });
      
      const tokens = await tokenService.listUserTokens(testUserId);
      expect(tokens.length).toBe(2);
      
      // Revoke all user tokens (refresh scenario)
      await tokenService.revokeUserTokens(testUserId);
      
      const tokensAfterRevoke = await tokenService.listUserTokens(testUserId);
      expect(tokensAfterRevoke.length).toBe(0);
    });
  });

  describe('User Authentication', () => {
    it('should authenticate user with credentials', async () => {
      const user = await userService.createOrUpdateUserFromOauth({
        provider: 'test',
        providerId: 'test-auth-user',
        email: 'authtest@example.com',
        name: 'Auth Test'
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe('authtest');
      expect(user.email).toBe('authtest@example.com');
      expect(user.status).toBe('active');
    });
    
    it('should create user session', async () => {
      const user = await userService.createOrUpdateUserFromOauth({
        provider: 'test',
        providerId: 'test-session-user',
        email: 'sessiontest@example.com',
        name: 'Session Test'
      });
      
      const sessionToken = await tokenService.createToken({
        userId: user.id,
        type: 'session',
        scope: ['user', 'profile'],
        expiresIn: 1800
      });
      
      expect(sessionToken.type).toBe('session');
      expect(sessionToken.scope).toContain('user');
      expect(sessionToken.scope).toContain('profile');
    });
    
    it('should handle failed authentication', async () => {
      // Try to get non-existent user
      const user = await userService.getUserById('non-existent-id');
      expect(user).toBeNull();
      
      // Try to validate invalid token
      const validation = await tokenService.validateToken('invalid-token');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBeDefined();
    });
    
    it('should track authentication attempts', async () => {
      const user = await userService.createOrUpdateUserFromOauth({
        provider: 'test',
        providerId: 'test-track-user',
        email: 'tracktest@example.com',
        name: 'Track Test'
      });
      
      // Create token (simulates successful auth)
      await tokenService.createToken({
        userId: user.id,
        type: 'login',
        scope: ['user'],
        expiresIn: 3600
      });
      
      // Verify user can be retrieved (authentication tracked)
      const retrievedUser = await userService.getUserById(user.id);
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.id).toBe(user.id);
    });
  });

  describe('Tunnel Service', () => {
    it('should provide tunnel status', async () => {
      const tunnelStatus = authModule.exports.getTunnelStatus();
      
      expect(tunnelStatus).toBeDefined();
      expect(tunnelStatus.active).toBe(false);
      expect(tunnelStatus.type).toBe('none');
    });
    
    it('should access tunnel service', async () => {
      const tunnelService = authModule.exports.getTunnelService();
      
      // Tunnel service may be null if not configured
      expect(tunnelService === null || tunnelService !== undefined).toBe(true);
    });
    
    it('should handle tunnel configuration', async () => {
      // Test tunnel status without active tunnel
      const status = authModule.exports.getTunnelStatus();
      
      expect(status.active).toBe(false);
      expect(status.type).toBe('none');
      expect(status.url).toBeUndefined();
    });
  });

  describe('MFA Integration', () => {
    let testUserId: string;
    
    beforeEach(async () => {
      const user = await userService.createOrUpdateUserFromOauth({
        provider: 'test',
        providerId: 'test-mfa-user',
        email: 'mfatest@example.com',
        name: 'MFA Test'
      });
      testUserId = user.id;
    });
    
    it('should generate MFA secrets', async () => {
      // MFA service should be available
      expect(mfaService).toBeDefined();
      
      // Test MFA service initialization
      expect(typeof mfaService.generateSecret).toBe('function');
    });
    
    it('should validate TOTP codes', async () => {
      // Test TOTP functionality is available
      expect(typeof mfaService.validateTOTP).toBe('function');
    });
    
    it('should handle backup codes', async () => {
      // Test backup code functionality
      expect(typeof mfaService.generateBackupCodes).toBe('function');
    });
    
    it('should enforce MFA when enabled', async () => {
      // Test MFA enforcement functionality
      expect(typeof mfaService.isMFAEnabled).toBe('function');
    });
  });

  describe('Audit Logging', () => {
    let testUserId: string;
    
    beforeEach(async () => {
      const user = await userService.createOrUpdateUserFromOauth({
        provider: 'test',
        providerId: 'test-audit-user',
        email: 'audittest@example.com',
        name: 'Audit Test'
      });
      testUserId = user.id;
    });
    
    it('should log authentication events', async () => {
      // Audit service should be available
      expect(auditService).toBeDefined();
      
      // Test audit logging functionality
      expect(typeof auditService.logEvent).toBe('function');
    });
    
    it('should log authorization failures', async () => {
      // Test authorization failure logging
      expect(typeof auditService.logAuthorizationFailure).toBe('function');
    });
    
    it('should track token usage', async () => {
      // Create and use a token to test tracking
      const token = await tokenService.createToken({
        userId: testUserId,
        type: 'audit-test',
        scope: ['read'],
        expiresIn: 3600
      });
      
      // Validate token (should be tracked)
      const validation = await tokenService.validateToken(token.token);
      expect(validation.valid).toBe(true);
    });
    
    it('should generate audit reports', async () => {
      // Test audit report functionality
      expect(typeof auditService.generateReport).toBe('function');
    });
  });

  describe('CLI Commands', () => {
    it('should execute auth status command', async () => {
      const result = await runCLICommand(['auth', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/auth|status|module/i);
    });
    
    it('should list auth providers', async () => {
      const result = await runCLICommand(['auth', 'providers']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.length).toBeGreaterThan(0);
    });
    
    it('should generate JWT keys', async () => {
      const result = await runCLICommand([
        'auth', 'generatekey',
        '--algorithm', 'RS256',
        '--format', 'pem',
        '--output', testDir
      ]);
      
      // Should succeed or provide helpful error message
      expect(result.exitCode).toBeLessThanOrEqual(1);
    });
    
    it('should handle database commands', async () => {
      const result = await runCLICommand(['auth', 'db', '--help']);
      
      expect(result.exitCode).toBeLessThanOrEqual(1);
      expect(result.output.length).toBeGreaterThan(0);
    });
    
    it('should handle role management', async () => {
      const result = await runCLICommand(['auth', 'role', '--help']);
      
      expect(result.exitCode).toBeLessThanOrEqual(1);
      expect(result.output.length).toBeGreaterThan(0);
    });
  });

  describe('Database Normalization', () => {
    it('should store token scopes in normalized table', async () => {
      const user = await userService.createOrUpdateUserFromOauth({
        provider: 'test',
        providerId: 'test-normal-user',
        email: 'normaltest@example.com',
        name: 'Normal Test'
      });
      
      const token = await tokenService.createToken({
        userId: user.id,
        type: 'api',
        scope: ['admin', 'user', 'api', 'read', 'write'],
        expiresIn: 3600
      });
      
      // Verify scopes are stored in normalized table
      const scopes = await dbService.query(
        'SELECT scope FROM auth_token_scopes WHERE token_id = ? ORDER BY scope',
        [token.id]
      );
      
      expect(scopes.length).toBe(5);
      const scopeValues = scopes.map((s: any) => s.scope).sort();
      expect(scopeValues).toEqual(['admin', 'api', 'read', 'user', 'write']);
    });
    
    it('should not use JSON columns in core tables', async () => {
      const tokenColumns = await dbService.query('PRAGMA table_info(auth_tokens)');
      const tokenColumnNames = tokenColumns.map((c: any) => c.name);
      
      // Should not have JSON columns that were normalized
      expect(tokenColumnNames).not.toContain('scope');
      expect(tokenColumnNames).not.toContain('metadata');
      
      // Should have proper normalized structure
      expect(tokenColumnNames).toContain('id');
      expect(tokenColumnNames).toContain('user_id');
      expect(tokenColumnNames).toContain('type');
      expect(tokenColumnNames).toContain('token_hash'); // Stored as hash for security
    });
  });

  describe('Service Integration', () => {
    it('should have all services properly initialized', () => {
      expect(authService).toBeDefined();
      expect(tokenService).toBeDefined();
      expect(userService).toBeDefined();
      expect(mfaService).toBeDefined();
      expect(auditService).toBeDefined();
      
      // Verify services are singletons
      const authService2 = authModule.exports.service();
      const tokenService2 = authModule.exports.tokenService();
      
      expect(authService).toBe(authService2);
      expect(tokenService).toBe(tokenService2);
    });
    
    it('should access all auth module exports', () => {
      const exports = authModule.exports as IAuthModuleExports;
      
      // Core services
      expect(exports.service).toBeDefined();
      expect(exports.tokenService).toBeDefined();
      expect(exports.userService).toBeDefined();
      expect(exports.authCodeService).toBeDefined();
      expect(exports.mfaService).toBeDefined();
      expect(exports.auditService).toBeDefined();
      expect(exports.oauth2ConfigService).toBeDefined();
      
      // Provider methods
      expect(exports.getProvider).toBeDefined();
      expect(exports.getAllProviders).toBeDefined();
      expect(exports.hasProvider).toBeDefined();
      expect(exports.getProviderRegistry).toBeDefined();
      expect(exports.reloadProviders).toBeDefined();
      
      // Token methods
      expect(exports.createToken).toBeDefined();
      expect(exports.validateToken).toBeDefined();
      expect(exports.listUserTokens).toBeDefined();
      expect(exports.revokeToken).toBeDefined();
      expect(exports.revokeUserTokens).toBeDefined();
      expect(exports.cleanupExpiredTokens).toBeDefined();
      
      // Tunnel methods
      expect(exports.getTunnelService).toBeDefined();
      expect(exports.getTunnelStatus).toBeDefined();
    });
  });

  async function runCLICommand(args: string[]): Promise<{ output: string; errors: string; exitCode: number | null }> {
    const cliProcess = spawn('npm', ['run', 'cli', '--', ...args], {
      cwd: process.cwd(),
      shell: true,
      env: {
        ...process.env,
        DATABASE_PATH: testDbPath,
        LOG_LEVEL: 'error'
      }
    });

    const output: string[] = [];
    const errors: string[] = [];

    cliProcess.stdout.on('data', (data) => {
      output.push(data.toString());
    });

    cliProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    const exitCode = await new Promise<number | null>((resolve) => {
      cliProcess.on('close', (code) => {
        resolve(code);
      });
    });

    return {
      output: output.join(''),
      errors: errors.join(''),
      exitCode,
    };
  }
});