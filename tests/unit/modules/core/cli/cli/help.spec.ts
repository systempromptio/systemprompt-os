/**
 * @fileoverview Tests for help command
 * @module tests/unit/modules/core/cli/cli
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { command } from '@/modules/core/cli/cli/help';
import { CLIModule } from '@/modules/core/cli';
import { CLIContext, CLICommand } from '@/modules/core/cli/types';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';

// Mock CLIModule
jest.mock('@/modules/core/cli');

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('help command', () => {
  let mockCLIModule: jest.Mocked<CLIModule>;
  let mockContext: CLIContext;
  let mockCommands: Map<string, CLICommand>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock commands
    mockCommands = new Map([
      ['auth:login', {
        description: 'Login to the system',
        options: [
          { name: 'username', type: 'string', description: 'Username', required: true }
        ],
        execute: jest.fn()
      }],
      ['db:migrate', {
        description: 'Run database migrations',
        execute: jest.fn()
      }]
    ]);

    // Create mock CLI module instance
    mockCLIModule = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getAllCommands: jest.fn().mockResolvedValue(mockCommands),
      getCommandHelp: jest.fn().mockImplementation((name) => `Help for ${name}`),
      formatCommands: jest.fn().mockReturnValue('Formatted commands')
    } as any;

    // Mock CLIModule constructor
    (CLIModule as jest.MockedClass<typeof CLIModule>).mockImplementation(() => mockCLIModule);

    // Create mock context
    mockContext = {
      cwd: '/test/dir',
      args: {},
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    };
  });

  describe('command definition', () => {
    it('should have correct properties', () => {
      expect(command.description).toBe('Show help information for commands');
      expect(command.options).toHaveLength(2);
      expect(command.options![0].name).toBe('command');
      expect(command.options![1].name).toBe('all');
      expect(command.examples).toContain('systemprompt cli:help');
    });
  });

  describe('execute', () => {
    it('should show general help when no args provided', async () => {
      await command.execute(mockContext);

      expect(mockCLIModule.initialize).toHaveBeenCalledWith({ logger: mockContext.logger });
      expect(mockCLIModule.getAllCommands).toHaveBeenCalled();
      expect(mockCLIModule.formatCommands).toHaveBeenCalledWith(mockCommands, 'text');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('SystemPrompt OS CLI'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Usage: systemprompt <command> [options]'));
      expect(mockConsoleLog).toHaveBeenCalledWith('Commands:');
      expect(mockConsoleLog).toHaveBeenCalledWith('Formatted commands');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('For detailed help on a specific command:'));
    });

    it('should show help for specific command', async () => {
      mockContext.args.command = 'auth:login';
      mockCLIModule.getCommandHelp.mockReturnValue('Detailed help for auth:login');

      await command.execute(mockContext);

      expect(mockCLIModule.getCommandHelp).toHaveBeenCalledWith('auth:login', mockCommands);
      expect(mockConsoleLog).toHaveBeenCalledWith('Detailed help for auth:login');
      expect(mockCLIModule.formatCommands).not.toHaveBeenCalled();
    });

    it('should show all commands with details when --all flag is set', async () => {
      mockContext.args.all = true;

      await command.execute(mockContext);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('SystemPrompt OS - All Available Commands'));
      expect(mockConsoleLog).toHaveBeenCalledWith('========================================\n');
      
      // Should show help for each command
      expect(mockCLIModule.getCommandHelp).toHaveBeenCalledWith('auth:login', mockCommands);
      expect(mockCLIModule.getCommandHelp).toHaveBeenCalledWith('db:migrate', mockCommands);
      expect(mockCLIModule.getCommandHelp).toHaveBeenCalledTimes(2);
      
      // Should show separator between commands
      expect(mockConsoleLog).toHaveBeenCalledWith('-'.repeat(40));
    });

    it('should sort commands alphabetically when showing all', async () => {
      mockContext.args.all = true;
      
      // Add more commands to test sorting
      mockCommands.set('z:last', { description: 'Last command', execute: jest.fn() });
      mockCommands.set('a:first', { description: 'First command', execute: jest.fn() });

      await command.execute(mockContext);

      // Check that getCommandHelp was called in alphabetical order
      const calls = mockCLIModule.getCommandHelp.mock.calls.map(call => call[0]);
      expect(calls).toEqual(['a:first', 'auth:login', 'db:migrate', 'z:last']);
    });

    it('should throw CommandExecutionError on failure', async () => {
      const error = new Error('getAllCommands failed');
      mockCLIModule.getAllCommands.mockRejectedValue(error);

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });

    it('should handle command not found gracefully', async () => {
      mockContext.args.command = 'unknown:command';
      mockCLIModule.getCommandHelp.mockReturnValue('Command not found: unknown:command');

      await command.execute(mockContext);

      expect(mockConsoleLog).toHaveBeenCalledWith('Command not found: unknown:command');
    });

    it('should initialize with logger from context', async () => {
      await command.execute(mockContext);

      expect(mockCLIModule.initialize).toHaveBeenCalledWith({ logger: mockContext.logger });
    });
  });
});