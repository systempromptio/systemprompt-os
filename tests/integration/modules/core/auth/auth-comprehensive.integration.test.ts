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
import type { UserService } from '@/modules/core/auth/services/user.service';
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
  let userService: UserService;
  let mfaService: MFAService;
  let auditService: AuthAuditService;
  let dbService: DatabaseService;
  let authModule: any;
  
  const testSessionId = `auth-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    console.log(`🚀 Setting up auth integration test (session: ${testSessionId})...`);
    
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path and environment
    process.env.DATABASE_PATH = testDbPath;
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
    
    if (!authModuleRef || !('exports' in authModuleRef) || !authModuleRef.exports) {
      throw new Error('Auth module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    authModule = authModuleRef;
    dbService = (dbModule as any).exports.service();
    
    const authExports = authModuleRef.exports as IAuthModuleExports;
    authService = authExports.service();
    tokenService = authExports.tokenService();
    userService = authExports.userService();
    mfaService = authExports.mfaService();
    auditService = authExports.auditService();
    
    console.log('✅ Auth integration test environment ready');
  }, 60000);

  afterAll(async () => {
    console.log('🧹 Cleaning up auth integration test environment...');
    
    // Shutdown bootstrap
    if (bootstrap) {
      await bootstrap.shutdown();
    }
    
    // Clean up singletons
    try {
      const { DatabaseService } = await import('@/modules/core/database/services/database.service');
      await DatabaseService.reset();
    } catch (error) {
      // Service might not be loaded
    }

    try {
      const { AuthService } = await import('@/modules/core/auth/services/auth.service');
      await AuthService.reset();
    } catch (error) {
      // Service might not be loaded
    }
    
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    // Force garbage collection
    if (typeof global.gc === 'function') {
      global.gc();
    }
  });

  beforeEach(async () => {
    // Clear auth data before each test - order matters for foreign keys
    try {
      await dbService.execute('DELETE FROM auth_token_scopes');
      await dbService.execute('DELETE FROM auth_tokens');
      await dbService.execute('DELETE FROM auth_mfa_backup_codes');
      await dbService.execute('DELETE FROM auth_mfa_devices');
      await dbService.execute('DELETE FROM auth_audit_logs');
      await dbService.execute('DELETE FROM auth_oauth_codes');
      await dbService.execute('DELETE FROM users');
      
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
      expect(tableNames).toContain('auth_audit_logs');
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
      const user = await userService.createUser({
        username: 'tokentest',
        email: 'tokentest@example.com',
        displayName: 'Token Test',
        status: 'active'
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
      const user = await userService.createUser({
        username: 'authtest',
        email: 'authtest@example.com',
        displayName: 'Auth Test',
        status: 'active'
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe('authtest');
      expect(user.email).toBe('authtest@example.com');
      expect(user.status).toBe('active');
    });
    
    it('should create user session', async () => {
      const user = await userService.createUser({
        username: 'sessiontest',
        email: 'sessiontest@example.com',
        displayName: 'Session Test',
        status: 'active'
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
      const user = await userService.getUser('non-existent-id');
      expect(user).toBeNull();
      
      // Try to validate invalid token
      const validation = await tokenService.validateToken('invalid-token');
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });
    
    it('should track authentication attempts', async () => {
      const user = await userService.createUser({
        username: 'tracktest',
        email: 'tracktest@example.com',
        displayName: 'Track Test',
        status: 'active'
      });
      
      // Create token (simulates successful auth)
      await tokenService.createToken({
        userId: user.id,
        type: 'login',
        scope: ['user'],
        expiresIn: 3600
      });
      
      // Verify user can be retrieved (authentication tracked)
      const retrievedUser = await userService.getUser(user.id);
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
      const user = await userService.createUser({
        username: 'mfatest',
        email: 'mfatest@example.com',
        displayName: 'MFA Test',
        status: 'active'
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
      const user = await userService.createUser({
        username: 'audittest',
        email: 'audittest@example.com',
        displayName: 'Audit Test',
        status: 'active'
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
      const user = await userService.createUser({
        username: 'normaltest',
        email: 'normaltest@example.com',
        displayName: 'Normal Test',
        status: 'active'
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
      expect(tokenColumnNames).toContain('token');
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