/**
 * @fileoverview Tests for CLI service
 * @module tests/unit/modules/core/cli/services
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CliService } from '@/modules/core/cli/services/cli.service';
import {
  CommandNotFoundError,
  CliInitializationError,
  OutputFormattingError,
  DocumentationGenerationError
} from '@/modules/core/cli/utils/errors';
import { CLILogger, CLICommand } from '@/modules/core/cli/types';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

// Mock filesystem and yaml operations
vi.mock('fs');
vi.mock('yaml');
vi.mock('path');

describe('CliService', () => {
  let service: CliService;
  let mockLogger: CLILogger;
  let mockDatabase: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton instance
    (CliService as any).instance = null;
    
    // Create mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    // Create mock database service
    mockDatabase = {
      execute: vi.fn(),
      query: vi.fn().mockResolvedValue([])
    } as any;

    service = CliService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = CliService.getInstance();
      const instance2 = CliService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', () => {
      service.initialize(mockLogger, mockDatabase);

      expect(service.isInitialized()).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        LogSource.CLI,
        'CLI service initialized',
        expect.objectContaining({
          category: 'init',
          persistToDb: false
        })
      );
    });

    it('should not reinitialize if already initialized', () => {
      service.initialize(mockLogger, mockDatabase);
      vi.mocked(mockLogger.debug).mockClear();

      service.initialize(mockLogger, mockDatabase);

      // Should not call debug again since already initialized
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should throw CliInitializationError on failure', () => {
      const error = new Error('Init failed');
      // Mock logger to throw error
      const failingLogger = {
        debug: vi.fn(() => { throw error; }),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };

      expect(() => service.initialize(failingLogger, mockDatabase))
        .toThrow(CliInitializationError);
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(service.isInitialized()).toBe(false);
    });

    it('should return true after initialization', () => {
      service.initialize(mockLogger, mockDatabase);
      expect(service.isInitialized()).toBe(true);
    });
  });

  describe('getAllCommands', () => {
    const mockDatabaseCommands = [
      {
        id: 1,
        command_path: 'test:command',
        command_name: 'command',
        description: 'Test command',
        module_name: 'test',
        executor_path: '/path/to/executor.ts',
        options: JSON.stringify([]),
        aliases: JSON.stringify([]),
        active: 1,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }
    ];

    beforeEach(() => {
      service.initialize(mockLogger, mockDatabase);
      vi.mocked(mockDatabase.query).mockResolvedValue(mockDatabaseCommands);
    });

    it('should return commands from database', async () => {
      const result = await service.getAllCommands();

      expect(result.size).toBe(1);
      expect(result.has('test:command')).toBe(true);
      const command = result.get('test:command');
      expect(command).toEqual({
        name: 'command',
        description: 'Test command',
        options: [],
        executorPath: '/path/to/executor.ts'
      });
      expect(mockDatabase.query).toHaveBeenCalledWith(
        'SELECT * FROM cli_commands WHERE active = 1 ORDER BY command_path'
      );
    });

    it('should throw error if not initialized', async () => {
      // Reset singleton to get a fresh uninitialized instance
      (CliService as any).instance = null;
      const uninitializedService = CliService.getInstance();
      
      await expect(uninitializedService.getAllCommands()).rejects.toThrow('CLI service not initialized');
    });

    it('should handle empty database results', async () => {
      vi.mocked(mockDatabase.query).mockResolvedValue([]);
      
      const result = await service.getAllCommands();

      expect(result.size).toBe(0);
    });
  });

  describe('getCommandMetadata', () => {
    beforeEach(() => {
      service.initialize(mockLogger, mockDatabase);
    });

    it('should return metadata for all commands', async () => {
      const mockDatabaseCommands = [
        {
          id: 1,
          command_path: 'auth:login',
          command_name: 'login',
          description: 'Login command',
          module_name: 'auth',
          executor_path: '/path/to/auth/login.ts',
          options: JSON.stringify([{ name: 'username', type: 'string', description: 'Username' }]),
          aliases: JSON.stringify([]),
          active: 1,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        {
          id: 2,
          command_path: 'help',
          command_name: 'help',
          description: 'Show help',
          module_name: 'core',
          executor_path: '/path/to/core/help.ts',
          options: JSON.stringify([]),
          aliases: JSON.stringify([]),
          active: 1,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];
      vi.mocked(mockDatabase.query).mockResolvedValue(mockDatabaseCommands);

      const result = await service.getCommandMetadata();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'auth:login',
        module: 'auth',
        commandName: 'login',
        description: 'Login command',
        usage: 'systemprompt auth:login',
        options: [{ name: 'username', type: 'string', description: 'Username' }]
      });
      expect(result[1]).toEqual({
        name: 'help',
        module: 'core',
        commandName: 'help',
        description: 'Show help',
        usage: 'systemprompt help',
        options: []
      });
    });

    it('should handle commands without description', async () => {
      const mockDatabaseCommands = [
        {
          id: 1,
          command_path: 'test:command',
          command_name: 'command',
          description: null,
          module_name: 'test',
          executor_path: '/path/to/test.ts',
          options: JSON.stringify([]),
          aliases: JSON.stringify([]),
          active: 1,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];
      vi.mocked(mockDatabase.query).mockResolvedValue(mockDatabaseCommands);

      const result = await service.getCommandMetadata();

      expect(result[0].description).toBe('No description available');
    });
  });

  describe('getCommandHelp', () => {
    it('should return help for existing command', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['test:command', { 
          description: 'Test command',
          options: [
            { 
              name: 'format',
              type: 'string',
              description: 'Output format',
              alias: 'f',
              default: 'json',
              required: false,
              choices: ['json', 'text']
            }
          ],
          positionals: [
            {
              name: 'file',
              type: 'string',
              description: 'Input file',
              required: true
            }
          ],
          examples: ['systemprompt test:command file.txt --format json']
        }]
      ]);

      const result = service.getCommandHelp('test:command', mockCommands);

      expect(result).toContain('Command: test:command');
      expect(result).toContain('Description: Test command');
      expect(result).toContain('Positional Arguments:');
      expect(result).toContain('file [required]');
      expect(result).toContain('Input file');
      expect(result).toContain('Options:');
      expect(result).toContain('--format, -f');
      expect(result).toContain('Output format (default: json)');
      expect(result).toContain('Choices: json, text');
      expect(result).toContain('Examples:');
      expect(result).toContain('systemprompt test:command file.txt --format json');
    });

    it('should throw CommandNotFoundError for non-existing command', () => {
      const mockCommands = new Map<string, CLICommand>();

      expect(() => service.getCommandHelp('unknown:command', mockCommands))
        .toThrow(CommandNotFoundError);
    });

    it('should handle command with no description', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['test:command', {} as CLICommand]
      ]);

      const result = service.getCommandHelp('test:command', mockCommands);

      expect(result).toContain('Description: No description available');
    });

    it('should handle command with no options or positionals', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['simple:command', { 
          description: 'Simple command'
        }]
      ]);

      const result = service.getCommandHelp('simple:command', mockCommands);

      expect(result).toContain('Command: simple:command');
      expect(result).toContain('Description: Simple command');
      expect(result).not.toContain('Positional Arguments:');
      expect(result).not.toContain('Options:');
      expect(result).not.toContain('Examples:');
    });

    it('should handle optional positional arguments with defaults', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['test:command', { 
          description: 'Test command',
          positionals: [
            {
              name: 'file',
              type: 'string',
              description: 'Input file',
              required: false,
              default: 'default.txt'
            }
          ]
        }]
      ]);

      const result = service.getCommandHelp('test:command', mockCommands);

      expect(result).toContain('file [optional]');
      expect(result).toContain('Default: default.txt');
    });

    it('should handle options without aliases or defaults', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['test:command', { 
          description: 'Test command',
          options: [
            { 
              name: 'verbose',
              type: 'boolean',
              description: 'Enable verbose output',
              required: true
            }
          ]
        }]
      ]);

      const result = service.getCommandHelp('test:command', mockCommands);

      expect(result).toContain('--verbose');
      expect(result).not.toContain(', -');
      expect(result).not.toContain('(default:');
      expect(result).toContain('[required]');
    });
  });

  describe('formatCommands', () => {
    const mockCommands = new Map<string, CLICommand>([
      ['auth:login', { description: 'Login command' }],
      ['db:migrate', { description: 'Run migrations' }],
      ['help', { description: 'Show help' }]
    ]);

    it('should format commands as JSON', () => {
      const result = service.formatCommands(mockCommands, 'json');
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(3);
      expect(parsed.find((cmd: any) => cmd.name === 'auth:login')).toEqual({
        name: 'auth:login',
        module: 'auth',
        commandName: 'login',
        description: 'Login command',
        usage: 'systemprompt auth:login',
        options: []
      });
    });

    it('should format commands as text', () => {
      const result = service.formatCommands(mockCommands, 'text');

      expect(result).toContain('auth:');
      expect(result).toContain('auth:login - Login command');
      expect(result).toContain('core:');
      expect(result).toContain('core:help - Show help');
      expect(result).toContain('db:');
      expect(result).toContain('db:migrate - Run migrations');
    });

    it('should format commands as table', () => {
      const result = service.formatCommands(mockCommands, 'table');

      expect(result).toContain('auth:');
      expect(result).toContain('-----');
      expect(result).toContain('login');
      expect(result).toContain('Login command');
    });

    it('should default to text format', () => {
      const result = service.formatCommands(mockCommands);
      
      expect(result).toContain('auth:login - Login command');
    });

    it('should handle commands without descriptions', () => {
      const commandsWithoutDesc = new Map<string, CLICommand>([
        ['test:command', {}]
      ]);

      const result = service.formatCommands(commandsWithoutDesc, 'json');
      const parsed = JSON.parse(result);

      expect(parsed[0].description).toBe('No description available');
    });

    it('should sort modules and commands alphabetically', () => {
      const unsortedCommands = new Map<string, CLICommand>([
        ['z:last', { description: 'Last command' }],
        ['a:first', { description: 'First command' }],
        ['m:middle', { description: 'Middle command' }]
      ]);

      const result = service.formatCommands(unsortedCommands, 'text');
      const lines = result.split('\n').filter(line => line.includes(':'));
      
      // Should appear in alphabetical order by module
      expect(lines.findIndex(line => line.includes('a:first'))).toBeLessThan(
        lines.findIndex(line => line.includes('m:middle'))
      );
      expect(lines.findIndex(line => line.includes('m:middle'))).toBeLessThan(
        lines.findIndex(line => line.includes('z:last'))
      );
    });

    it('should handle modules with multiple commands in alphabetical order', () => {
      const multiCommandModules = new Map<string, CLICommand>([
        ['test:zebra', { description: 'Zebra command' }],
        ['test:alpha', { description: 'Alpha command' }],
        ['auth:logout', { description: 'Logout command' }],
        ['auth:login', { description: 'Login command' }]
      ]);

      const result = service.formatCommands(multiCommandModules, 'table');
      
      // Commands within same module should be sorted
      expect(result).toContain('alpha');
      expect(result).toContain('zebra');
      expect(result).toContain('login');
      expect(result).toContain('logout');
      
      // Check that alpha comes before zebra in the output
      const alphaIndex = result.indexOf('alpha');
      const zebraIndex = result.indexOf('zebra');
      expect(alphaIndex).toBeLessThan(zebraIndex);
    });

    it('should handle edge case with empty module name', () => {
      // Create a command with empty module name 
      const mockCommands = new Map<string, CLICommand>([
        [':', { description: 'Command with empty module' }]
      ]);

      const result = service.formatCommands(mockCommands, 'text');
      
      // Should handle the empty module name gracefully by creating an empty module section
      expect(result).toContain(':');
      expect(result).toContain('Command with empty module');
    });

    it('should throw OutputFormattingError on JSON.stringify failure', () => {
      // Mock JSON.stringify to throw an error
      const originalStringify = JSON.stringify;
      JSON.stringify = vi.fn(() => { throw new Error('JSON error'); });

      const mockCommands = new Map<string, CLICommand>([
        ['test:command', { description: 'Test' }]
      ]);

      try {
        expect(() => service.formatCommands(mockCommands, 'json'))
          .toThrow(OutputFormattingError);
      } finally {
        JSON.stringify = originalStringify;
      }
    });
  });

  describe('generateDocs', () => {
    it('should generate markdown documentation', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['auth:login', { 
          description: 'Login to the system',
          options: [
            { name: 'username', type: 'string', description: 'Username', required: true }
          ],
          examples: ['systemprompt auth:login prod --username admin']
        }]
      ]);

      const result = service.generateDocs(mockCommands, 'markdown');

      expect(result).toContain('# SystemPrompt OS CLI Commands');
      expect(result).toContain('Generated on');
      expect(result).toContain('## Table of Contents');
      expect(result).toContain('- [auth](#auth)');
      expect(result).toContain('## Commands by Module');
      expect(result).toContain('### auth');
      expect(result).toContain('#### auth:login');
      expect(result).toContain('Login to the system');
      expect(result).toContain('**Usage:** `systemprompt auth:login`');
      expect(result).toContain('**Options:**');
      expect(result).toContain('- `--username`: Username **[required]**');
      expect(result).toContain('**Examples:**');
      expect(result).toContain('```bash\nsystemprompt auth:login prod --username admin\n```');
    });

    it('should handle commands without descriptions', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['test:command', {}]
      ]);

      const result = service.generateDocs(mockCommands, 'markdown');

      expect(result).toContain('No description available');
    });

    it('should handle options with aliases and defaults', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['test:command', { 
          description: 'Test command',
          options: [
            {
              name: 'format',
              type: 'string',
              description: 'Output format',
              alias: 'f',
              default: 'json'
            }
          ]
        }]
      ]);

      const result = service.generateDocs(mockCommands, 'markdown');

      expect(result).toContain('- `--format, -f`: Output format (default: json)');
    });

    it('should sort modules and commands alphabetically', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['z:last', { description: 'Last command' }],
        ['a:first', { description: 'First command' }]
      ]);

      const result = service.generateDocs(mockCommands, 'markdown');
      const aIndex = result.indexOf('### a');
      const zIndex = result.indexOf('### z');
      
      expect(aIndex).toBeLessThan(zIndex);
    });

    it('should sort commands within modules alphabetically', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['auth:zebra', { description: 'Zebra command' }],
        ['auth:alpha', { description: 'Alpha command' }],
        ['auth:beta', { description: 'Beta command' }]
      ]);

      const result = service.generateDocs(mockCommands, 'markdown');
      
      // Check that commands are sorted within the module
      const alphaIndex = result.indexOf('#### auth:alpha');
      const betaIndex = result.indexOf('#### auth:beta');
      const zebraIndex = result.indexOf('#### auth:zebra');
      
      expect(alphaIndex).toBeLessThan(betaIndex);
      expect(betaIndex).toBeLessThan(zebraIndex);
    });

    it('should throw error for unsupported formats', () => {
      const mockCommands = new Map<string, CLICommand>();

      expect(() => service.generateDocs(mockCommands, 'html'))
        .toThrow('Unsupported documentation format: html');
    });

    it('should throw DocumentationGenerationError on failure', () => {
      const mockCommands = new Map<string, CLICommand>([
        ['test:command', { description: 'Test' }]
      ]);

      // Mock Date.prototype.toISOString to throw an error
      const originalToISOString = Date.prototype.toISOString;
      Date.prototype.toISOString = () => { throw new Error('Date error'); };

      try {
        expect(() => service.generateDocs(mockCommands, 'markdown'))
          .toThrow(DocumentationGenerationError);
      } finally {
        Date.prototype.toISOString = originalToISOString;
      }
    });
  });

  describe('registerCommand', () => {
    beforeEach(() => {
      service.initialize(mockLogger, mockDatabase);
    });

    it('should register a command successfully', async () => {
      const command: CLICommand = {
        name: 'test-command',
        description: 'Test command description',
        options: [{ name: 'verbose', type: 'boolean', description: 'Verbose output' }]
      };

      await service.registerCommand(command, 'test-module', '/path/to/executor.ts');

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO cli_commands \n       (command_path, command_name, description, module_name, executor_path, options, aliases, active)\n       VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          'test-module:test-command',
          'test-command',
          'Test command description',
          'test-module',
          '/path/to/executor.ts',
          JSON.stringify([{ name: 'verbose', type: 'boolean', description: 'Verbose output' }]),
          JSON.stringify([]),
          1
        ]
      );
    });

    it('should handle command without name', async () => {
      const command: CLICommand = {
        description: 'Test command'
      };

      await service.registerCommand(command, 'test-module', '/path/to/executor.ts');

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'test-module:unknown',
          'unknown'
        ])
      );
    });

    it('should throw error if database not initialized', async () => {
      // Reset singleton to get a fresh uninitialized instance
      (CliService as any).instance = null;
      const uninitializedService = CliService.getInstance();
      const command: CLICommand = { description: 'Test' };

      await expect(uninitializedService.registerCommand(command, 'test', '/path'))
        .rejects.toThrow('Database not initialized');
    });
  });

  describe('getCommandsFromDatabase', () => {
    beforeEach(() => {
      service.initialize(mockLogger, mockDatabase);
    });

    it('should return parsed commands from database', async () => {
      const mockDatabaseResult = [
        {
          id: 1,
          command_path: 'test:command',
          command_name: 'command',
          description: 'Test command',
          module_name: 'test',
          executor_path: '/path/to/executor.ts',
          options: '[{"name":"verbose","type":"boolean"}]',
          aliases: '["t"]',
          active: 1,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];
      vi.mocked(mockDatabase.query).mockResolvedValue(mockDatabaseResult);

      const result = await service.getCommandsFromDatabase();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...mockDatabaseResult[0],
        options: [{ name: 'verbose', type: 'boolean' }],
        aliases: ['t']
      });
    });

    it('should handle invalid JSON in options and aliases', async () => {
      const mockDatabaseResult = [
        {
          id: 1,
          command_path: 'test:command',
          command_name: 'command',
          description: 'Test command',
          module_name: 'test',
          executor_path: '/path/to/executor.ts',
          options: null,
          aliases: null,
          active: 1,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];
      vi.mocked(mockDatabase.query).mockResolvedValue(mockDatabaseResult);

      const result = await service.getCommandsFromDatabase();

      expect(result[0].options).toEqual([]);
      expect(result[0].aliases).toEqual([]);
    });

    it('should throw error if database not initialized', async () => {
      // Reset singleton to get a fresh uninitialized instance
      (CliService as any).instance = null;
      const uninitializedService = CliService.getInstance();

      await expect(uninitializedService.getCommandsFromDatabase())
        .rejects.toThrow('Database not initialized');
    });
  });

  describe('parseModuleYaml', () => {
    it('should parse valid YAML file', () => {
      const yamlPath = '/path/to/module.yaml';
      const yamlContent = `
cli:
  commands:
    - name: test-command
      description: Test command
      executor: cli/test.ts
`;
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(yamlContent);
      vi.mocked(parse).mockReturnValue({
        cli: {
          commands: [
            {
              name: 'test-command',
              description: 'Test command',
              executor: 'cli/test.ts'
            }
          ]
        }
      });

      const result = service.parseModuleYaml(yamlPath);

      expect(result).toEqual([
        {
          name: 'test-command',
          description: 'Test command',
          executor: 'cli/test.ts'
        }
      ]);
      expect(existsSync).toHaveBeenCalledWith(yamlPath);
      expect(readFileSync).toHaveBeenCalledWith(yamlPath, 'utf-8');
    });

    it('should return empty array if file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = service.parseModuleYaml('/nonexistent/path');

      expect(result).toEqual([]);
      expect(readFileSync).not.toHaveBeenCalled();
    });

    it('should return empty array if no CLI commands defined', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('name: test-module');
      vi.mocked(parse).mockReturnValue({ name: 'test-module' });

      const result = service.parseModuleYaml('/path/to/module.yaml');

      expect(result).toEqual([]);
    });
  });

  describe('clearAllCommands', () => {
    beforeEach(() => {
      service.initialize(mockLogger, mockDatabase);
    });

    it('should clear all commands from database', async () => {
      await service.clearAllCommands();

      expect(mockDatabase.execute).toHaveBeenCalledWith('DELETE FROM cli_commands');
    });

    it('should throw error if database not initialized', async () => {
      // Reset singleton to get a fresh uninitialized instance
      (CliService as any).instance = null;
      const uninitializedService = CliService.getInstance();

      await expect(uninitializedService.clearAllCommands())
        .rejects.toThrow('Database not initialized');
    });
  });

  describe('scanAndRegisterModuleCommands', () => {
    beforeEach(() => {
      service.initialize(mockLogger, mockDatabase);
    });

    it('should scan and register commands from valid modules', async () => {
      const modules = new Map([
        ['test-module', { path: '/path/to/test-module' }],
        ['another-module', { path: '/path/to/another-module' }]
      ]);

      const yamlContent = `
cli:
  commands:
    - name: test-command
      description: Test command
`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(yamlContent);
      vi.mocked(parse).mockReturnValue({
        cli: {
          commands: [
            {
              name: 'test-command',
              description: 'Test command'
            }
          ]
        }
      });
      vi.mocked(join).mockImplementation((...paths) => paths.join('/'));

      await service.scanAndRegisterModuleCommands(modules);

      expect(mockDatabase.execute).toHaveBeenCalledWith('DELETE FROM cli_commands');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        LogSource.CLI,
        'Scanning 2 modules for CLI commands',
        expect.objectContaining({ category: 'commands', persistToDb: false })
      );
    });

    it('should skip modules without module.yaml', async () => {
      const modules = new Map([
        ['invalid-module', { path: '/path/to/invalid-module' }]
      ]);

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(join).mockImplementation((...paths) => paths.join('/'));

      await service.scanAndRegisterModuleCommands(modules);

      expect(mockDatabase.execute).toHaveBeenCalledWith('DELETE FROM cli_commands');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        LogSource.CLI,
        'Module YAML not found for invalid-module: /path/to/invalid-module/module.yaml',
        expect.objectContaining({ category: 'commands', persistToDb: false })
      );
    });

    it('should handle YAML parsing errors gracefully', async () => {
      const modules = new Map([
        ['broken-module', { path: '/path/to/broken-module' }]
      ]);

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });
      vi.mocked(join).mockImplementation((...paths) => paths.join('/'));

      await service.scanAndRegisterModuleCommands(modules);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        LogSource.CLI,
        'Failed to parse commands from module broken-module',
        expect.objectContaining({
          category: 'commands',
          error: expect.any(Error)
        })
      );
    });
  });

  describe('ensureInitialized', () => {
    it('should throw error if not initialized', () => {
      expect(() => (service as any).ensureInitialized()).toThrow('CLI service not initialized');
    });

    it('should not throw if initialized', () => {
      service.initialize(mockLogger, mockDatabase);
      expect(() => (service as any).ensureInitialized()).not.toThrow();
    });
  });
});