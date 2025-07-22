/**
 * @fileoverview Tests for CLI service
 * @module tests/unit/modules/core/cli/services
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CLIService } from '@/modules/core/cli/services/cli.service';
import { CommandDiscovery } from '@/cli/src/discovery.js';
import {
  CommandNotFoundError,
  CLIInitializationError,
  OutputFormattingError,
  DocumentationGenerationError
} from '@/modules/core/cli/utils/errors';
import { CLILogger, CLICommand } from '@/modules/core/cli/types';

// Mock CommandDiscovery
jest.mock('@/cli/src/discovery.js');

describe('CLIService', () => {
  let service: CLIService;
  let mockLogger: jest.Mocked<CLILogger>;
  let mockCommandDiscovery: jest.Mocked<CommandDiscovery>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (CLIService as any).instance = null;
    
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Create mock command discovery
    mockCommandDiscovery = {
      discoverCommands: jest.fn().mockResolvedValue(new Map())
    } as any;

    // Mock CommandDiscovery constructor
    (CommandDiscovery as jest.MockedClass<typeof CommandDiscovery>).mockImplementation(() => mockCommandDiscovery);

    service = CLIService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = CLIService.getInstance();
      const instance2 = CLIService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await service.initialize(mockLogger);

      expect(service.isInitialized()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('CLI service initialized');
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize(mockLogger);
      mockLogger.info.mockClear();

      await service.initialize(mockLogger);

      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should throw CLIInitializationError on failure', async () => {
      const error = new Error('Init failed');
      (CommandDiscovery as jest.MockedClass<typeof CommandDiscovery>).mockImplementationOnce(() => {
        throw error;
      });

      await expect(service.initialize(mockLogger)).rejects.toThrow(CLIInitializationError);
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(service.isInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await service.initialize(mockLogger);
      expect(service.isInitialized()).toBe(true);
    });
  });

  describe('getAllCommands', () => {
    const mockCommands = new Map<string, CLICommand>([
      ['test:command', { 
        description: 'Test command',
        execute: jest.fn()
      }]
    ]);

    beforeEach(async () => {
      await service.initialize(mockLogger);
      mockCommandDiscovery.discoverCommands.mockResolvedValue(mockCommands);
    });

    it('should return discovered commands', async () => {
      const result = await service.getAllCommands();

      expect(result).toBe(mockCommands);
      expect(mockCommandDiscovery.discoverCommands).toHaveBeenCalled();
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = CLIService.getInstance();
      
      await expect(uninitializedService.getAllCommands()).rejects.toThrow('CLI service not initialized');
    });

    it('should create command discovery if not exists', async () => {
      // Force commandDiscovery to be null
      (service as any).commandDiscovery = null;
      
      const result = await service.getAllCommands();

      expect(result).toBe(mockCommands);
      expect(CommandDiscovery).toHaveBeenCalled();
    });
  });

  describe('getCommandMetadata', () => {
    beforeEach(async () => {
      await service.initialize(mockLogger);
    });

    it('should return metadata for all commands', async () => {
      const mockCommands = new Map<string, CLICommand>([
        ['auth:login', { 
          description: 'Login command',
          options: [{ name: 'username', type: 'string', description: 'Username' }],
          positionals: [{ name: 'server', type: 'string', description: 'Server URL', required: true }],
          execute: jest.fn()
        }],
        ['help', { 
          description: 'Show help',
          execute: jest.fn()
        }]
      ]);
      mockCommandDiscovery.discoverCommands.mockResolvedValue(mockCommands);

      const result = await service.getCommandMetadata();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'auth:login',
        module: 'auth',
        commandName: 'login',
        description: 'Login command',
        usage: 'systemprompt auth:login',
        options: [{ name: 'username', type: 'string', description: 'Username' }],
        positionals: [{ name: 'server', type: 'string', description: 'Server URL', required: true }]
      });
      expect(result[1]).toEqual({
        name: 'help',
        module: 'core',
        commandName: 'help',
        description: 'Show help',
        usage: 'systemprompt help',
        options: [],
        positionals: undefined
      });
    });
  });

  describe('getCommandHelp', () => {
    beforeEach(async () => {
      await service.initialize(mockLogger);
    });

    it('should return help for existing command', async () => {
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
          examples: ['systemprompt test:command file.txt --format json'],
          execute: jest.fn()
        }]
      ]);
      mockCommandDiscovery.discoverCommands.mockResolvedValue(mockCommands);

      const result = await service.getCommandHelp('test:command');

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

    it('should throw CommandNotFoundError for non-existing command', async () => {
      mockCommandDiscovery.discoverCommands.mockResolvedValue(new Map());

      await expect(service.getCommandHelp('unknown:command')).rejects.toThrow(CommandNotFoundError);
    });

    it('should handle command with no description', async () => {
      const mockCommands = new Map<string, CLICommand>([
        ['test:command', { execute: jest.fn() } as CLICommand]
      ]);
      mockCommandDiscovery.discoverCommands.mockResolvedValue(mockCommands);

      const result = await service.getCommandHelp('test:command');

      expect(result).toContain('Description: No description available');
    });
  });

  describe('formatCommands', () => {
    beforeEach(async () => {
      await service.initialize(mockLogger);
    });

    const setupMockCommands = () => {
      const mockCommands = new Map<string, CLICommand>([
        ['auth:login', { description: 'Login command', execute: jest.fn() }],
        ['db:migrate', { description: 'Run migrations', execute: jest.fn() }],
        ['help', { description: 'Show help', execute: jest.fn() }]
      ]);
      mockCommandDiscovery.discoverCommands.mockResolvedValue(mockCommands);
    };

    it('should format commands as JSON', async () => {
      setupMockCommands();

      const result = await service.formatCommands('json');
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(3);
      expect(parsed[0].command).toBe('login');
      expect(parsed[0].module).toBe('auth');
    });

    it('should format commands as text', async () => {
      setupMockCommands();

      const result = await service.formatCommands('text');

      expect(result).toContain('auth commands:');
      expect(result).toContain('login');
      expect(result).toContain('db commands:');
      expect(result).toContain('migrate');
      expect(result).toContain('core commands:');
      expect(result).toContain('help');
    });

    it('should format commands as table', async () => {
      setupMockCommands();

      const result = await service.formatCommands('table');

      expect(result).toContain('Available Commands');
      expect(result).toContain('==================');
      expect(result).toContain('auth:login');
      expect(result).toContain('Login command');
    });

    it('should throw OutputFormattingError on failure', async () => {
      mockCommandDiscovery.discoverCommands.mockRejectedValue(new Error('Discovery failed'));

      await expect(service.formatCommands('json')).rejects.toThrow(OutputFormattingError);
    });
  });

  describe('generateDocs', () => {
    beforeEach(async () => {
      await service.initialize(mockLogger);
    });

    it('should generate markdown documentation', async () => {
      const mockCommands = new Map<string, CLICommand>([
        ['auth:login', { 
          description: 'Login to the system',
          options: [
            { name: 'username', type: 'string', description: 'Username', required: true }
          ],
          positionals: [
            { name: 'server', type: 'string', description: 'Server URL', required: false, default: 'localhost' }
          ],
          examples: ['systemprompt auth:login prod --username admin'],
          execute: jest.fn()
        }]
      ]);
      mockCommandDiscovery.discoverCommands.mockResolvedValue(mockCommands);

      const result = await service.generateDocs('markdown');

      expect(result).toContain('# SystemPrompt OS CLI Commands');
      expect(result).toContain('### auth module');
      expect(result).toContain('#### auth:login');
      expect(result).toContain('Login to the system');
      expect(result).toContain('**Positional Arguments:**');
      expect(result).toContain('`server`: Server URL (default: localhost)');
      expect(result).toContain('**Options:**');
      expect(result).toContain('`--username`: Username **[required]**');
      expect(result).toContain('**Examples:**');
      expect(result).toContain('```bash\nsystemprompt auth:login prod --username admin\n```');
    });

    it('should generate JSON documentation for non-markdown formats', async () => {
      const mockCommands = new Map<string, CLICommand>([
        ['test:command', { description: 'Test', execute: jest.fn() }]
      ]);
      mockCommandDiscovery.discoverCommands.mockResolvedValue(mockCommands);

      const result = await service.generateDocs('html');
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('test:command');
    });

    it('should throw DocumentationGenerationError on failure', async () => {
      mockCommandDiscovery.discoverCommands.mockRejectedValue(new Error('Discovery failed'));

      await expect(service.generateDocs('markdown')).rejects.toThrow(DocumentationGenerationError);
    });
  });

  describe('ensureInitialized', () => {
    it('should throw error if not initialized', () => {
      expect(() => (service as any).ensureInitialized()).toThrow('CLI service not initialized');
    });

    it('should not throw if initialized', async () => {
      await service.initialize(mockLogger);
      expect(() => (service as any).ensureInitialized()).not.toThrow();
    });
  });
});