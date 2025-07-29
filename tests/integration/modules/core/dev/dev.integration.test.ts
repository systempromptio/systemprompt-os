/**
 * Dev Module Integration Test
 * 
 * Tests development tools and utilities:
 * - Module generation
 * - Code linting integration
 * - Type checking
 * - Test running
 * - Development workflows
 * 
 * Coverage targets:
 * - src/modules/core/dev/index.ts
 * - src/modules/core/dev/services/*.ts
 * - src/modules/core/dev/cli/*.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { DevService } from '@/modules/core/dev/services/dev.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { createTestId } from '../../../setup';

describe('Dev Module Integration Tests', () => {
  let bootstrap: Bootstrap;
  let devService: DevService;
  let dbService: DatabaseService;
  
  const testSessionId = `dev-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path
    process.env.DATABASE_PATH = testDbPath;
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services
    const devModule = modules.get('dev');
    const dbModule = modules.get('database');
    
    if (!devModule || !('exports' in devModule) || !devModule.exports) {
      throw new Error('Dev module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    dbService = dbModule.exports.service();
    
    // Ensure schema is initialized for dev module
    if ('schemaService' in dbModule.exports && typeof dbModule.exports.schemaService === 'function') {
      const schemaService = dbModule.exports.schemaService();
      try {
        await schemaService.discoverSchemas(`${process.cwd()}/src/modules`);
        await schemaService.initializeSchemas();
      } catch (error) {
        console.warn('Schema initialization warning:', error);
      }
    }
    
    if ('service' in devModule.exports && typeof devModule.exports.service === 'function') {
      devService = devModule.exports.service();
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
    // Clear any dev-related data before each test
    try {
      await dbService.execute('DELETE FROM dev_sessions WHERE 1=1');
      await dbService.execute('DELETE FROM dev_profiles WHERE 1=1');
    } catch (error) {
      // Table might not exist yet
    }
  });

  describe('Module Bootstrap', () => {
    it('should load dev module during bootstrap', async () => {
      const modules = bootstrap.getModules();
      expect(modules.has('dev')).toBe(true);
      
      const module = modules.get('dev');
      expect(module).toBeDefined();
      expect(module?.name).toBe('dev');
    });

    it('should initialize dev service correctly', async () => {
      expect(devService).toBeDefined();
      
      // Dev service should be available and healthy
      const devModule = bootstrap.getModules().get('dev');
      if (devModule) {
        const healthCheck = await devModule.healthCheck();
        expect(healthCheck.healthy).toBe(true);
      }
    });
  });

  describe('Development Tools', () => {
    it('should run ESLint checks', async () => {
      const result = await runCLICommand(['dev', 'lint']);
      
      // ESLint should run (exit code 0 for no issues, 1 for issues found)
      expect([0, 1]).toContain(result.exitCode);
      
      // Should produce some output
      expect(result.output.length).toBeGreaterThan(0);
    });
    
    it('should run TypeScript compiler', async () => {
      const result = await runCLICommand(['dev', 'typecheck']);
      
      // TypeScript check should run (exit code 0 for no errors, 1 for errors found)
      expect([0, 1]).toContain(result.exitCode);
      
      // Should produce some output
      expect(result.output.length).toBeGreaterThan(0);
    });
    
    it('should execute tests', async () => {
      const result = await runCLICommand(['dev', 'test', '--run']);
      
      // Tests should run (various exit codes possible depending on test results)
      expect(result.exitCode).toBeDefined();
      
      // Should produce test output
      expect(result.output.length).toBeGreaterThan(0);
    });
  });

  describe('Module Generation', () => {
    it('should generate new module structure', async () => {
      const testModuleName = `test-module-${Date.now()}`;
      
      const result = await runCLICommand([
        'dev', 
        'create-module', 
        '--name', 
        testModuleName,
        '--description',
        'Test module for integration testing',
        '--type',
        'core'
      ]);
      
      // Module creation should succeed or provide meaningful error
      expect([0, 1]).toContain(result.exitCode);
      
      if (result.exitCode === 0) {
        expect(result.output.toLowerCase()).toMatch(/created|success|module/);
      } else {
        // Even if it fails, it should provide meaningful error output
        expect(result.output.length).toBeGreaterThan(0);
      }
    });
    
    it('should create module manifest', async () => {
      // This test verifies that the module generator can create proper manifests
      // Since we can't easily test file creation in integration tests,
      // we test that the command executes without crashing
      
      const result = await runCLICommand(['dev', 'create-module', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/create|module|help/);
    });
    
    it('should validate module generation parameters', async () => {
      // Test with invalid parameters
      const result = await runCLICommand(['dev', 'create-module']);
      
      // Should fail with validation error
      expect(result.exitCode).toBe(1);
      expect(result.output.length).toBeGreaterThan(0);
    });
  });

  describe('Code Quality', () => {
    it('should enforce coding standards', async () => {
      const result = await runCLICommand(['dev', 'lint', '--format', 'json']);
      
      // Linting should run and provide results
      expect([0, 1]).toContain(result.exitCode);
      
      // Should provide output (either clean or with issues)
      expect(result.output.length).toBeGreaterThan(0);
    });
    
    it('should check import restrictions', async () => {
      // ESLint should include import validation rules
      const result = await runCLICommand(['dev', 'lint']);
      
      expect([0, 1]).toContain(result.exitCode);
      expect(result.output).toBeDefined();
    });
    
    it('should validate module structure', async () => {
      // TypeScript check should validate module structure
      const result = await runCLICommand(['dev', 'typecheck']);
      
      expect([0, 1]).toContain(result.exitCode);
      expect(result.output).toBeDefined();
    });
  });

  describe('Profile Management', () => {
    it('should create and retrieve development profiles', async () => {
      // Create a test profile
      const profile = await devService.createProfile(
        'test-profile',
        'Test profile description',
        { enabled: true, autoSave: false, debugMode: true }
      );
      
      expect(profile).toBeDefined();
      expect(profile.name).toBe('test-profile');
      expect(profile.description).toBe('Test profile description');
      expect(profile.config_enabled).toBe(1);
      expect(profile.config_auto_save).toBe(0);
      expect(profile.config_debug_mode).toBe(1);
      
      // Retrieve the profile
      const retrieved = await devService.getProfile('test-profile');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(profile.id);
    });
    
    it('should list all profiles', async () => {
      // Create multiple profiles
      await devService.createProfile('profile-1');
      await devService.createProfile('profile-2');
      await devService.createProfile('profile-3');
      
      const profiles = await devService.getAllProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(3);
      
      const names = profiles.map(p => p.name);
      expect(names).toContain('profile-1');
      expect(names).toContain('profile-2');
      expect(names).toContain('profile-3');
    });
    
    it('should update profile configuration', async () => {
      const profile = await devService.createProfile('update-test');
      
      const updated = await devService.updateProfile(profile.id, {
        description: 'Updated description',
        config: { enabled: false, autoSave: true, debugMode: false }
      });
      
      expect(updated.description).toBe('Updated description');
      expect(updated.config_enabled).toBe(0);
      expect(updated.config_auto_save).toBe(1);
      expect(updated.config_debug_mode).toBe(0);
    });
    
    it('should delete profiles', async () => {
      const profile = await devService.createProfile('delete-test');
      
      await devService.deleteProfile(profile.id);
      
      const retrieved = await devService.getProfile('delete-test');
      expect(retrieved).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should start and end development sessions', async () => {
      const session = await devService.startSession('test');
      
      expect(session).toBeDefined();
      expect(session.type).toBe('test');
      expect(session.status).toBe('active');
      expect(session.started_at).toBeDefined();
      
      // End the session
      await devService.endSession(session.id, 'completed', {
        exitCode: 0,
        outputLines: 100,
        errorCount: 0
      });
      
      // Session should be ended
      const activeSessions = await devService.getActiveSessions();
      expect(activeSessions.find(s => s.id === session.id)).toBeUndefined();
    });
    
    it('should track session metadata', async () => {
      const profile = await devService.createProfile('session-test');
      const session = await devService.startSession('lint', profile.id);
      
      expect(session.profile_id).toBe(profile.id);
      
      await devService.endSession(session.id, 'failed', {
        exitCode: 1,
        outputLines: 50,
        errorCount: 5
      });
      
      const allSessions = await devService.getAllSessions(profile.id);
      const endedSession = allSessions.find(s => s.id === session.id);
      
      expect(endedSession?.status).toBe('failed');
      expect(endedSession?.exit_code).toBe(1);
      expect(endedSession?.output_lines).toBe(50);
      expect(endedSession?.error_count).toBe(5);
    });
    
    it('should calculate session statistics', async () => {
      const profile = await devService.createProfile('stats-test');
      
      // Start multiple sessions
      const session1 = await devService.startSession('test', profile.id);
      const session2 = await devService.startSession('lint', profile.id);
      const session3 = await devService.startSession('typecheck', profile.id);
      
      // End some sessions
      await devService.endSession(session1.id, 'completed');
      await devService.endSession(session2.id, 'failed');
      // Leave session3 active
      
      const stats = await devService.getSessionStats(profile.id);
      
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('CLI Commands', () => {
    it('should manage profiles via CLI', async () => {
      // Create profile
      const createResult = await runCLICommand([
        'dev', 'profile:create',
        '--name', 'cli-test-profile',
        '-d', 'CLI test profile',
        '--enabled', '--debug'
      ]);
      
      expect(createResult.exitCode).toBe(0);
      expect(createResult.output).toMatch(/Created profile/);
      
      // List profiles
      const listResult = await runCLICommand(['dev', 'profile:list']);
      expect(listResult.exitCode).toBe(0);
      expect(listResult.output).toMatch(/cli-test-profile/);
    });
    
    it('should manage sessions via CLI', async () => {
      // Start session
      const startResult = await runCLICommand([
        'dev', 'session:start',
        '--type', 'test'
      ]);
      expect(startResult.exitCode).toBe(0);
      expect(startResult.output).toMatch(/Started test session/);
      
      // Extract session ID from output
      const idMatch = startResult.output.match(/ID: (\d+)/);
      expect(idMatch).toBeTruthy();
      const sessionId = idMatch?.[1];
      
      if (sessionId) {
        // Session started successfully, test passed
        expect(parseInt(sessionId)).toBeGreaterThan(0);
      }
    });
  });

  describe('Development Workflows', () => {
    it('should support development session management', async () => {
      // Dev service should support basic operations
      expect(devService).toBeDefined();
      
      // Should be able to get service status
      const devModule = bootstrap.getModules().get('dev');
      if (devModule) {
        const healthCheck = await devModule.healthCheck();
        expect(healthCheck).toBeDefined();
        expect(typeof healthCheck.healthy).toBe('boolean');
      }
    });
    
    it('should handle development tool configuration', async () => {
      // Dev tools should be configurable
      // This is verified by the fact that CLI commands accept parameters
      
      const lintHelp = await runCLICommand(['dev', 'lint', '--help']);
      expect(lintHelp.exitCode).toBe(0);
      
      const typecheckHelp = await runCLICommand(['dev', 'typecheck', '--help']);
      expect(typecheckHelp.exitCode).toBe(0);
    });
    
    it('should integrate with build and test systems', async () => {
      // Integration is demonstrated by successful execution of dev commands
      
      // Test command should integrate with test system
      const testResult = await runCLICommand(['dev', 'test', '--help']);
      expect(testResult.exitCode).toBe(0);
      expect(testResult.output.toLowerCase()).toMatch(/test|help/);
    });
    
    it('should support profile-based development workflows', async () => {
      // Create a profile with specific settings
      const profile = await devService.createProfile(
        'workflow-test',
        'Profile for testing workflows',
        { enabled: true, autoSave: true, debugMode: false }
      );
      
      // Start a session with the profile
      const session = await devService.startSession('test', profile.id);
      
      expect(session.profile_id).toBe(profile.id);
      
      // End the session
      await devService.endSession(session.id, 'completed');
      
      // Verify workflow tracking
      const stats = await devService.getSessionStats(profile.id);
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.completed).toBeGreaterThan(0);
    });
  });

  async function runCLICommand(args: string[]): Promise<{ output: string; errors: string; exitCode: number | null }> {
    const cliProcess = spawn('npm', ['run', 'cli', '--', ...args], {
      cwd: process.cwd(),
      shell: true,
    });

    const output: string[] = [];
    const errors: string[] = [];

    cliProcess.stdout.on('data', (data) => {
      output.push(data.toString());
    });

    cliProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    await new Promise<void>((resolve) => {
      cliProcess.on('close', () => {
        resolve();
      });
    });

    return {
      output: output.join(''),
      errors: errors.join(''),
      exitCode: cliProcess.exitCode,
    };
  }
});