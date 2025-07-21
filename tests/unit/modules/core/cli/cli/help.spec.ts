import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/cli/cli/help';
import { CLIModule } from '../../../../../../src/modules/core/cli/index.js';

vi.mock('../../../../../../src/modules/core/cli/index.js');

describe('CLI Help Command', () => {
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
        ['test:command', { description: 'Test command' }],
        ['another:command', { description: 'Another command' }]
      ])),
      getCommandHelp: vi.fn().mockImplementation((name) => `Help for ${name}`),
      formatCommands: vi.fn().mockReturnValue('Formatted commands list')
    };

    vi.mocked(CLIModule).mockImplementation(() => mockCLIModule);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should show general help when no arguments provided', async () => {
      const context = {
        cwd: '/test',
        args: {}
      };

      await command.execute(context);

      expect(mockCLIModule.initialize).toHaveBeenCalledWith({ config: {} });
      expect(mockCLIModule.getAllCommands).toHaveBeenCalled();
      expect(mockCLIModule.formatCommands).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('\nSystemPrompt OS CLI');
      expect(consoleLogSpy).toHaveBeenCalledWith('Usage: systemprompt <command> [options]\n');
      expect(consoleLogSpy).toHaveBeenCalledWith('Commands:');
      expect(consoleLogSpy).toHaveBeenCalledWith('Formatted commands list');
    });

    it('should show help for specific command when command argument provided', async () => {
      const context = {
        cwd: '/test',
        args: {
          command: 'test:command'
        }
      };

      await command.execute(context);

      expect(mockCLIModule.getCommandHelp).toHaveBeenCalledWith('test:command', expect.any(Map));
      expect(consoleLogSpy).toHaveBeenCalledWith('Help for test:command');
    });

    it('should show all commands with details when --all flag provided', async () => {
      const context = {
        cwd: '/test',
        args: {
          all: true
        }
      };

      await command.execute(context);

      expect(consoleLogSpy).toHaveBeenCalledWith('\nSystemPrompt OS - All Available Commands');
      expect(consoleLogSpy).toHaveBeenCalledWith('========================================\n');
      expect(mockCLIModule.getCommandHelp).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith('-'.repeat(40));
    });

    it('should handle errors gracefully', async () => {
      const context = {
        cwd: '/test',
        args: {}
      };

      mockCLIModule.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(command.execute(context)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error displaying help:', expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle command help error', async () => {
      const context = {
        cwd: '/test',
        args: {
          command: 'invalid:command'
        }
      };

      mockCLIModule.getCommandHelp.mockImplementation(() => {
        throw new Error('Command not found');
      });

      await expect(command.execute(context)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error displaying help:', expect.any(Error));
    });
  });
});