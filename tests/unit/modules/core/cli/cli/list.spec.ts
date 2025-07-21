import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/cli/cli/list';
import { CLIModule } from '../../../../../../src/modules/core/cli/index.js';

vi.mock('../../../../../../src/modules/core/cli/index.js');

describe('CLI List Command', () => {
  let mockCLIModule: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Mock CLIModule
    mockCLIModule = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getAllCommands: vi.fn().mockResolvedValue(new Map([
        ['auth:providers', { description: 'List auth providers' }],
        ['auth:tunnel', { description: 'Manage tunnel' }],
        ['config:get', { description: 'Get config value' }],
        ['config:set', { description: 'Set config value' }]
      ])),
      formatCommands: vi.fn().mockReturnValue('Formatted commands output')
    };

    vi.mocked(CLIModule).mockImplementation(() => mockCLIModule);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should list all commands with default text format', async () => {
      const context = {
        cwd: '/test',
        args: {}
      };

      await command.execute(context);

      expect(mockCLIModule.initialize).toHaveBeenCalledWith({ config: {} });
      expect(mockCLIModule.getAllCommands).toHaveBeenCalled();
      expect(mockCLIModule.formatCommands).toHaveBeenCalledWith(expect.any(Map), 'text');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nSystemPrompt OS - Available Commands');
      expect(consoleLogSpy).toHaveBeenCalledWith('====================================');
      expect(consoleLogSpy).toHaveBeenCalledWith('Formatted commands output');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nTotal commands: 4');
    });

    it('should filter commands by module when module arg provided', async () => {
      const context = {
        cwd: '/test',
        args: {
          module: 'auth'
        }
      };

      await command.execute(context);

      expect(mockCLIModule.formatCommands).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 2
        }),
        'text'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('\nTotal commands: 2');
    });

    it('should show message when no commands found for module', async () => {
      const context = {
        cwd: '/test',
        args: {
          module: 'nonexistent'
        }
      };

      await command.execute(context);

      expect(consoleLogSpy).toHaveBeenCalledWith('No commands found for module: nonexistent');
      expect(mockCLIModule.formatCommands).not.toHaveBeenCalled();
    });

    it('should support JSON format', async () => {
      const context = {
        cwd: '/test',
        args: {
          format: 'json'
        }
      };

      mockCLIModule.formatCommands.mockReturnValue('{"commands": []}');

      await command.execute(context);

      expect(mockCLIModule.formatCommands).toHaveBeenCalledWith(expect.any(Map), 'json');
      expect(consoleLogSpy).toHaveBeenCalledWith('{"commands": []}');
      // Should not print header for JSON format
      expect(consoleLogSpy).not.toHaveBeenCalledWith('\nSystemPrompt OS - Available Commands');
    });

    it('should support table format', async () => {
      const context = {
        cwd: '/test',
        args: {
          format: 'table'
        }
      };

      await command.execute(context);

      expect(mockCLIModule.formatCommands).toHaveBeenCalledWith(expect.any(Map), 'table');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nSystemPrompt OS - Available Commands');
      expect(consoleLogSpy).toHaveBeenCalledWith('====================================');
      // Should not print total for table format
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Total commands:'));
    });

    it('should handle errors gracefully', async () => {
      const context = {
        cwd: '/test',
        args: {}
      };

      mockCLIModule.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(command.execute(context)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error listing commands:', expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle formatCommands error', async () => {
      const context = {
        cwd: '/test',
        args: {}
      };

      mockCLIModule.formatCommands.mockImplementation(() => {
        throw new Error('Format failed');
      });

      await expect(command.execute(context)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error listing commands:', expect.any(Error));
    });
  });
});