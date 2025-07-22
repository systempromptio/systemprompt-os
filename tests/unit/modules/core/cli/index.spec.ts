/**
 * @fileoverview Tests for CLI module
 * @module tests/unit/modules/core/cli
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CLIModule } from '@/modules/core/cli';
import { CLIService } from '@/modules/core/cli/services/cli.service';
import { CLIInitializationError } from '@/modules/core/cli/utils/errors';
import { ModuleContext } from '@/modules/types';

// Mock the CLIService
jest.mock('@/modules/core/cli/services/cli.service');

describe('CLIModule', () => {
  let cliModule: CLIModule;
  let mockCLIService: jest.Mocked<CLIService>;
  let mockContext: ModuleContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock CLIService
    mockCLIService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
      getAllCommands: jest.fn().mockResolvedValue(new Map()),
      getCommandMetadata: jest.fn().mockResolvedValue([]),
      getCommandHelp: jest.fn().mockResolvedValue('Help text'),
      formatCommands: jest.fn().mockReturnValue('Formatted commands'),
      generateDocs: jest.fn().mockReturnValue('Generated docs')
    } as any;

    // Mock getInstance to return our mock service
    (CLIService.getInstance as jest.Mock).mockReturnValue(mockCLIService);

    // Create module instance
    cliModule = new CLIModule();

    // Create mock context
    mockContext = {
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    };
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(cliModule.name).toBe('cli');
      expect(cliModule.version).toBe('1.0.0');
      expect(cliModule.type).toBe('service');
      expect(cliModule.exports).toBeDefined();
    });

    it('should set up exports correctly', () => {
      expect(cliModule.exports.getAllCommands).toBeDefined();
      expect(cliModule.exports.getCommandHelp).toBeDefined();
      expect(cliModule.exports.formatCommands).toBeDefined();
      expect(cliModule.exports.generateDocs).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize CLI service with logger', async () => {
      await cliModule.initialize(mockContext);

      expect(mockCLIService.initialize).toHaveBeenCalledWith(mockContext.logger);
      expect(mockContext.logger?.info).toHaveBeenCalledWith('CLI module initialized');
    });

    it('should throw CLIInitializationError if initialization fails', async () => {
      const error = new Error('Init failed');
      mockCLIService.initialize.mockRejectedValue(error);

      await expect(cliModule.initialize(mockContext)).rejects.toThrow(CLIInitializationError);
      expect(mockCLIService.initialize).toHaveBeenCalledWith(mockContext.logger);
    });
  });

  describe('start', () => {
    it('should complete without error', async () => {
      await expect(cliModule.start()).resolves.toBeUndefined();
    });
  });

  describe('stop', () => {
    it('should complete without error', async () => {
      await expect(cliModule.stop()).resolves.toBeUndefined();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when service is initialized', async () => {
      mockCLIService.isInitialized.mockReturnValue(true);

      const result = await cliModule.healthCheck();

      expect(result).toEqual({
        healthy: true,
        message: 'CLI service is healthy'
      });
    });

    it('should return unhealthy when service is not initialized', async () => {
      mockCLIService.isInitialized.mockReturnValue(false);

      const result = await cliModule.healthCheck();

      expect(result).toEqual({
        healthy: false,
        message: 'CLI service not initialized'
      });
    });
  });

  describe('getAllCommands', () => {
    it('should return commands from service', async () => {
      const mockCommands = new Map([
        ['test:command', { description: 'Test command', execute: jest.fn() }]
      ]);
      mockCLIService.getAllCommands.mockResolvedValue(mockCommands);

      const result = await cliModule.getAllCommands();

      expect(result).toBe(mockCommands);
      expect(mockCLIService.getAllCommands).toHaveBeenCalled();
    });
  });

  describe('getCommandHelp', () => {
    it('should return help for existing command', () => {
      const mockCommands = new Map([
        ['test:command', { 
          description: 'Test command',
          options: [
            { name: 'test', type: 'string' as const, description: 'Test option' }
          ],
          execute: jest.fn()
        }]
      ]);

      const result = cliModule.getCommandHelp('test:command', mockCommands);

      expect(result).toContain('Command: test:command');
      expect(result).toContain('Description: Test command');
      expect(result).toContain('--test');
      expect(result).toContain('Test option');
    });

    it('should return error message for non-existing command', () => {
      const mockCommands = new Map();

      const result = cliModule.getCommandHelp('unknown:command', mockCommands);

      expect(result).toBe('Command not found: unknown:command');
    });

    it('should handle command with no options', () => {
      const mockCommands = new Map([
        ['test:command', { 
          description: 'Test command',
          execute: jest.fn()
        }]
      ]);

      const result = cliModule.getCommandHelp('test:command', mockCommands);

      expect(result).toContain('Command: test:command');
      expect(result).not.toContain('Options:');
    });

    it('should display option details correctly', () => {
      const mockCommands = new Map([
        ['test:command', { 
          description: 'Test command',
          options: [
            { 
              name: 'format',
              type: 'string' as const,
              description: 'Output format',
              alias: 'f',
              default: 'json',
              required: true
            }
          ],
          execute: jest.fn()
        }]
      ]);

      const result = cliModule.getCommandHelp('test:command', mockCommands);

      expect(result).toContain('--format, -f');
      expect(result).toContain('Output format');
      expect(result).toContain('(default: json)');
      expect(result).toContain('[required]');
    });
  });

  describe('formatCommands', () => {
    const mockCommands = new Map([
      ['auth:login', { description: 'Login command', execute: jest.fn() }],
      ['auth:logout', { description: 'Logout command', execute: jest.fn() }],
      ['db:migrate', { description: 'Run migrations', execute: jest.fn() }],
      ['help', { description: 'Show help', execute: jest.fn() }]
    ]);

    it('should format commands as JSON', () => {
      const result = cliModule.formatCommands(mockCommands, 'json');
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('auth:login');
      expect(parsed).toHaveProperty('auth:logout');
      expect(parsed).toHaveProperty('db:migrate');
      expect(parsed).toHaveProperty('help');
    });

    it('should format commands as text (default)', () => {
      const result = cliModule.formatCommands(mockCommands, 'text');

      expect(result).toContain('auth commands:');
      expect(result).toContain('login');
      expect(result).toContain('logout');
      expect(result).toContain('db commands:');
      expect(result).toContain('migrate');
      expect(result).toContain('core commands:');
      expect(result).toContain('help');
    });

    it('should format commands as table', () => {
      const result = cliModule.formatCommands(mockCommands, 'table');

      expect(result).toContain('Available Commands');
      expect(result).toContain('==================');
      expect(result).toContain('auth:login');
      expect(result).toContain('auth:logout');
      expect(result).toContain('db:migrate');
    });

    it('should sort modules and commands alphabetically', () => {
      const result = cliModule.formatCommands(mockCommands, 'text');
      
      // Check order by finding positions
      const authPos = result.indexOf('auth commands:');
      const corePos = result.indexOf('core commands:');
      const dbPos = result.indexOf('db commands:');
      
      expect(authPos).toBeLessThan(corePos);
      expect(corePos).toBeLessThan(dbPos);
    });
  });

  describe('generateDocs', () => {
    const mockCommands = new Map([
      ['auth:login', { 
        description: 'Login to the system',
        options: [
          { name: 'username', type: 'string' as const, description: 'Username', required: true },
          { name: 'password', type: 'string' as const, description: 'Password', required: true }
        ],
        execute: jest.fn()
      }],
      ['db:migrate', { 
        description: 'Run database migrations',
        execute: jest.fn()
      }]
    ]);

    it('should generate markdown documentation', () => {
      const result = cliModule.generateDocs(mockCommands, 'markdown');

      expect(result).toContain('# SystemPrompt OS CLI Commands');
      expect(result).toContain('## Usage');
      expect(result).toContain('systemprompt <command> [options]');
      expect(result).toContain('### auth module');
      expect(result).toContain('#### auth:login');
      expect(result).toContain('Login to the system');
      expect(result).toContain('**Options:**');
      expect(result).toContain('`--username`: Username **[required]**');
      expect(result).toContain('`--password`: Password **[required]**');
    });

    it('should generate JSON documentation for non-markdown formats', () => {
      const result = cliModule.generateDocs(mockCommands, 'json');
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('auth:login');
      expect(parsed).toHaveProperty('db:migrate');
      expect(parsed['auth:login'].description).toBe('Login to the system');
    });

    it('should handle commands without options', () => {
      const result = cliModule.generateDocs(mockCommands, 'markdown');

      expect(result).toContain('#### db:migrate');
      expect(result).toContain('Run database migrations');
      // Should not have options section for db:migrate
      const dbMigrateSection = result.substring(
        result.indexOf('#### db:migrate'),
        result.length
      );
      expect(dbMigrateSection).not.toContain('**Options:**');
    });
  });

  describe('exports', () => {
    it('should expose methods through exports', async () => {
      const mockCommands = new Map();
      mockCLIService.getAllCommands.mockResolvedValue(mockCommands);

      // Test getAllCommands export
      const commands = await cliModule.exports.getAllCommands();
      expect(commands).toBe(mockCommands);

      // Test getCommandHelp export
      const help = cliModule.exports.getCommandHelp('test', mockCommands);
      expect(help).toContain('Command not found: test');

      // Test formatCommands export
      const formatted = cliModule.exports.formatCommands(mockCommands, 'json');
      expect(formatted).toBe('{}');

      // Test generateDocs export
      const docs = cliModule.exports.generateDocs(mockCommands, 'json');
      expect(docs).toBe('{}');
    });
  });
});