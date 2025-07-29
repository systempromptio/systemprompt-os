/**
 * CLI Module Direct Integration Test
 * 
 * Tests CLI module by directly importing and exercising all CLI functionality
 * to achieve maximum code coverage. This test directly calls CLI services,
 * formatters, and utilities instead of spawning child processes.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import { CLIModule } from '@/modules/core/cli/index';
import { CliService } from '@/modules/core/cli/services/cli.service';
import { CliFormatterService } from '@/modules/core/cli/services/cli-formatter.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { RefreshService } from '@/modules/core/cli/services/refresh.service';
import { StatusService } from '@/modules/core/cli/services/status.service';
import { HelpService } from '@/modules/core/cli/services/help.service';
import { DatabaseQueryService } from '@/modules/core/cli/services/database-query.service';
import { DatabaseViewService } from '@/modules/core/cli/services/database-view.service';
import { DatabaseRebuildService } from '@/modules/core/cli/services/database-rebuild.service';
import { DatabaseClearService } from '@/modules/core/cli/services/database-clear.service';
import { DatabaseStatusService } from '@/modules/core/cli/services/database-status.service';
import { DatabaseSummaryService } from '@/modules/core/database/services/database-summary.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
describe('CLI Module Direct Integration Tests', () => {
  let bootstrap: Bootstrap;
  let cliModule: CLIModule;
  let cliService: CliService;
  let database: DatabaseService;

  beforeAll(async () => {
    console.log('🔧 Setting up CLI integration test environment...');
    
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.DISABLE_SERVER = 'true';
    process.env.DISABLE_TELEMETRY = 'true';
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      environment: 'test',
      cliMode: true,
    });

    const modules = await bootstrap.bootstrap();
    console.log(`Bootstrapped ${modules.size} modules`);

    // Get services
    database = DatabaseService.getInstance();
    cliService = CliService.getInstance();
    
    // Create and initialize CLI module
    cliModule = new CLIModule();
    await cliModule.initialize();
    await cliModule.start();

    console.log('✅ CLI integration test environment ready');
  }, 60000);

  afterAll(async () => {
    console.log('🧹 Cleaning up CLI integration test environment...');
    
    if (cliModule) {
      cliModule.stop();
    }
    
    if (bootstrap) {
      await bootstrap.shutdown();
    }
  });

  describe('CLI Module Class', () => {
    it('should have correct module properties', () => {
      expect(cliModule.name).toBe('cli');
      expect(cliModule.version).toBe('1.0.0');
      expect(cliModule.type).toBe('core');
      expect(cliModule.dependencies).toEqual(['logger', 'database']);
    });

    it('should provide health check', async () => {
      const health = await cliModule.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.message).toBe('CLI module is healthy');
    });

    it('should export service methods', () => {
      expect(cliModule.exports.service).toBeDefined();
      expect(cliModule.exports.getAllCommands).toBeDefined();
      expect(cliModule.exports.getCommandHelp).toBeDefined();
      expect(cliModule.exports.formatCommands).toBeDefined();
      expect(cliModule.exports.generateDocs).toBeDefined();
    });
  });

  describe('CLI Service', () => {
    it('should be initialized', () => {
      expect(cliService.isInitialized()).toBe(true);
    });

    it('should get all commands from database', async () => {
      const commands = await cliService.getCommandsFromDatabase();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
      
      // Verify command structure
      const firstCommand = commands[0];
      expect(firstCommand).toHaveProperty('id');
      expect(firstCommand).toHaveProperty('command_path');
      expect(firstCommand).toHaveProperty('command_name');
      expect(firstCommand).toHaveProperty('module_name');
      expect(firstCommand).toHaveProperty('executor_path');
    });

    it('should get command metadata', async () => {
      const metadata = await cliService.getCommandMetadata();
      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata.length).toBeGreaterThan(0);
    });

    it('should register command with options and aliases', async () => {
      const testCommand: CLICommand = {
        name: 'test:integration',
        description: 'Test integration command',
        options: [
          {
            name: 'verbose',
            type: 'boolean',
            description: 'Verbose output',
            alias: 'v'
          },
          {
            name: 'format',
            type: 'string', 
            description: 'Output format',
            choices: ['json', 'table']
          }
        ],
        aliases: ['test:int', 'ti'],
        execute: async (context: CLIContext) => {
          console.log('Test command executed');
        }
      };

      await cliService.registerCommand(testCommand, 'test-module', 'test/executor/path');
      
      // Verify command was registered
      const commands = await cliService.getCommandsFromDatabase();
      const registeredCommand = commands.find(cmd => cmd.command_name === 'test:integration');
      expect(registeredCommand).toBeDefined();
      expect(registeredCommand?.options).toHaveLength(2);
      expect(registeredCommand?.aliases).toHaveLength(2);
    });
  });

  describe('CLI Formatter Service', () => {
    let formatter: CliFormatterService;

    beforeAll(() => {
      formatter = CliFormatterService.getInstance();
    });

    it('should get command icons', () => {
      const icon = formatter.getCommandIcon('auth');
      expect(icon).toBe('🔐');
      
      const defaultIcon = formatter.getCommandIcon('unknown');
      expect(defaultIcon).toBe('🔧');
    });

    it('should format messages', () => {
      expect(formatter.highlight('test')).toContain('test');
      expect(formatter.formatSuccess('success')).toContain('success');
      expect(formatter.formatError('error')).toContain('error');
      expect(formatter.formatWarning('warning')).toContain('warning');
      expect(formatter.formatInfo('info')).toContain('info');
    });

    it('should create progress logger', () => {
      const logger = formatter.createProgressLogger('loading', 'Test');
      expect(logger).toBeDefined();
    });
  });

  describe('CLI Output Service', () => {
    let output: CliOutputService;

    beforeAll(() => {
      output = CliOutputService.getInstance();
    });

    it('should output data in different formats', () => {
      const testData = { name: 'test', value: 123 };
      
      // Test JSON output
      expect(() => output.output(testData, { format: 'json' })).not.toThrow();
      
      // Test table output
      expect(() => output.output([testData], { format: 'table' })).not.toThrow();
    });

    it('should create sections and key-value pairs', () => {
      expect(() => output.section('Test Section', 'Test description')).not.toThrow();
      expect(() => output.keyValue({ key1: 'value1', key2: 'value2' })).not.toThrow();
    });

    it('should display messages', () => {
      expect(() => output.info('Info message')).not.toThrow();
      expect(() => output.success('Success message')).not.toThrow();
      expect(() => output.warning('Warning message')).not.toThrow();
      expect(() => output.error('Error message')).not.toThrow();
    });

    it('should display tables', () => {
      const data = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Boston' }
      ];
      const columns = [
        { key: 'name', header: 'Name', align: 'left' as const },
        { key: 'age', header: 'Age', align: 'right' as const },
        { key: 'city', header: 'City', align: 'left' as const }
      ];
      
      expect(() => output.table(data, columns)).not.toThrow();
    });
  });

  describe('CLI Services Integration', () => {
    it('should test refresh service', async () => {
      const refreshService = RefreshService.getInstance();
      
      // Test refresh functionality (should not throw)
      expect(() => refreshService.refreshCommands()).not.toThrow();
    });

    it('should test status service', async () => {
      const statusService = StatusService.getInstance();
      
      // Test status functionality
      const status = await statusService.getCommandSummary(cliService);
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
      expect(status).toHaveProperty('totalCommands');
      expect(status).toHaveProperty('moduleBreakdown');
      expect(status).toHaveProperty('enabledCommands');
    });

    it('should test help service', async () => {
      const helpService = HelpService.getInstance();
      
      // Test help functionality - should not throw
      expect(() => helpService.showGeneralHelp(cliService)).not.toThrow();
      expect(() => helpService.showAllCommands(cliService)).not.toThrow();
    });

    it('should test database query service', async () => {
      const queryService = DatabaseQueryService.getInstance();
      
      // Test simple query
      const result = await queryService.executeQuery('SELECT 1 as test', 'json');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('executionTime');
      expect(Array.isArray(result.output)).toBe(true);
    });

    it('should test database view service', async () => {
      const viewService = DatabaseViewService.getInstance();
      
      // Test table viewing
      const result = viewService.handleView({ tableName: 'users', format: 'json' });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should test database status service', async () => {
      const statusService = DatabaseStatusService.getInstance();
      
      // Test database status
      const result = await statusService.getStatus({ format: 'json' });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('connected');
      expect(result.data?.connected).toBe(true);
    });

    it('should test database summary service', async () => {
      const summaryService = DatabaseSummaryService.getInstance();
      
      // Test database summary
      const summary = await summaryService.handleSummary({
        format: 'json',
        includeSystem: false,
        sortBy: 'name'
      }, database);
      
      expect(summary).toBeDefined();
      expect(summary.success).toBe(true);
      expect(summary.data).toBeDefined();
    });
  });

  describe('CLI Commands Direct Execution', () => {
    it('should test help command functionality', async () => {
      const commands = await cliModule.getAllCommands();
      const helpText = cliModule.getCommandHelp('cli:help', commands);
      
      expect(helpText).toBeDefined();
      expect(typeof helpText).toBe('string');
    });

    it('should test command formatting', async () => {
      const commands = await cliModule.getAllCommands();
      
      // Test text format
      const textFormat = cliModule.formatCommands(commands, 'text');
      expect(textFormat).toBeDefined();
      expect(typeof textFormat).toBe('string');
      
      // Test JSON format
      const jsonFormat = cliModule.formatCommands(commands, 'json');
      expect(jsonFormat).toBeDefined();
      expect(typeof jsonFormat).toBe('string');
    });

    it('should test documentation generation', async () => {
      const commands = await cliModule.getAllCommands();
      
      // Test markdown docs
      const markdownDocs = cliModule.generateDocs(commands, 'markdown');
      expect(markdownDocs).toBeDefined();
      expect(typeof markdownDocs).toBe('string');
      expect(markdownDocs.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle uninitialized service errors', async () => {
      const uninitializedModule = new CLIModule();
      
      // getService() has lazy initialization, so it won't throw
      // Test getAllCommands instead which checks for initialization
      await expect(uninitializedModule.getAllCommands()).rejects.toThrow();
    });

    it('should handle invalid command registration', async () => {
      const invalidCommand = {
        // Missing required fields
        description: 'Invalid command'
      } as any;
      
      await expect(cliService.registerCommand('test', invalidCommand)).rejects.toThrow();
    });
  });

  describe('CLI Module Lifecycle', () => {
    it('should handle start/stop lifecycle', async () => {
      const testModule = new CLIModule();
      
      expect(testModule.status).toBe('pending');
      
      // Initialize first to set up logger
      await testModule.initialize();
      expect(testModule.status).toBe('initializing');
      
      await testModule.start();
      expect(testModule.status).toBe('running');
      
      await testModule.stop();
      expect(testModule.status).toBe('stopped');
    });

    it('should handle module exports', async () => {
      // Test service export
      const service = cliModule.exports.service();
      expect(service).toBe(cliService);
      
      // Test getAllCommands export  
      const commands = await cliModule.exports.getAllCommands();
      expect(commands).toBeInstanceOf(Map);
      
      // Test module scanning
      const modules = new Map([['test', { path: '/test/path' }]]);
      await expect(cliModule.exports.scanAndRegisterModuleCommands(modules)).resolves.not.toThrow();
    });
  });
});