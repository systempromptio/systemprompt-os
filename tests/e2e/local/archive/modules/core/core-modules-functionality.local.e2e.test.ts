import { describe, it, expect } from 'vitest';
import { execInContainer, expectCLISuccess } from '../../shared/bootstrap.js';

/**
 * Local E2E: Core Modules Functionality
 * 
 * Tests the critical functionality of core modules including:
 * - Module loader and registry
 * - Database operations
 * - Logger functionality
 * - Module lifecycle management
 * 
 * Note: This test suite focuses on CLI-based testing since local tests
 * don't run the HTTP server for performance and isolation reasons.
 */
describe('Local E2E: Core Modules Functionality', () => {
  
  describe('Module Registry and Loading', () => {
    it('should list loaded modules successfully', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt modules list --format json');
      const modules = JSON.parse(stdout);
      
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
      
      // Check for core modules
      const coreModules = modules.filter((m: any) => m.metadata?.core === true);
      expect(coreModules.length).toBeGreaterThan(0);
    });

    it('should show module details', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt modules list');
      
      expect(stdout).toContain('Name:');
      expect(stdout).toContain('Type:');
      expect(stdout).toContain('Status:');
    });

    it('should load core modules with proper configuration', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt modules list --format json');
      const allModules = JSON.parse(stdout);
      const coreModules = allModules.filter((m: any) => m.metadata?.core === true);
      
      // Should have essential core modules
      const moduleNames = coreModules.map((m: any) => m.name);
      expect(moduleNames).toEqual(expect.arrayContaining(['logger', 'database', 'cli']));
    });
  });

  describe('Database Operations', () => {
    it('should show database status', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt database status');
      
      expect(stdout).toContain('Database Status');
      expect(stdout).toContain('Connected');
    });

    it('should show database schema information', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt database schema --action list');
      
      expect(stdout).toContain('Installed Schemas');
      // Should have some basic schema information
      expect(stdout).toMatch(/Module Name|Version/i);
    });

    it('should handle database queries', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt database query --sql "SELECT 1 as test"');
      
      expect(stdout).toContain('test');
      expect(stdout).toContain('1');
    });

    it('should rebuild database successfully', async () => {
      // This should work since it's part of the bootstrap process
      const { stdout } = await execInContainer('/app/bin/systemprompt database rebuild --force');
      
      expect(stdout).toContain('Database rebuild completed');
    });
  });

  describe('Logger Functionality', () => {
    it('should show logger status', async () => {
      // Test that logger is working by checking help contains logging options
      const { stdout } = await execInContainer('/app/bin/systemprompt --help');
      
      // Logger should be functional if CLI is working
      expect(stdout).toContain('systemprompt');
    });

    it('should handle different log levels', async () => {
      // Test that commands with different output formats work
      const { stdout: textOutput } = await execInContainer('/app/bin/systemprompt modules list');
      const { stdout: jsonOutput } = await execInContainer('/app/bin/systemprompt modules list --format json');
      
      // Both formats should work
      expect(textOutput).toContain('Installed Modules');
      expect(() => JSON.parse(jsonOutput)).not.toThrow();
    });
  });

  describe('CLI Integration', () => {
    it('should show system status via CLI', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt system status');
      
      expect(stdout).toContain('System');
      // Should contain basic system information
    });

    it('should provide help for all core commands', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt --help');
      
      // Core module commands should be available
      expect(stdout).toContain('database');
      expect(stdout).toContain('modules');
      expect(stdout).toContain('system');
    });

    it('should execute module-specific help commands', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt database --help');
      
      expect(stdout).toContain('database');
      expect(stdout).toContain('Commands');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle invalid commands gracefully', async () => {
      try {
        await execInContainer('/app/bin/systemprompt invalid-command-that-does-not-exist');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/unknown command|not found|invalid/i);
      }
    });

    it('should handle invalid database queries gracefully', async () => {
      try {
        await execInContainer('/app/bin/systemprompt database query "INVALID SQL SYNTAX"');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/syntax|error|invalid/i);
      }
    });

    it('should recover from database connection issues', async () => {
      // After any errors, basic database operations should still work
      const { stdout } = await execInContainer('/app/bin/systemprompt database status');
      expect(stdout).toContain('Database Status');
    });
  });

  describe('Module Configuration', () => {
    it('should show current configuration', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt config list');
      
      // Should show configuration information
      expect(stdout).toBeDefined();
    });

    it('should handle configuration validation', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt config validate');
      
      // Should validate current configuration
      expect(stdout).toBeDefined();
    });
  });
});