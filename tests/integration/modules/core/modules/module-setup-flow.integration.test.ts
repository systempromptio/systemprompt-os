/**
 * Integration test for module setup and bootstrap flow.
 * Tests that bootstrap requires database to be pre-seeded with core modules.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { getModuleSetupService } from '@/modules/core/modules';
import fs from 'fs';
import path from 'path';

describe('Module Setup Flow Integration', () => {
  const TEST_DB_PATH = path.join(__dirname, 'test-setup-flow.db');
  let bootstrap: Bootstrap;
  const bootstraps: Bootstrap[] = [];

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Set test database path
    process.env.DATABASE_FILE = TEST_DB_PATH;
    // Clear any singleton instances
    (DatabaseService as any).instance = null;
    (LoggerService as any).instance = null;
  });

  afterEach(async () => {
    // Clean up all bootstrap instances
    for (const bs of bootstraps) {
      try {
        await bs?.shutdown();
      } catch (e) {
        // Ignore shutdown errors
      }
    }
    bootstraps.length = 0;
    // Clear singleton instances
    (DatabaseService as any).instance = null;
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('should demonstrate the complete setup => bootstrap flow', async () => {
    // Step 1: Bootstrap without setup should fail validation
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    bootstraps.push(bootstrap);

    // This should fail because database doesn't have core modules
    let bootstrapError: Error | undefined;
    try {
      await bootstrap.bootstrap();
    } catch (error) {
      bootstrapError = error as Error;
    }
    
    // If no error, log what happened
    if (!bootstrapError) {
      console.log('Bootstrap succeeded when it should have failed');
      console.log('Database exists at:', TEST_DB_PATH, fs.existsSync(TEST_DB_PATH));
    }
    
    expect(bootstrapError).toBeDefined();
    expect(bootstrapError?.message).toContain('Failed to load module');

    // Step 2: Now setup the database using a minimal bootstrap
    // First we need to bootstrap just enough to get database initialized
    const setupBootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    bootstraps.push(setupBootstrap);

    try {
      // This will fail validation but database will be initialized
      await setupBootstrap.bootstrap();
    } catch (e) {
      // Expected to fail
    }

    // Now we can get the database and setup service
    const db = DatabaseService.getInstance();
    const setupService = getModuleSetupService(db);
    // Install core modules
    await setupService.install();

    // Shutdown the setup bootstrap
    await setupBootstrap.shutdown();

    // Step 3: Now bootstrap should succeed
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    bootstraps.push(bootstrap);

    const modules = await bootstrap.bootstrap();
    // Verify core modules are loaded
    expect(modules.size).toBeGreaterThan(0);
    expect(modules.has('logger')).toBe(true);
    expect(modules.has('database')).toBe(true);
    expect(modules.has('modules')).toBe(true);
  });

  it('should validate module state is enforced through database', async () => {
    // Setup database first
    const setupBootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    bootstraps.push(setupBootstrap);

    try {
      await setupBootstrap.bootstrap();
    } catch (e) {
      // Expected
    }

    const db = DatabaseService.getInstance();
    const setupService = getModuleSetupService(db);
    await setupService.install();
    await setupBootstrap.shutdown();

    // Now bootstrap successfully
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    bootstraps.push(bootstrap);
    const modules = await bootstrap.bootstrap();
    const modulesModule = modules.get('modules');
    expect(modulesModule).toBeDefined();

    // Get module info through the modules module exports
    const exports = modulesModule!.exports as any;
    const configInfo = await exports.getModule('config');
    expect(configInfo).toBeDefined();
    expect(configInfo.enabled).toBe(true);
    expect(configInfo.type).toBe('core');
    // Disable module in database
    await db.execute(
      'UPDATE modules SET enabled = 0 WHERE name = ?',
      ['config']
    );

    // Check again - should reflect database state
    const disabledInfo = await exports.getModule('config');
    expect(disabledInfo).toBeDefined();
    expect(disabledInfo.enabled).toBe(false);
  });
});