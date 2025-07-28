/**
 * CLI and Configuration Integration Tests
 * Tests CLI commands, configuration management, and system operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CliService } from '@/modules/core/cli/services/cli.service';
import { ConfigService } from '@/modules/core/config/services/config.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { SystemService } from '@/modules/core/system/services/system.service';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';
import { createTestId, waitForEvent } from './setup';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { execSync, spawn } from 'child_process';

describe('CLI and Configuration Integration Test', () => {
  let cliService: CliService;
  let configService: ConfigService;
  let dbService: DatabaseService;
  let logger: LoggerService;
  let systemService: SystemService;
  let moduleManager: ModuleManagerService;
  
  const testSessionId = `cli-config-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');
  const configPath = join(testDir, 'config');

  beforeAll(async () => {
    console.log(`🚀 Setting up CLI configuration integration test (session: ${testSessionId})...`);
    
    // Create test directory structure
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    if (!existsSync(configPath)) {
      mkdirSync(configPath, { recursive: true });
    }
    
    // Set test environment variables
    process.env.TEST_SESSION_ID = testSessionId;
    process.env.DATABASE_FILE = testDbPath;
    process.env.CONFIG_PATH = configPath;
    process.env.LOG_LEVEL = 'error';
    
    // Initialize services
    logger = LoggerService.getInstance();
    
    // Initialize database with proper config
    await DatabaseService.initialize({
      type: 'sqlite',
      sqlite: {
        filename: testDbPath
      }
    }, logger);
    dbService = DatabaseService.getInstance();
    
    // Create test database schema
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        type TEXT DEFAULT 'string',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        config TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Initialize services
    configService = ConfigService.getInstance();
    cliService = CliService.getInstance();
    systemService = SystemService.getInstance();
    moduleManager = ModuleManagerService.getInstance();
    
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
    // Clear test data before each test
    await dbService.execute('DELETE FROM system_config');
    await dbService.execute('DELETE FROM modules');
    
    // Clear config files
    if (existsSync(configPath)) {
      const files = require('fs').readdirSync(configPath);
      for (const file of files) {
        rmSync(join(configPath, file), { force: true });
      }
    }
  });

  describe('Configuration Management', () => {
    it('should manage system configuration settings', async () => {
      const testConfig = {
        'app.name': 'SystemPrompt OS Test',
        'app.version': '1.0.0-test',
        'database.maxConnections': '10',
        'logger.level': 'info',
        'server.port': '3000'
      };
      
      // Set configuration values
      for (const [key, value] of Object.entries(testConfig)) {
        await configService.setConfig(key, value);
      }
      
      // Verify values were stored
      for (const [key, expectedValue] of Object.entries(testConfig)) {
        const actualValue = await configService.getConfig(key);
        expect(actualValue).toBe(expectedValue);
      }
      
      // Test configuration listing
      const allConfig = await configService.getAllConfig();
      expect(Object.keys(allConfig)).toHaveLength(Object.keys(testConfig).length);
      
      for (const [key, value] of Object.entries(testConfig)) {
        expect(allConfig[key]).toBe(value);
      }
    });

    it('should handle configuration validation', async () => {
      // Test valid configurations
      const validConfigs = [
        { key: 'database.timeout', value: '5000', type: 'number' },
        { key: 'app.enabled', value: 'true', type: 'boolean' },
        { key: 'server.hosts', value: '["localhost", "127.0.0.1"]', type: 'array' }
      ];
      
      for (const config of validConfigs) {
        const validation = await configService.validateConfig(config.key, config.value, config.type);
        expect(validation.valid).toBe(true);
        
        await configService.setConfig(config.key, config.value, config.type);
        const retrievedValue = await configService.getConfig(config.key, config.type);
        
        switch (config.type) {
          case 'number':
            expect(retrievedValue).toBe(5000);
            break;
          case 'boolean':
            expect(retrievedValue).toBe(true);
            break;
          case 'array':
            expect(retrievedValue).toEqual(['localhost', '127.0.0.1']);
            break;
        }
      }
    });

    it('should handle configuration file operations', async () => {
      const configData = {
        application: {
          name: 'Test App',
          version: '1.0.0',
          environment: 'test'
        },
        database: {
          type: 'sqlite',
          file: testDbPath,
          timeout: 5000
        },
        features: {
          authentication: true,
          logging: true,
          monitoring: false
        }
      };
      
      // Write configuration to file
      const configFile = join(configPath, 'app.json');
      await configService.writeConfigFile(configFile, configData);
      
      expect(existsSync(configFile)).toBe(true);
      
      // Read configuration from file
      const loadedConfig = await configService.readConfigFile(configFile);
      expect(loadedConfig).toEqual(configData);
      
      // Test configuration merging
      const additionalConfig = {
        application: {
          debug: true
        },
        newSection: {
          setting: 'value'
        }
      };
      
      const mergedConfig = await configService.mergeConfig(configData, additionalConfig);
      expect(mergedConfig.application.name).toBe('Test App');
      expect(mergedConfig.application.debug).toBe(true);
      expect(mergedConfig.newSection.setting).toBe('value');
    });

    it('should support environment-specific configurations', async () => {
      const environments = ['development', 'test', 'production'];
      
      for (const env of environments) {
        const envConfig = {
          [`${env}.database.host`]: `${env}-db.example.com`,
          [`${env}.api.baseUrl`]: `https://${env}-api.example.com`,
          [`${env}.logging.level`]: env === 'production' ? 'error' : 'debug'
        };
        
        for (const [key, value] of Object.entries(envConfig)) {
          await configService.setConfig(key, value);
        }
      }
      
      // Test environment-specific retrieval
      for (const env of environments) {
        const envSpecificConfig = await configService.getConfigByEnvironment(env);
        
        expect(envSpecificConfig[`database.host`]).toBe(`${env}-db.example.com`);
        expect(envSpecificConfig[`api.baseUrl`]).toBe(`https://${env}-api.example.com`);
        expect(envSpecificConfig[`logging.level`]).toBe(env === 'production' ? 'error' : 'debug');
      }
    });

    it('should handle configuration change notifications', async () => {
      const configChanges: Array<{ key: string; oldValue: any; newValue: any }> = [];
      
      // Setup change listener
      configService.onConfigChange((change) => {
        configChanges.push(change);
      });
      
      // Make configuration changes
      await configService.setConfig('test.setting1', 'value1');
      await configService.setConfig('test.setting2', 'value2');
      await configService.setConfig('test.setting1', 'updated_value1'); // Update existing
      
      await waitForEvent(100);
      
      expect(configChanges).toHaveLength(3);
      expect(configChanges[0]).toEqual({
        key: 'test.setting1',
        oldValue: null,
        newValue: 'value1'
      });
      expect(configChanges[2]).toEqual({
        key: 'test.setting1',
        oldValue: 'value1',
        newValue: 'updated_value1'
      });
    });
  });

  describe('CLI Command Execution', () => {
    it('should execute system status commands', async () => {
      // Test system status command
      const statusResult = await cliService.executeCommand('system', ['status']);
      
      expect(statusResult.success).toBe(true);
      expect(statusResult.output).toContain('System Status');
      expect(statusResult.data).toBeDefined();
      expect(statusResult.data.status).toBe('running');
    });

    it('should handle database operations through CLI', async () => {
      // Test database status
      const dbStatusResult = await cliService.executeCommand('database', ['status']);
      expect(dbStatusResult.success).toBe(true);
      expect(dbStatusResult.data.connected).toBe(true);
      
      // Test database query
      const queryResult = await cliService.executeCommand('database', [
        'query',
        'SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"'
      ]);
      expect(queryResult.success).toBe(true);
      expect(queryResult.data.results).toBeDefined();
    });

    it('should manage configuration through CLI', async () => {
      // Set configuration via CLI
      const setResult = await cliService.executeCommand('config', [
        'set',
        'cli.test.setting',
        'test_value'
      ]);
      expect(setResult.success).toBe(true);
      
      // Get configuration via CLI
      const getResult = await cliService.executeCommand('config', [
        'get',
        'cli.test.setting'
      ]);
      expect(getResult.success).toBe(true);
      expect(getResult.data.value).toBe('test_value');
      
      // List all configuration
      const listResult = await cliService.executeCommand('config', ['list']);
      expect(listResult.success).toBe(true);
      expect(listResult.data.configs).toBeDefined();
      expect(Object.keys(listResult.data.configs)).toContain('cli.test.setting');
    });

    it('should handle module management commands', async () => {
      // Test module listing
      const listResult = await cliService.executeCommand('modules', ['list']);
      expect(listResult.success).toBe(true);
      expect(listResult.data.modules).toBeDefined();
      
      // Create a test module entry
      await dbService.execute(
        'INSERT INTO modules (id, name, version, enabled) VALUES (?, ?, ?, ?)',
        ['test-module', 'Test Module', '1.0.0', 1]
      );
      
      // Test module status
      const statusResult = await cliService.executeCommand('modules', ['status', 'test-module']);
      expect(statusResult.success).toBe(true);
      expect(statusResult.data.module.name).toBe('Test Module');
      expect(statusResult.data.module.enabled).toBe(true);
    });

    it('should provide helpful command documentation', async () => {
      // Test help command
      const helpResult = await cliService.executeCommand('help', []);
      expect(helpResult.success).toBe(true);
      expect(helpResult.output).toContain('Available commands');
      
      // Test command-specific help
      const configHelpResult = await cliService.executeCommand('config', ['--help']);
      expect(configHelpResult.success).toBe(true);
      expect(configHelpResult.output).toContain('config');
      expect(configHelpResult.output).toContain('Usage:');
    });

    it('should handle command validation and error cases', async () => {
      // Test invalid command
      const invalidResult = await cliService.executeCommand('nonexistent', ['command']);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('Unknown command');
      
      // Test invalid arguments
      const invalidArgsResult = await cliService.executeCommand('config', ['invalid-action']);
      expect(invalidArgsResult.success).toBe(false);
      expect(invalidArgsResult.error).toBeDefined();
      
      // Test missing required arguments
      const missingArgsResult = await cliService.executeCommand('config', ['set']);
      expect(missingArgsResult.success).toBe(false);
      expect(missingArgsResult.error).toContain('required');
    });
  });

  describe('System Health and Monitoring', () => {
    it('should monitor system health metrics', async () => {
      const healthCheck = await systemService.getSystemHealth();
      
      expect(healthCheck.status).toBeDefined();
      expect(healthCheck.components).toBeDefined();
      expect(healthCheck.components.database).toBeDefined();
      expect(healthCheck.components.database.status).toBe('healthy');
      
      // Test individual component health
      const dbHealth = await systemService.checkDatabaseHealth();
      expect(dbHealth.healthy).toBe(true);
      expect(dbHealth.responseTime).toBeDefined();
      expect(dbHealth.connectionCount).toBeDefined();
    });

    it('should collect and report system metrics', async () => {
      // Generate some system activity
      for (let i = 0; i < 10; i++) {
        await configService.setConfig(`metric.test.${i}`, `value${i}`);
        await dbService.execute('SELECT 1'); // Generate DB activity
      }
      
      await waitForEvent(100);
      
      const metrics = await systemService.getSystemMetrics();
      
      expect(metrics.database).toBeDefined();
      expect(metrics.database.queryCount).toBeGreaterThan(0);
      expect(metrics.configuration).toBeDefined();
      expect(metrics.performance).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });

    it('should handle system resource monitoring', async () => {
      const resourceUsage = await systemService.getResourceUsage();
      
      expect(resourceUsage.memory).toBeDefined();
      expect(resourceUsage.memory.used).toBeGreaterThan(0);
      expect(resourceUsage.memory.total).toBeGreaterThan(0);
      
      expect(resourceUsage.cpu).toBeDefined();
      expect(resourceUsage.disk).toBeDefined();
      expect(resourceUsage.uptime).toBeGreaterThan(0);
    });

    it('should provide system information', async () => {
      const systemInfo = await systemService.getSystemInfo();
      
      expect(systemInfo.version).toBeDefined();
      expect(systemInfo.platform).toBeDefined();
      expect(systemInfo.nodeVersion).toBeDefined();
      expect(systemInfo.environment).toBeDefined();
      expect(systemInfo.startTime).toBeDefined();
      
      // Test environment detection
      expect(systemInfo.environment).toBe('test');
    });
  });

  describe('Module System Integration', () => {
    it('should register and manage core modules', async () => {
      const coreModules = [
        { id: 'core-auth', name: 'Authentication Module', version: '1.0.0' },
        { id: 'core-database', name: 'Database Module', version: '1.0.0' },
        { id: 'core-logger', name: 'Logger Module', version: '1.0.0' }
      ];
      
      // Register modules
      for (const module of coreModules) {
        await moduleManager.registerModule({
          id: module.id,
          name: module.name,
          version: module.version,
          enabled: true,
          config: {}
        });
      }
      
      // Verify modules are registered
      const registeredModules = await moduleManager.listModules();
      expect(registeredModules).toHaveLength(coreModules.length);
      
      for (const module of coreModules) {
        const found = registeredModules.find(m => m.id === module.id);
        expect(found).toBeDefined();
        expect(found!.name).toBe(module.name);
      }
    });

    it('should handle module enablement and disabling', async () => {
      const testModule = {
        id: 'test-toggle-module',
        name: 'Toggle Test Module',
        version: '1.0.0'
      };
      
      // Register module
      await moduleManager.registerModule({
        ...testModule,
        enabled: true
      });
      
      // Verify initially enabled
      let moduleInfo = await moduleManager.getModule(testModule.id);
      expect(moduleInfo!.enabled).toBe(true);
      
      // Disable module
      await moduleManager.disableModule(testModule.id);
      moduleInfo = await moduleManager.getModule(testModule.id);
      expect(moduleInfo!.enabled).toBe(false);
      
      // Enable module
      await moduleManager.enableModule(testModule.id);
      moduleInfo = await moduleManager.getModule(testModule.id);
      expect(moduleInfo!.enabled).toBe(true);
    });

    it('should manage module configurations', async () => {
      const testModule = {
        id: 'config-test-module',
        name: 'Configuration Test Module',
        version: '1.0.0'
      };
      
      const moduleConfig = {
        setting1: 'value1',
        setting2: 42,
        setting3: true,
        nested: {
          property: 'nested_value'
        }
      };
      
      // Register module with configuration
      await moduleManager.registerModule({
        ...testModule,
        enabled: true,
        config: moduleConfig
      });
      
      // Verify configuration
      const savedModule = await moduleManager.getModule(testModule.id);
      expect(savedModule!.config).toEqual(moduleConfig);
      
      // Update module configuration
      const updatedConfig = {
        ...moduleConfig,
        setting1: 'updated_value1',
        newSetting: 'new_value'
      };
      
      await moduleManager.updateModuleConfig(testModule.id, updatedConfig);
      
      // Verify configuration update
      const updatedModule = await moduleManager.getModule(testModule.id);
      expect(updatedModule!.config).toEqual(updatedConfig);
    });

    it('should handle module health checks', async () => {
      const testModules = [
        { id: 'healthy-module', name: 'Healthy Module', version: '1.0.0' },
        { id: 'unhealthy-module', name: 'Unhealthy Module', version: '1.0.0' }
      ];
      
      // Register modules
      for (const module of testModules) {
        await moduleManager.registerModule({
          ...module,
          enabled: true
        });
      }
      
      // Perform health checks
      const healthReport = await moduleManager.performHealthChecks();
      
      expect(healthReport.totalModules).toBe(testModules.length);
      expect(healthReport.healthyModules).toBeDefined();
      expect(healthReport.unhealthyModules).toBeDefined();
      expect(healthReport.timestamp).toBeDefined();
      
      // Check individual module health
      for (const module of testModules) {
        const moduleHealth = await moduleManager.checkModuleHealth(module.id);
        expect(moduleHealth.moduleId).toBe(module.id);
        expect(moduleHealth.status).toBeDefined();
      }
    });
  });

  describe('Integration Testing with Real CLI Commands', () => {
    // Helper function to execute CLI commands in a subprocess
    async function executeCliCommand(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
      return new Promise((resolve) => {
        const env = {
          ...process.env,
          TEST_SESSION_ID: testSessionId,
          DATABASE_FILE: testDbPath,
          CONFIG_PATH: configPath,
          LOG_LEVEL: 'error'
        };
        
        const child = spawn('npx', ['tsx', 'src/modules/core/cli/cli/main.ts', ...args], {
          cwd: process.cwd(),
          env,
          stdio: 'pipe'
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
          resolve({ stdout, stderr, code: code || 0 });
        });
        
        // Add timeout to prevent hanging
        setTimeout(() => {
          child.kill();
          resolve({ stdout, stderr, code: 1 });
        }, 10000);
      });
    }

    it('should execute real CLI status commands', async () => {
      const result = await executeCliCommand(['system', 'status']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('System Status');
    });

    it('should handle configuration commands in subprocess', async () => {
      // Set configuration
      const setResult = await executeCliCommand([
        'config', 'set', 'integration.test.setting', 'integration_value'
      ]);
      expect(setResult.code).toBe(0);
      
      // Get configuration
      const getResult = await executeCliCommand([
        'config', 'get', 'integration.test.setting'
      ]);
      expect(getResult.code).toBe(0);
      expect(getResult.stdout).toContain('integration_value');
    });

    it('should handle database commands in subprocess', async () => {
      const result = await executeCliCommand(['database', 'status']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Database Status');
    });

    it('should handle help commands', async () => {
      const result = await executeCliCommand(['--help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Available commands');
    });

    it('should handle error conditions gracefully', async () => {
      // Test invalid command
      const invalidResult = await executeCliCommand(['nonexistent-command']);
      expect(invalidResult.code).not.toBe(0);
      
      // Test invalid arguments
      const invalidArgsResult = await executeCliCommand(['config', 'invalid-action']);
      expect(invalidArgsResult.code).not.toBe(0);
    });
  });

  describe('Configuration File Integration', () => {
    it('should handle YAML configuration files', async () => {
      const yamlConfig = `
application:
  name: "Test Application"
  version: "1.0.0"
  environment: test

database:
  type: sqlite
  file: "${testDbPath}"
  timeout: 5000

logging:
  level: info
  format: json
  outputs:
    - console
    - file

features:
  authentication: true
  monitoring: false
      `.trim();
      
      const yamlFile = join(configPath, 'config.yaml');
      writeFileSync(yamlFile, yamlConfig);
      
      // Load YAML configuration
      const loadedConfig = await configService.loadConfigFile(yamlFile);
      
      expect(loadedConfig.application.name).toBe('Test Application');
      expect(loadedConfig.database.type).toBe('sqlite');
      expect(loadedConfig.features.authentication).toBe(true);
    });

    it('should handle JSON configuration files', async () => {
      const jsonConfig = {
        server: {
          port: 3000,
          host: 'localhost',
          ssl: {
            enabled: false,
            cert: null,
            key: null
          }
        },
        cache: {
          type: 'memory',
          ttl: 3600,
          maxSize: 1000
        }
      };
      
      const jsonFile = join(configPath, 'server.json');
      writeFileSync(jsonFile, JSON.stringify(jsonConfig, null, 2));
      
      // Load JSON configuration
      const loadedConfig = await configService.loadConfigFile(jsonFile);
      
      expect(loadedConfig).toEqual(jsonConfig);
    });

    it('should handle configuration file validation', async () => {
      const invalidConfig = `
invalid_yaml_syntax:
  - missing_closing_bracket
    unclosed: "string
      `;
      
      const invalidFile = join(configPath, 'invalid.yaml');
      writeFileSync(invalidFile, invalidConfig);
      
      try {
        await configService.loadConfigFile(invalidFile);
        expect.fail('Should have thrown error for invalid YAML');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('parse');
      }
    });
  });
});