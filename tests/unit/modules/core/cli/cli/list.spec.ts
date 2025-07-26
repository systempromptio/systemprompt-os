/**
 * @fileoverview Tests for list command
 * @module tests/unit/modules/core/cli/cli
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { command } from '@/modules/core/cli/cli/list';
import { CLIModule } from '@/modules/core/cli';
import { CLIContext } from '@/modules/core/cli/types';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';

// Mock CLIModule class
const mockCLIModule = {
  initialize: vi.fn().mockResolvedValue(undefined),
  getAllCommands: vi.fn().mockResolvedValue(new Map()),
  formatCommands: vi.fn().mockReturnValue('Formatted commands output')
};

vi.mock('@/modules/core/cli', () => ({
  CLIModule: vi.fn().mockImplementation(() => mockCLIModule)
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('list command', () => {
  let mockContext: CLIContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock functions
    mockCLIModule.initialize.mockResolvedValue(undefined);
    mockCLIModule.getAllCommands.mockResolvedValue(new Map());
    mockCLIModule.formatCommands.mockReturnValue('Formatted commands output');

    // Create mock context
    mockContext = {
      cwd: '/test/dir',
      args: {},
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    };
  });

  describe('command definition', () => {
    it('should have correct properties', () => {
      expect(command.description).toBe('List all available commands');
      expect(command.options).toHaveLength(2);
      expect(command.options![0].name).toBe('module');
      expect(command.options![1].name).toBe('format');
      expect(command.examples).toContain('systemprompt cli:list');
    });
  });

  describe('execute', () => {
    it('should list commands in default text format', async () => {
      const mockCommands = new Map([
        ['test:command', { description: 'Test', execute: vi.fn() }]
      ]);
      mockCLIModule.getAllCommands.mockResolvedValue(mockCommands);

      await command.execute(mockContext);

      expect(mockCLIModule.initialize).toHaveBeenCalledWith({ logger: mockContext.logger });
      expect(mockCLIModule.getAllCommands).toHaveBeenCalled();
      expect(mockCLIModule.formatCommands).toHaveBeenCalledWith(mockCommands, 'text');
      expect(mockConsoleLog).toHaveBeenCalledTimes(3);
      expect(mockConsoleLog).toHaveBeenNthCalledWith(1, 'SystemPrompt OS - Available Commands');
      expect(mockConsoleLog).toHaveBeenNthCalledWith(2, '====================================');
      expect(mockConsoleLog).toHaveBeenNthCalledWith(3, 'Formatted commands output');
    });

    it('should output JSON format when specified', async () => {
      mockContext.args.format = 'json';
      const mockCommands = new Map([
        ['auth:login', { description: 'Login', execute: vi.fn() }],
        ['db:migrate', { description: 'Migrate', options: [{ name: 'force' }], execute: vi.fn() }]
      ]);
      mockCLIModule.getAllCommands.mockResolvedValue(mockCommands);

      await command.execute(mockContext);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/^\[/)); // JSON array
      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(jsonOutput);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        command: 'login',
        module: 'auth',
        description: 'Login',
        usage: 'systemprompt auth:login',
        options: [],
        positionals: []
      });
    });

    it('should filter commands by module', async () => {
      mockContext.args.module = 'auth';
      const mockCommands = new Map([
        ['auth:login', { description: 'Login', execute: vi.fn() }],
        ['auth:logout', { description: 'Logout', execute: vi.fn() }],
        ['db:migrate', { description: 'Migrate', execute: vi.fn() }]
      ]);
      mockCLIModule.getAllCommands.mockResolvedValue(mockCommands);

      await command.execute(mockContext);

      const expectedFiltered = new Map([
        ['auth:login', { description: 'Login', execute: expect.any(Function) }],
        ['auth:logout', { description: 'Logout', execute: expect.any(Function) }]
      ]);
      
      expect(mockCLIModule.formatCommands).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 2
        }),
        'text'
      );
    });

    it('should handle empty module filter', async () => {
      mockContext.args.module = 'nonexistent';
      const mockCommands = new Map([
        ['auth:login', { description: 'Login', execute: vi.fn() }]
      ]);
      mockCLIModule.getAllCommands.mockResolvedValue(mockCommands);

      await command.execute(mockContext);

      expect(mockCLIModule.formatCommands).toHaveBeenCalledWith(
        expect.objectContaining({ size: 0 }),
        'text'
      );
    });

    it('should use table format when specified', async () => {
      mockContext.args.format = 'table';
      const mockCommands = new Map();
      mockCLIModule.getAllCommands.mockResolvedValue(mockCommands);

      await command.execute(mockContext);

      expect(mockCLIModule.formatCommands).toHaveBeenCalledWith(mockCommands, 'table');
    });

    it('should throw CommandExecutionError on failure', async () => {
      const error = new Error('getAllCommands failed');
      mockCLIModule.getAllCommands.mockRejectedValue(error);

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:list');
    });

    it('should handle commands without module prefix', async () => {
      mockContext.args.format = 'json';
      const mockCommands = new Map([
        ['help', { description: 'Show help', execute: vi.fn() }]
      ]);
      mockCLIModule.getAllCommands.mockResolvedValue(mockCommands);

      await command.execute(mockContext);

      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(jsonOutput);
      
      expect(parsed[0].module).toBe('core');
      expect(parsed[0].command).toBe('help');
    });
  });
});