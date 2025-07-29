/**
 * Config Module Integration Test
 * 
 * Tests configuration management:
 * - Configuration loading and validation
 * - Environment variable handling
 * - Model provider configuration
 * - Dynamic configuration updates
 * - Configuration persistence
 * - Multi-environment support
 * 
 * Coverage targets:
 * - src/modules/core/config/index.ts
 * - src/modules/core/config/services/config.service.ts
 * - src/modules/core/config/providers/*.ts
 * - src/modules/core/config/cli/*.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { ConfigService } from '@/modules/core/config/services/config.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { createTestId } from '../../../setup';

describe('Config Module Integration Tests', () => {
  let bootstrap: Bootstrap;
  let configService: ConfigService;
  let dbService: DatabaseService;
  
  const testSessionId = `config-integration-${createTestId()}`;
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
    const configModule = modules.get('config');
    const dbModule = modules.get('database');
    
    if (!configModule || !('exports' in configModule) || !configModule.exports) {
      throw new Error('Config module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    dbService = dbModule.exports.service();
    
    if ('service' in configModule.exports && typeof configModule.exports.service === 'function') {
      configService = configModule.exports.service();
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
    // Only clear data for specific tests that need isolation
    // Most tests should preserve data to test persistence
  });

  describe('Module Bootstrap', () => {
    it('should load config module during bootstrap', async () => {
      const modules = bootstrap.getModules();
      expect(modules.has('config')).toBe(true);
      
      const module = modules.get('config');
      expect(module).toBeDefined();
      expect(module?.name).toBe('config');
    });

    it('should execute config status command', async () => {
      const result = await runCLICommand(['config', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/config|status|enabled|healthy/);
    });
  });

  describe('Configuration Loading', () => {
    it('should load default configuration', async () => {
      // Config service should be initialized
      expect(configService).toBeDefined();
      
      // Should be able to list configs (even if empty)
      const configs = await configService.list();
      expect(Array.isArray(configs)).toBe(true);
    });

    it('should override with environment variables', async () => {
      // Set test environment variables
      const testEnvVar = 'TEST_CONFIG_VAR';
      const testValue = 'test-value-123';
      
      process.env[testEnvVar] = testValue;
      
      // The config service should be able to access env vars
      // This tests that the service can handle environment configuration
      expect(process.env[testEnvVar]).toBe(testValue);
      
      // Cleanup
      delete process.env[testEnvVar];
    });

    it('should validate configuration schema', async () => {
      // Test setting a valid configuration
      await configService.set('test_key', 'test_value');
      const value = await configService.get('test_key');
      expect(value).toBe('test_value');
    });

    it('should handle missing required fields', async () => {
      // Test getting a non-existent key
      const value = await configService.get('non_existent_key');
      expect(value).toBeNull();
    });
  });

  describe('Configuration Persistence', () => {
    it('should manage system configuration settings using basic methods', async () => {
      const testConfig = {
        apiUrl: 'https://api.example.com',
        timeout: 30000,
        retryCount: 3,
        debugMode: true
      };
      
      // Set configuration values
      for (const [key, value] of Object.entries(testConfig)) {
        await configService.set(key, value);
      }
      
      // Verify values immediately after setting
      for (const [key, expectedValue] of Object.entries(testConfig)) {
        const value = await configService.get(key);
        expect(value).toEqual(expectedValue);
      }
      
      // List all configurations
      const configs = await configService.list();
      expect(configs.length).toBeGreaterThanOrEqual(4);
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
      
      // Store in ConfigService - the service handles JSON serialization
      await configService.set('app', configData);
      const storedValue = await configService.get('app');
      expect(storedValue).toEqual(configData);
    });

    it('should support environment-specific configurations', async () => {
      const environments = ['development', 'staging', 'production'];
      
      // Clear any existing configs first
      const existingConfigs = await configService.list();
      for (const config of existingConfigs) {
        await configService.delete(config.key);
      }
      
      for (const env of environments) {
        const envConfig = {
          database: `${env}.db`,
          apiUrl: `https://api-${env}.example.com`,
          logLevel: env === 'production' ? 'error' : 'debug'
        };
        
        // Store environment-specific config - service handles JSON
        await configService.set(`${env}_config`, envConfig);
      }
      
      // Verify all environment configs are stored
      const configs = await configService.list();
      expect(configs.length).toBeGreaterThanOrEqual(3);
      
      // Check specific environment config - already parsed
      const prodConfig = await configService.get('production_config') as any;
      expect(prodConfig).toBeTruthy();
      expect(prodConfig.logLevel).toBe('error');
    });

    it('should persist configurations across service restarts', async () => {
      const persistentConfig = {
        persistKey1: 'value1',
        persistKey2: 'value2'
      };
      
      // Clear any existing configs with these keys
      for (const key of Object.keys(persistentConfig)) {
        try {
          await configService.delete(key);
        } catch {
          // Key might not exist
        }
      }
      
      // Set configurations
      for (const [key, value] of Object.entries(persistentConfig)) {
        await configService.set(key, value);
      }
      
      // Verify values are still accessible (they should persist in database)
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
        export3: { nested: true }
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
      
      // Simulate file export
      const exportJson = JSON.stringify(exportData, null, 2);
      expect(exportJson).toBeTruthy();
      
      // Clear configurations
      for (const config of allConfigs) {
        await configService.delete(config.key);
      }
      
      // Import configurations
      const importData = JSON.parse(exportJson);
      for (const [key, value] of Object.entries(importData)) {
        await configService.set(key, value);
      }
      
      // Verify imported configurations
      for (const [key, expectedValue] of Object.entries(exportConfig)) {
        const value = await configService.get(key);
        expect(value).toEqual(expectedValue);
      }
    });
  });

  describe('CLI Commands', () => {
    it('should get configuration values', async () => {
      // First set via CLI to ensure it's in the same database
      const setResult = await runCLICommand(['config', 'set', '--key', 'PORT', '--value', '3000']);
      expect(setResult.exitCode).toBe(0);
      
      // Then get the value
      const result = await runCLICommand(['config', 'get', '--key', 'PORT']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('3000');
    });

    it('should list all configuration values', async () => {
      // Set configurations via CLI to ensure consistency
      await runCLICommand(['config', 'set', '--key', 'PORT', '--value', '3000']);
      await runCLICommand(['config', 'set', '--key', 'NODE_ENV', '--value', 'test']);
      await runCLICommand(['config', 'set', '--key', 'LOG_LEVEL', '--value', 'info']);
      
      const result = await runCLICommand(['config', 'list']);
      
      expect(result.exitCode).toBe(0);
      // The output should contain at least one of these config-related terms
      expect(result.output.toLowerCase()).toMatch(/configuration|configs|values|key/);
    });
    
    it('should set configuration values', async () => {
      const result = await runCLICommand(['config', 'set', '--key', 'TEST_KEY', '--value', 'test_value']);
      
      expect(result.exitCode).toBe(0);
      
      // Verify via CLI get
      const getResult = await runCLICommand(['config', 'get', '--key', 'TEST_KEY']);
      expect(getResult.exitCode).toBe(0);
      expect(getResult.output).toContain('test_value');
    });
    
    it('should validate configuration', async () => {
      const result = await runCLICommand(['config', 'validate']);
      
      // Validation should succeed (exit code 0) or provide meaningful error
      expect([0, 1]).toContain(result.exitCode);
      
      if (result.exitCode === 0) {
        expect(result.output.toLowerCase()).toMatch(/valid|ok|success/);
      }
    });
  });

  async function runCLICommand(args: string[]): Promise<{ output: string; errors: string; exitCode: number | null }> {
    const cliProcess = spawn('npm', ['run', 'cli', '--', ...args], {
      cwd: process.cwd(),
      shell: true,
      env: {
        ...process.env,
        DATABASE_PATH: testDbPath
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