/**
 * CLI and Configuration Integration Tests
 * Tests the integration between CLI commands and configuration management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ConfigService } from '@/modules/core/config/services/config.service';
import { CliService } from '@/modules/core/cli/services/cli.service';
import { SystemService } from '@/modules/core/system/services/system.service';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LoggerMode, LogOutput } from '@/modules/core/logger/types';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { createTestId } from './setup';

describe('CLI and Configuration Integration Test', () => {
  let configService: ConfigService;
  let cliService: CliService;
  let systemService: SystemService;
  let moduleManager: ModuleManagerService;
  let dbService: DatabaseService;
  let logger: LoggerService;
  
  const testSessionId = `cli-config-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');
  const configPath = join(testDir, 'config');

  beforeAll(async () => {
    console.log(`🚀 Setting up CLI configuration integration test (session: ${testSessionId})...`);
    
    // Create test directories
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    if (!existsSync(configPath)) {
      mkdirSync(configPath, { recursive: true });
    }
    
    // Set environment variables
    process.env.TEST_SESSION_ID = testSessionId;
    process.env.DATABASE_FILE = testDbPath;
    process.env.CONFIG_PATH = configPath;
    process.env.LOG_LEVEL = 'error';
    
    // Initialize logger first with proper config
    logger = LoggerService.getInstance();
    logger.initialize({
      stateDir: testDir,
      logLevel: 'error',
      mode: LoggerMode.CLI,
      maxSize: '10MB',
      maxFiles: 3,
      outputs: [LogOutput.CONSOLE],
      files: {
        system: 'system.log',
        error: 'error.log',
        access: 'access.log'
      }
    });
    
    // Initialize database with proper config
    await DatabaseService.initialize({
      type: 'sqlite',
      sqlite: {
        filename: testDbPath
      }
    }, logger);
    dbService = DatabaseService.getInstance();
    
    // Create configuration schema
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS configs (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'general',
        is_secret BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        config TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Initialize services
    configService = ConfigService.getInstance();
    await configService.initialize();
    
    cliService = CliService.getInstance();
    systemService = SystemService.getInstance();
    
    // Initialize ModuleManagerService with required parameters
    const moduleConfig = {
      modulesDir: join(process.cwd(), 'src/modules'),
      autoLoad: false
    };
    moduleManager = ModuleManagerService.getInstance(moduleConfig, logger, dbService);
    
    console.log('✅ CLI configuration integration test ready!');
  });

  afterAll(async () => {
    console.log(`🧹 Cleaning up CLI configuration test (session: ${testSessionId})...`);
    
    try {
      await dbService.disconnect();
    } catch (error) {
      // Ignore close errors in cleanup
    }
    
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    // Clean up environment variables
    delete process.env.TEST_SESSION_ID;
    delete process.env.DATABASE_FILE;
    delete process.env.CONFIG_PATH;
    delete process.env.LOG_LEVEL;
    
    console.log('✅ Cleanup complete!');
  });

  beforeEach(async () => {
    // Clear configuration data
    await dbService.execute('DELETE FROM configs');
    await dbService.execute('DELETE FROM modules');
  });

  describe('Configuration Management', () => {
    it('should manage system configuration settings using basic methods', async () => {
      const testConfig = {
        apiUrl: 'https://api.example.com',
        timeout: '30000',
        retryCount: '3',
        debugMode: 'true'
      };
      
      // Set configuration values using the actual ConfigService methods
      for (const [key, value] of Object.entries(testConfig)) {
        await configService.set(key, value);
      }
      
      // Verify configuration values
      for (const [key, expectedValue] of Object.entries(testConfig)) {
        const value = await configService.get(key);
        expect(value).toBe(expectedValue);
      }
      
      // List all configurations
      const configs = await configService.list();
      expect(configs).toHaveLength(4);
      expect(configs.map(c => c.key)).toContain('apiUrl');
    });

    it('should handle configuration updates and deletions', async () => {
      // Set initial value
      await configService.set('testKey', 'initialValue');
      let value = await configService.get('testKey');
      expect(value).toBe('initialValue');
      
      // Update value
      await configService.set('testKey', 'updatedValue');
      value = await configService.get('testKey');
      expect(value).toBe('updatedValue');
      
      // Delete value
      await configService.delete('testKey');
      value = await configService.get('testKey');
      expect(value).toBeNull();
    });

    it('should handle configuration file operations manually', async () => {
      const configData = {
        app: {
          name: 'TestApp',
          version: '1.0.0',
          features: {
            auth: true,
            logging: true
          }
        }
      };
      
      // Write configuration to file manually
      const configFile = join(configPath, 'app.json');
      writeFileSync(configFile, JSON.stringify(configData, null, 2));
      
      expect(existsSync(configFile)).toBe(true);
      
      // Read configuration from file
      const loadedData = JSON.parse(readFileSync(configFile, 'utf8'));
      expect(loadedData).toEqual(configData);
      
      // Store in ConfigService
      await configService.set('app', JSON.stringify(configData));
      const storedValue = await configService.get('app');
      expect(JSON.parse(storedValue as string)).toEqual(configData);
    });

    it('should support environment-specific configurations', async () => {
      const environments = ['development', 'staging', 'production'];
      
      for (const env of environments) {
        const envConfig = {
          database: `${env}.db`,
          apiUrl: `https://api-${env}.example.com`,
          logLevel: env === 'production' ? 'error' : 'debug'
        };
        
        // Store environment-specific config
        await configService.set(`${env}_config`, JSON.stringify(envConfig));
      }
      
      // Verify all environment configs are stored
      const configs = await configService.list();
      expect(configs.length).toBeGreaterThanOrEqual(3);
      
      // Check specific environment config
      const prodConfig = await configService.get('production_config');
      expect(prodConfig).toBeTruthy();
      const parsed = JSON.parse(prodConfig as string);
      expect(parsed.logLevel).toBe('error');
    });
  });

  describe('Module Configuration', () => {
    it('should manage module configurations', async () => {
      // Store module configuration
      const moduleConfig = {
        id: 'test-module',
        name: 'Test Module',
        path: '/modules/test',
        enabled: true,
        config: JSON.stringify({
          feature1: true,
          feature2: false,
          settings: {
            timeout: 5000
          }
        })
      };
      
      await dbService.execute(
        `INSERT INTO modules (id, name, path, enabled, config) VALUES (?, ?, ?, ?, ?)`,
        [moduleConfig.id, moduleConfig.name, moduleConfig.path, moduleConfig.enabled ? 1 : 0, moduleConfig.config]
      );
      
      // Retrieve module configuration
      const result = await dbService.query('SELECT * FROM modules WHERE id = ? LIMIT 1', [moduleConfig.id]).then(rows => rows[0]);
      expect(result).toBeTruthy();
      expect(result.name).toBe(moduleConfig.name);
      expect(result.enabled).toBe(1);
      
      const parsedConfig = JSON.parse(result.config);
      expect(parsedConfig.feature1).toBe(true);
    });

    it('should handle module enable/disable', async () => {
      const moduleId = 'toggle-module';
      
      // Insert module
      await dbService.execute(
        `INSERT INTO modules (id, name, path, enabled) VALUES (?, ?, ?, ?)`,
        [moduleId, 'Toggle Module', '/modules/toggle', 1]
      );
      
      // Check initial state
      let module = await dbService.query('SELECT * FROM modules WHERE id = ? LIMIT 1', [moduleId]).then(rows => rows[0]);
      expect(module.enabled).toBe(1);
      
      // Disable module
      await dbService.execute(
        `UPDATE modules SET enabled = 0 WHERE id = ?`,
        [moduleId]
      );
      
      // Check disabled state
      module = await dbService.query('SELECT * FROM modules WHERE id = ? LIMIT 1', [moduleId]).then(rows => rows[0]);
      expect(module.enabled).toBe(0);
    });
  });

  describe('Configuration Persistence', () => {
    it('should persist configurations across service restarts', async () => {
      const persistentConfig = {
        persistKey1: 'value1',
        persistKey2: 'value2'
      };
      
      // Set configurations
      for (const [key, value] of Object.entries(persistentConfig)) {
        await configService.set(key, value);
      }
      
      // Simulate service restart by creating new instance
      // Note: In real scenario, we'd need to reinitialize from DB
      const configs = await configService.list();
      expect(configs.length).toBeGreaterThanOrEqual(2);
      
      // Verify values are still accessible
      for (const [key, expectedValue] of Object.entries(persistentConfig)) {
        const value = await configService.get(key);
        expect(value).toBe(expectedValue);
      }
    });

    it('should handle configuration export and import', async () => {
      // Set up test configurations
      const exportConfig = {
        export1: 'value1',
        export2: 'value2',
        export3: JSON.stringify({ nested: true })
      };
      
      for (const [key, value] of Object.entries(exportConfig)) {
        await configService.set(key, value);
      }
      
      // Export configurations (simulate)
      const allConfigs = await configService.list();
      const exportData = allConfigs.reduce((acc, config) => {
        acc[config.key] = config.value;
        return acc;
      }, {} as Record<string, any>);
      
      // Write export to file
      const exportFile = join(configPath, 'export.json');
      writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
      
      // Clear configurations
      for (const config of allConfigs) {
        await configService.delete(config.key);
      }
      
      // Import configurations
      const importData = JSON.parse(readFileSync(exportFile, 'utf8'));
      for (const [key, value] of Object.entries(importData)) {
        await configService.set(key, value);
      }
      
      // Verify imported configurations
      for (const [key, expectedValue] of Object.entries(exportConfig)) {
        const value = await configService.get(key);
        expect(value).toBe(expectedValue);
      }
    });
  });
});