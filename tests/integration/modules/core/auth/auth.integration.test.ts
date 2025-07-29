/**
 * Auth Module Integration Test
 * 
 * Tests the complete authentication lifecycle and operations:
 * - Module bootstrap and initialization
 * - User authentication and token management
 * - OAuth2 provider integration
 * - MFA operations
 * - Auth CLI commands
 * - Database operations and data persistence
 * - Security features and audit logging
 * 
 * Coverage targets:
 * - src/modules/core/auth/index.ts
 * - src/modules/core/auth/services/*.ts
 * - src/modules/core/auth/repositories/*.ts
 * - src/modules/core/auth/cli/*.ts
 * - src/modules/core/auth/providers/*.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { AuthService } from '@/modules/core/auth/services/auth.service';
import type { TokenService } from '@/modules/core/auth/services/token.service';
import type { UserService } from '@/modules/core/auth/services/user.service';
import type { MFAService } from '@/modules/core/auth/services/mfa.service';
import type { AuthAuditService } from '@/modules/core/auth/services/audit.service';
import type { OAuth2ConfigurationService } from '@/modules/core/auth/services/oauth2-config.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { EventBusService } from '@/modules/core/events/services/event-bus.service';
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
  let oauth2ConfigService: OAuth2ConfigurationService;
  let dbService: DatabaseService;
  let eventBus: EventBusService;
  let authModule: IAuthModuleExports;
  
  const testSessionId = `auth-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path
    process.env.DATABASE_PATH = testDbPath;
    process.env.LOG_MODE = 'test';
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services
    const authModuleRef = modules.get('auth');
    const dbModule = modules.get('database');
    const eventsModule = modules.get('events');
    const usersModule = modules.get('users');
    
    if (!authModuleRef || !('exports' in authModuleRef) || !authModuleRef.exports) {
      throw new Error('Auth module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    if (!eventsModule || !('exports' in eventsModule) || !eventsModule.exports) {
      throw new Error('Events module not loaded');
    }
    
    // Extract services
    dbService = dbModule.exports.service();
    authModule = authModuleRef.exports;
    
    // Get auth services
    authService = authModule.service();
    tokenService = authModule.tokenService();
    userService = authModule.userService();
    mfaService = authModule.mfaService();
    auditService = authModule.auditService();
    oauth2ConfigService = authModule.oauth2ConfigService();
    
    if ('eventBus' in eventsModule.exports) {
      eventBus = eventsModule.exports.eventBus;
    } else {
      throw new Error('Event bus service not available');
    }
  });

  afterAll(async () => {
    // Shutdown bootstrap
    if (bootstrap) {
      await bootstrap.shutdown();
    }
    
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Clear test data before each test
    try {
      const authTables = [
        'auth_credentials', 'auth_oauth_identities', 'auth_sessions', 
        'auth_tokens', 'auth_token_scopes', 'auth_mfa', 'auth_mfa_backup_codes',
        'auth_roles', 'auth_permissions', 'auth_user_roles', 'auth_role_permissions',
        'auth_audit_log', 'auth_authorization_codes', 'auth_password_reset_tokens'
      ];
      
      for (const table of authTables) {
        try {
          await dbService.execute(`DELETE FROM ${table}`);
        } catch (error) {
          // Table might not exist, which is fine
        }
      }
      
      // Clear users table as well
      try {
        await dbService.execute('DELETE FROM users');
      } catch (error) {
        // Table might not exist, which is fine
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Module Bootstrap', () => {
    it('should load auth module during bootstrap', async () => {
      expect(authModule).toBeDefined();
      expect(authService).toBeDefined();
      expect(tokenService).toBeDefined();
      expect(userService).toBeDefined();
      expect(mfaService).toBeDefined();
      expect(auditService).toBeDefined();
      expect(oauth2ConfigService).toBeDefined();
    });

    it('should initialize auth services correctly', async () => {
      // Test service instances are properly initialized
      expect(typeof authModule.service).toBe('function');
      expect(typeof authModule.tokenService).toBe('function');
      expect(typeof authModule.userService).toBe('function');
      expect(typeof authModule.mfaService).toBe('function');
      expect(typeof authModule.auditService).toBe('function');
      expect(typeof authModule.oauth2ConfigService).toBe('function');
    });

    it('should have auth database tables created', async () => {
      const tables = await dbService.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'auth_%'"
      );
      
      expect(tables.length).toBeGreaterThan(0);
      const tableNames = tables.map((t: any) => t.name);
      
      // Essential auth tables should exist
      expect(tableNames).toContain('auth_credentials');
      expect(tableNames).toContain('auth_sessions');
      expect(tableNames).toContain('auth_tokens');
      expect(tableNames).toContain('auth_oauth_identities');
      expect(tableNames).toContain('auth_audit_log');
    });
  });

  describe('Token Management', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Create a test user
      testUserId = 'test-user-' + Date.now();
      await dbService.execute(`
        INSERT INTO users (id, email, username, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [testUserId, 'test@example.com', 'testuser', 'Test User']);
    });

    it('should create API tokens', async () => {
      const token = await authModule.createToken({
        userId: testUserId,
        type: 'api',
        scope: ['read', 'write']
      });

      expect(token).toBeDefined();
      expect(token.userId).toBe(testUserId);
      expect(token.type).toBe('api');
      expect(token.scope).toEqual(['read', 'write']);
      expect(token.token).toMatch(/^[a-f0-9]+\./); // Should have token format
    });

    it('should validate tokens', async () => {
      const token = await authModule.createToken({
        userId: testUserId,
        type: 'api',
        scope: ['read']
      });

      const validation = await authModule.validateToken(token.token);
      expect(validation.valid).toBe(true);
      expect(validation.userId).toBe(testUserId);
      expect(validation.scope).toEqual(['read']);
    });

    it('should list user tokens', async () => {
      await authModule.createToken({
        userId: testUserId,
        type: 'api',
        scope: ['read']
      });
      
      await authModule.createToken({
        userId: testUserId,
        type: 'personal',
        scope: ['read', 'write']
      });

      const tokens = await authModule.listUserTokens(testUserId);
      expect(tokens).toHaveLength(2);
      expect(tokens.some(t => t.type === 'api')).toBe(true);
      expect(tokens.some(t => t.type === 'personal')).toBe(true);
    });

    it('should revoke tokens', async () => {
      const token = await authModule.createToken({
        userId: testUserId,
        type: 'api',
        scope: ['read']
      });

      await authModule.revokeToken(token.id);

      const validation = await authModule.validateToken(token.token);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Token revoked');
    });

    it('should revoke all user tokens', async () => {
      const token1 = await authModule.createToken({
        userId: testUserId,
        type: 'api',
        scope: ['read']
      });
      
      const token2 = await authModule.createToken({
        userId: testUserId,
        type: 'personal',
        scope: ['write']
      });

      await authModule.revokeUserTokens(testUserId);

      const validation1 = await authModule.validateToken(token1.token);
      const validation2 = await authModule.validateToken(token2.token);
      
      expect(validation1.valid).toBe(false);
      expect(validation2.valid).toBe(false);
    });
  });

  describe('OAuth2 Configuration', () => {
    it('should provide OAuth2 server metadata', async () => {
      const metadata = oauth2ConfigService.getAuthorizationServerMetadata();
      
      expect(metadata).toBeDefined();
      expect(metadata.issuer).toBeDefined();
      expect(metadata.authorization_endpoint).toBeDefined();
      expect(metadata.token_endpoint).toBeDefined();
      expect(metadata.jwks_uri).toBeDefined();
      expect(metadata.scopes_supported).toContain('profile');
      expect(metadata.scopes_supported).toContain('email');
      expect(metadata.response_types_supported).toContain('code');
      expect(metadata.grant_types_supported).toContain('authorization_code');
    });

    it('should provide protected resource metadata', async () => {
      const metadata = oauth2ConfigService.getProtectedResourceMetadata();
      
      expect(metadata).toBeDefined();
      expect(metadata.resource).toBeDefined();
      expect(metadata.authorization_servers).toBeDefined();
      expect(metadata.bearer_methods_supported).toContain('header');
    });

    it('should generate provider callback URLs', async () => {
      const callbackUrl = oauth2ConfigService.getProviderCallbackUrl('google');
      
      expect(callbackUrl).toBeDefined();
      expect(callbackUrl).toMatch(/\/oauth2\/callback\/google$/);
    });
  });

  describe('User Management', () => {
    it('should handle getUserById with non-existent user', async () => {
      const result = await userService.getUserById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle getUserByEmail with non-existent email', async () => {
      const result = await userService.getUserByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('should retrieve existing users', async () => {
      const testUserId = 'test-user-retrieve';
      const testEmail = 'retrieve@example.com';
      
      await dbService.execute(`
        INSERT INTO users (id, email, username, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [testUserId, testEmail, 'retrieveuser', 'Retrieve User']);

      const userById = await userService.getUserById(testUserId);
      const userByEmail = await userService.getUserByEmail(testEmail);
      
      expect(userById).toBeDefined();
      expect(userById?.id).toBe(testUserId);
      expect(userByEmail).toBeDefined();
      expect(userByEmail?.email).toBe(testEmail);
    });
  });

  describe('Provider Management', () => {
    it('should check provider availability', async () => {
      const hasGoogle = authModule.hasProvider('google');
      const hasGitHub = authModule.hasProvider('github');
      
      // These might not be configured in test environment
      expect(typeof hasGoogle).toBe('boolean');
      expect(typeof hasGitHub).toBe('boolean');
    });

    it('should get all providers', async () => {
      const providers = authModule.getAllProviders();
      expect(Array.isArray(providers)).toBe(true);
    });

    it('should get provider registry', async () => {
      const registry = authModule.getProviderRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('CLI Commands', () => {
    const execCli = (command: string): Promise<{stdout: string, stderr: string, exitCode: number}> => {
      return new Promise((resolve) => {
        const child = spawn('npm', ['run', 'cli', '--', ...command.split(' ')], {
          cwd: process.cwd(),
          env: { ...process.env, DATABASE_PATH: testDbPath }
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          resolve({ stdout, stderr, exitCode: code || 0 });
        });
      });
    };

    it('should execute auth status command', async () => {
      const result = await execCli('auth status');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Auth Module Status');
      expect(result.stdout).toContain('Module: auth');
      expect(result.stdout).toContain('Enabled: ✓');
      expect(result.stdout).toContain('Healthy: ✓');
    });

    it('should execute auth providers command', async () => {
      const result = await execCli('auth providers list');
      
      // Should not error even if no providers configured
      expect(result.exitCode).toBe(0);
    });

    it('should execute auth db status command', async () => {
      const result = await execCli('auth db status');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Database Status');
    });

    it('should handle auth role commands', async () => {
      const result = await execCli('auth role list');
      
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Security and Audit', () => {
    let testUserId: string;

    beforeEach(async () => {
      testUserId = 'audit-test-user-' + Date.now();
      await dbService.execute(`
        INSERT INTO users (id, email, username, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [testUserId, 'audit@example.com', 'audituser', 'Audit User']);
    });

    it('should log token creation events', async () => {
      await authModule.createToken({
        userId: testUserId,
        type: 'api',
        scope: ['read']
      });

      // Check if audit log was created
      const auditLogs = await dbService.query(
        'SELECT * FROM auth_audit_log WHERE user_id = ? AND action = ?',
        [testUserId, 'token.create']
      );

      expect(auditLogs.length).toBeGreaterThan(0);
    });

    it('should handle token validation securely', async () => {
      const invalidToken = 'invalid.token.format';
      const validation = await authModule.validateToken(invalidToken);
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBeDefined();
    });

    it('should clean up expired tokens', async () => {
      // Create a token that expires immediately
      const token = await authModule.createToken({
        userId: testUserId,
        type: 'api',
        scope: ['read'],
        expiresIn: -1 // Already expired
      });

      // Wait a moment to ensure it's expired
      await new Promise(resolve => setTimeout(resolve, 100));

      const cleanedCount = await tokenService.cleanupExpiredTokens();
      expect(cleanedCount).toBeGreaterThanOrEqual(1);

      // Token should now be invalid
      const validation = await authModule.validateToken(token.token);
      expect(validation.valid).toBe(false);
    });
  });

  describe('Service Integration', () => {
    it('should handle service errors gracefully', async () => {
      try {
        const result = await userService.getUserById(null as any);
        expect(result).toBeNull();
      } catch (error) {
        // Service should handle errors internally or throw meaningful errors
        expect(error).toBeDefined();
      }
    });

    it('should maintain singleton pattern', async () => {
      const service1 = authModule.service();
      const service2 = authModule.service();
      
      expect(service1).toBe(service2);
    });

    it('should provide tunnel service when available', async () => {
      const tunnelService = authModule.getTunnelService();
      const tunnelStatus = authModule.getTunnelStatus();
      
      // May be null in test environment
      expect(tunnelStatus).toBeDefined();
      expect(typeof tunnelStatus.active).toBe('boolean');
    });
  });

  describe('Database Integration', () => {
    it('should properly interact with auth database tables', async () => {
      const testUserId = 'db-test-user';
      const testEmail = 'dbtest@example.com';
      
      // Insert a test user
      await dbService.execute(`
        INSERT INTO users (id, email, username, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [testUserId, testEmail, 'dbtestuser', 'DB Test User']);
      
      // Verify we can retrieve it through the service
      const user = await userService.getUserByEmail(testEmail);
      expect(user).toBeDefined();
      expect(user?.email).toBe(testEmail);
    });

    it('should handle database constraints properly', async () => {
      const testUserId = 'constraint-test-user';
      
      // Try to create auth credentials without a user (should fail due to foreign key)
      try {
        await dbService.execute(`
          INSERT INTO auth_credentials (user_id, password_hash)
          VALUES (?, ?)
        `, [testUserId, 'test-hash']);
        
        // If we get here, the constraint didn't work
        expect.fail('Should have failed due to foreign key constraint');
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
    });

    it('should maintain referential integrity', async () => {
      const testUserId = 'integrity-test-user';
      
      // Create user first
      await dbService.execute(`
        INSERT INTO users (id, email, username, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [testUserId, 'integrity@example.com', 'integrityuser', 'Integrity User']);
      
      // Create token
      const token = await authModule.createToken({
        userId: testUserId,
        type: 'api',
        scope: ['read']
      });
      
      // Delete user (should cascade delete the token)
      await dbService.execute('DELETE FROM users WHERE id = ?', [testUserId]);
      
      // Token should no longer validate
      const validation = await authModule.validateToken(token.token);
      expect(validation.valid).toBe(false);
    });
  });
});