/**
 * Integration test for module setup and bootstrap flow.
 * Tests that modules properly initialize their own schemas during bootstrap.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { ModuleSetupService } from '@/modules/core/modules/services/module-setup.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import fs from 'fs';
import path from 'path';

describe('Module Setup and Bootstrap Integration', () => {
  const TEST_DB_PATH = path.join(__dirname, 'test-module-setup.db');
  let bootstrap: Bootstrap | null = null;

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Set test database path
    process.env.DATABASE_PATH = TEST_DB_PATH;
  });

  afterEach(async () => {
    // Shutdown bootstrap if it exists
    if (bootstrap) {
      try {
        await bootstrap.shutdown();
      } catch (error) {
        // Ignore shutdown errors
      }
      bootstrap = null;
    }

    // Clean up test files
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (error) {
        // File might be locked, ignore
      }
    }
  });

  it('should successfully bootstrap and create module schemas', async () => {
    // Create bootstrap instance
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });

    // Bootstrap should succeed and create database with schemas
    const modules = await bootstrap.bootstrap();
    
    // Should have loaded core modules
    expect(modules.size).toBeGreaterThan(0);
    expect(modules.has('logger')).toBe(true);
    expect(modules.has('database')).toBe(true);
    expect(modules.has('modules')).toBe(true);
    
    // Database file should exist
    expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
  });

  it('should properly seed core modules during bootstrap', async () => {
    // Create bootstrap instance
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });

    // Bootstrap should succeed
    const modules = await bootstrap.bootstrap();
    
    // Get database service from loaded modules
    const dbModule = modules.get('database');
    expect(dbModule).toBeDefined();
    
    if (dbModule && 'exports' in dbModule && dbModule.exports && 'service' in dbModule.exports) {
      const dbService = dbModule.exports.service();
      
      // Check that modules table was created and seeded
      const moduleRows = await dbService.query('SELECT name, type FROM modules WHERE type = ?', ['core']);
      expect(moduleRows.length).toBeGreaterThan(0);
      
      // Verify critical modules are in database
      const moduleNames = moduleRows.map((row: any) => row.name);
      expect(moduleNames).toContain('logger');
      expect(moduleNames).toContain('database');
      expect(moduleNames).toContain('modules');
    }
  });

  it('should validate module setup after bootstrap', async () => {
    // Create bootstrap instance
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });

    // Bootstrap should succeed
    const modules = await bootstrap.bootstrap();
    
    // Get database service
    const dbModule = modules.get('database');
    expect(dbModule).toBeDefined();
    
    if (dbModule && 'exports' in dbModule && dbModule.exports && 'service' in dbModule.exports) {
      const dbService = dbModule.exports.service() as DatabaseService;
      
      // Create setup service to validate
      const setupService = ModuleSetupService.getInstance(dbService);
      
      // Validation should pass after proper bootstrap
      await expect(setupService.validate()).resolves.not.toThrow();
    }
  });

  it('should handle module updates without losing data', async () => {
    // First bootstrap
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });

    const modules = await bootstrap.bootstrap();
    const dbModule = modules.get('database');
    
    if (dbModule && 'exports' in dbModule && dbModule.exports && 'service' in dbModule.exports) {
      const dbService = dbModule.exports.service() as DatabaseService;
      
      // Add custom extension module
      await dbService.execute(
        'INSERT INTO modules (name, version, type, path, enabled, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        ['my-extension', '1.0.0', 'extension', '/extensions/my-extension', 1, '{"custom": true}']
      );
      
      // Create setup service
      const setupService = ModuleSetupService.getInstance(dbService);
      
      // Run update - should preserve extension module
      await setupService.update();
      
      // Verify extension still exists
      const [extension] = await dbService.query(
        'SELECT * FROM modules WHERE name = ?',
        ['my-extension']
      );
      
      expect(extension).toBeDefined();
      expect(extension.version).toBe('1.0.0');
      expect(extension.type).toBe('extension');
      expect(JSON.parse(extension.metadata).custom).toBe(true);
    }
  });

  it('should handle clean operation correctly', async () => {
    // Bootstrap first
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });

    const modules = await bootstrap.bootstrap();
    const dbModule = modules.get('database');
    
    if (dbModule && 'exports' in dbModule && dbModule.exports && 'service' in dbModule.exports) {
      const dbService = dbModule.exports.service() as DatabaseService;
      
      // Add custom module
      await dbService.execute(
        'INSERT INTO modules (name, version, type, path, enabled) VALUES (?, ?, ?, ?, ?)',
        ['custom-module', '1.0.0', 'extension', '/path/to/custom', 1]
      );
      
      // Verify custom module exists
      let moduleRows = await dbService.query('SELECT name FROM modules WHERE name = ?', ['custom-module']);
      expect(moduleRows.length).toBe(1);
      
      // Create setup service and clean
      const setupService = ModuleSetupService.getInstance(dbService);
      await setupService.clean();
      
      // Verify custom module is gone
      moduleRows = await dbService.query('SELECT name FROM modules WHERE name = ?', ['custom-module']);
      expect(moduleRows.length).toBe(0);
      
      // But core modules should still exist
      const coreModules = await dbService.query('SELECT name FROM modules WHERE type = ?', ['core']);
      expect(coreModules.length).toBeGreaterThan(0);
    }
  });

  it('should enforce module state through database', async () => {
    // Bootstrap
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });

    const modules = await bootstrap.bootstrap();
    const dbModule = modules.get('database');
    
    if (dbModule && 'exports' in dbModule && dbModule.exports && 'service' in dbModule.exports) {
      const dbService = dbModule.exports.service() as DatabaseService;
      const setupService = ModuleSetupService.getInstance(dbService);
      
      // Validation should pass initially
      await expect(setupService.validate()).resolves.not.toThrow();
      
      // Disable a critical module
      await dbService.execute(
        'UPDATE modules SET enabled = 0 WHERE name = ? AND type = ?',
        ['database', 'core']
      );
      
      // Validation should now fail
      await expect(setupService.validate()).rejects.toThrow(/Critical module 'database' is disabled/);
      
      // Re-enable the module
      await dbService.execute(
        'UPDATE modules SET enabled = 1 WHERE name = ? AND type = ?',
        ['database', 'core']
      );
      
      // Validation should pass again
      await expect(setupService.validate()).resolves.not.toThrow();
    }
  });
});