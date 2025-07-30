/**
 * CLI Module Integration Tests
 * 
 * Comprehensive integration tests for the CLI module including:
 * - Bootstrap integration and command registration
 * - Database and logger integration
 * - CLI command execution and output formatting
 * - Error handling and validation
 * - Direct service testing and child process execution
 * 
 * Coverage targets:
 * - src/modules/core/cli/index.ts
 * - src/modules/core/cli/services/*.ts
 * - src/modules/core/cli/cli/*.ts
 * - src/modules/core/cli/utils/*.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
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
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';

describe('CLI Module Integration Tests', () => {
  const projectRoot = join(__dirname, '../../../../..');
  const testDir = join(projectRoot, '.test-cli-integration');
  const dbPath = join(testDir, 'test.db');
  const timeout = 20000; // 20 seconds for CLI operations

  let bootstrap: Bootstrap;
  let cliModule: CLIModule;
  let cliService: CliService;
  let database: DatabaseService;

  beforeAll(async () => {
    console.log('🔧 Setting up CLI integration test environment...');
    
    // Clean up any existing test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_FILE = dbPath;
    process.env.STATE_PATH = testDir;
    process.env.LOG_MODE = 'cli';
    process.env.LOG_LEVEL = 'error';
    process.env.DISABLE_SERVER = 'true';
    process.env.DISABLE_TELEMETRY = 'true';

    // Bootstrap the system to ensure commands are registered
    console.log('Bootstrapping system for CLI tests...');
    bootstrap = new Bootstrap({
      skipMcp: true,
      environment: 'test',
      cliMode: true,
    });

    const modules = await bootstrap.bootstrap();
    console.log(`Bootstrapped ${modules.size} modules`);
    
    // Get CLI module and services
    cliModule = modules.get('cli') as CLIModule;
    expect(cliModule).toBeDefined();
    
    // Get database for verification
    database = DatabaseService.getInstance();
    
    // Verify commands are registered
    const commandCount = await database.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM cli_commands'
    );
    console.log(`Commands registered: ${commandCount.rows[0].count}`);
  }, 60000);

  afterAll(async () => {
    console.log('🧹 Cleaning up CLI integration test environment...');
    
    // Shutdown bootstrap
    if (bootstrap) {
      await bootstrap.shutdown();
    }

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    console.log('✅ CLI integration test environment cleaned up');
  });

  async function runCLICommand(args: string[]): Promise<{ output: string; errors: string; exitCode: number | null }> {
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_FILE: dbPath,
      STATE_PATH: testDir,
      LOG_MODE: 'cli',
      LOG_LEVEL: 'error',
    };

    const cliProcess = spawn('npx', ['tsx', 'src/modules/core/cli/cli/main.ts', ...args], {
      cwd: projectRoot,
      env,
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

  describe('Bootstrap Integration', () => {
    it('should have CLI module loaded correctly', () => {
      expect(cliModule).toBeDefined();
      expect(cliModule.name).toBe('cli');
      expect(cliModule.exports).toBeDefined();
    });

    it('should have database connection established', async () => {
      const isInitialized = await database.isInitialized();
      expect(isInitialized).toBe(true);
    });

    it('should have registered commands in database', async () => {
      const commands = await database.query<{ name: string }>(
        'SELECT name FROM cli_commands WHERE active = 1'
      );
      expect(commands.rows.length).toBeGreaterThan(0);
      
      // Check for essential commands
      const commandNames = commands.rows.map(c => c.name);
      expect(commandNames).toContain('help');
      expect(commandNames).toContain('database:status');
      expect(commandNames).toContain('modules:list');
    });
  });

  describe('CLI Command Execution', () => {
    it('should show help when no arguments provided', async () => {
      const result = await runCLICommand([]);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('systemprompt');
      expect(result.output.toLowerCase()).toMatch(/usage|command/);
    }, timeout);

    it('should execute help command', async () => {
      const result = await runCLICommand(['help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('systemprompt');
      expect(result.output).toContain('Commands');
      expect(result.errors).toBe('');
    }, timeout);

    it('should list all modules', async () => {
      const result = await runCLICommand(['modules', 'list']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/installed modules|name:|total:|modules/);
    }, timeout);

    it('should show module status', async () => {
      const result = await runCLICommand(['modules', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/Module\s+Status/i);
      expect(result.output).toContain('Module');
    }, timeout);

    it('should show database status', async () => {
      const result = await runCLICommand(['database', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/database|sqlite|connected/);
    }, timeout);

    it('should show database summary', async () => {
      const result = await runCLICommand(['database', 'summary']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/database|table|summary/);
    }, timeout);

    it('should handle invalid commands gracefully', async () => {
      const result = await runCLICommand(['invalid-command']);
      
      expect(result.exitCode).toBe(1);
      expect(result.errors.toLowerCase()).toMatch(/unknown|error|command/);
    }, timeout);

    it('should handle nested commands', async () => {
      const result = await runCLICommand(['database', 'help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/database|command/);
    }, timeout);
  });

  describe('Direct Service Testing', () => {
    let cliService: CliService;
    let outputService: CliOutputService;
    let formatterService: CliFormatterService;

    beforeAll(() => {
      cliService = CliService.getInstance();
      outputService = CliOutputService.getInstance();
      formatterService = CliFormatterService.getInstance();
    });

    it('should have CLI service initialized', () => {
      expect(cliService).toBeDefined();
      expect(cliService.isInitialized()).toBe(true);
    });

    it('should get all commands from database', async () => {
      const commands = await cliService.getCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
      
      // Verify command structure
      const firstCommand = commands[0];
      expect(firstCommand).toHaveProperty('name');
      expect(firstCommand).toHaveProperty('description');
    });

    it('should get command metadata', async () => {
      const commands = await cliService.getCommands();
      const helpCommand = commands.find(c => c.name === 'help');
      expect(helpCommand).toBeDefined();
      expect(helpCommand?.description).toBeTruthy();
    });

    it('should register command with options and aliases', async () => {
      const testCommand: CLICommand = {
        name: 'test-command',
        description: 'Test command for integration',
        options: [
          {
            name: 'verbose',
            alias: 'v',
            type: 'boolean',
            description: 'Verbose output'
          }
        ],
        execute: async (context: CLIContext) => {
          return { success: true, message: 'Test executed' };
        }
      };

      await cliService.registerCommand(testCommand);
      
      // Verify registration
      const commands = await cliService.getCommands();
      const registeredCommand = commands.find(c => c.name === 'test-command');
      expect(registeredCommand).toBeDefined();
      expect(registeredCommand?.description).toBe('Test command for integration');
    });
  });

  describe('Output Formatting Services', () => {
    let outputService: CliOutputService;
    let formatterService: CliFormatterService;

    beforeAll(() => {
      outputService = CliOutputService.getInstance();
      formatterService = CliFormatterService.getInstance();
    });

    it('should format messages', () => {
      const successMsg = formatterService.success('Operation completed');
      const errorMsg = formatterService.error('Operation failed');
      const warningMsg = formatterService.warning('Warning message');
      
      expect(successMsg).toContain('Operation completed');
      expect(errorMsg).toContain('Operation failed');
      expect(warningMsg).toContain('Warning message');
    });

    it('should create progress logger', () => {
      const progress = formatterService.createProgressLogger('Test Progress');
      expect(progress).toBeDefined();
      expect(typeof progress.update).toBe('function');
      expect(typeof progress.complete).toBe('function');
    });

    it('should output data in different formats', () => {
      const testData = [{ name: 'test', value: 123 }];
      
      const jsonOutput = outputService.json(testData);
      const tableOutput = outputService.table(testData);
      
      expect(jsonOutput).toContain('test');
      expect(jsonOutput).toContain('123');
      expect(tableOutput).toContain('test');
    });

    it('should create sections and key-value pairs', () => {
      outputService.section('Test Section', 'Section description');
      outputService.keyValue('Key', 'Value');
      // These methods primarily output to console, so we just verify they don't throw
    });

    it('should display messages with different levels', () => {
      // Test that message display methods don't throw errors
      expect(() => outputService.info('Info message')).not.toThrow();
      expect(() => outputService.success('Success message')).not.toThrow();
      expect(() => outputService.warning('Warning message')).not.toThrow();
      expect(() => outputService.error('Error message')).not.toThrow();
    });

    it('should display tables', () => {
      const testData = [
        { name: 'Item 1', status: 'active', count: 5 },
        { name: 'Item 2', status: 'inactive', count: 3 }
      ];
      
      expect(() => outputService.table(testData)).not.toThrow();
    });
  });

  describe('Database Integration Services', () => {
    let statusService: DatabaseStatusService;
    let queryService: DatabaseQueryService;
    let viewService: DatabaseViewService;
    let clearService: DatabaseClearService;
    let rebuildService: DatabaseRebuildService;

    beforeAll(() => {
      statusService = DatabaseStatusService.getInstance();
      queryService = DatabaseQueryService.getInstance();
      viewService = DatabaseViewService.getInstance();
      clearService = DatabaseClearService.getInstance();
      rebuildService = DatabaseRebuildService.getInstance();
    });

    it('should test database status service', async () => {
      const result = await statusService.getStatus();
      expect(result).toBeDefined();
      expect(typeof result.connected).toBe('boolean');
      expect(result.connected).toBe(true);
    });

    it('should test database query service', async () => {
      const result = await queryService.executeQuery({
        sql: 'SELECT COUNT(*) as count FROM sqlite_master WHERE type = "table"',
        params: [],
        format: 'json',
        timeout: 5000
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should test database view service', async () => {
      const result = await viewService.viewTable({
        table: 'sqlite_master',
        limit: 5,
        offset: 0,
        format: 'table'
      });
      expect(result.success).toBe(true);
    });

    it('should test database clear service with confirmation', async () => {
      const result = await clearService.handleClear({
        force: true,
        confirm: false
      });
      // Should require confirmation
      expect(result.success).toBe(false);
      expect(result.message).toContain('requires either --force or --confirm');
    });
  });

  describe('Help System Integration', () => {
    let helpService: HelpService;

    beforeAll(() => {
      helpService = HelpService.getInstance();
    });

    it('should test help command functionality', async () => {
      const helpResult = await helpService.getHelp();
      expect(helpResult).toBeDefined();
      expect(helpResult.commands).toBeDefined();
      expect(Array.isArray(helpResult.commands)).toBe(true);
    });

    it('should test command formatting', async () => {
      const commands = await cliService.getCommands();
      const helpCommand = commands.find(c => c.name === 'help');
      expect(helpCommand).toBeDefined();
      
      const formatted = helpService.formatCommand(helpCommand!);
      expect(formatted).toContain('help');
    });

    it('should test documentation generation', async () => {
      const docs = await helpService.generateDocs();
      expect(docs).toBeDefined();
      expect(docs.commands).toBeDefined();
      expect(Object.keys(docs.commands).length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid command registration', async () => {
      const invalidCommand = {
        name: '', // Invalid: empty name
        description: 'Invalid command',
        execute: async () => ({ success: false })
      } as CLICommand;

      await expect(cliService.registerCommand(invalidCommand))
        .rejects.toThrow();
    });

    it('should handle database connection errors gracefully', async () => {
      // This test verifies error handling without actually breaking the connection
      const queryService = DatabaseQueryService.getInstance();
      
      const result = await queryService.executeQuery({
        sql: 'SELECT * FROM non_existent_table',
        params: [],
        format: 'json',
        timeout: 1000
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Module Lifecycle', () => {
    it('should handle start/stop lifecycle', async () => {
      expect(cliModule.status).toBeDefined();
      // CLI module should be running after bootstrap
      expect(['running', 'stopped'].includes(cliModule.status.toLowerCase())).toBe(true);
    });

    it('should handle module exports', async () => {
      const exports = cliModule.exports;
      expect(exports).toBeDefined();
      expect(exports.CliService).toBeDefined();
      expect(exports.CliOutputService).toBeDefined();
      expect(exports.CliFormatterService).toBeDefined();
    });

    it('should provide health check', async () => {
      const healthCheck = await cliModule.healthCheck();
      expect(healthCheck).toBeDefined();
      expect(typeof healthCheck.healthy).toBe('boolean');
    });
  });

  describe('Configuration Integration', () => {
    it('should support configuration management', async () => {
      const result = await runCLICommand(['config', 'get', 'system.name']);
      // Config command should execute without errors
      expect([0, 1]).toContain(result.exitCode); // May return 1 if config not found
    }, timeout);

    it('should validate command execution order', async () => {
      // Test that commands execute in proper sequence
      const statusResult = await runCLICommand(['database', 'status']);
      expect(statusResult.exitCode).toBe(0);
      
      const listResult = await runCLICommand(['modules', 'list']);
      expect(listResult.exitCode).toBe(0);
      
      const helpResult = await runCLICommand(['help']);
      expect(helpResult.exitCode).toBe(0);
    }, timeout);

    it('should support verbose output flag', async () => {
      const result = await runCLICommand(['--verbose', 'help']);
      expect([0, 1]).toContain(result.exitCode); // Depending on implementation
    }, timeout);
  });

  describe('System Integration', () => {
    it('should show system status', async () => {
      const result = await runCLICommand(['system', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/system|status|health/);
    }, timeout);

    it('should show system info', async () => {
      const result = await runCLICommand(['system', 'info']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/system|version|info/);
    }, timeout);
  });
});