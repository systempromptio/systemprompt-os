/**
 * @fileoverview Tests for help command
 * @module tests/unit/modules/core/cli/cli
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { command } from '@/modules/core/cli/cli/help';
import { getModuleLoader } from '@/modules/loader';
import { HelpService } from '@/modules/core/cli/services/help.service';
import { CLIContext } from '@/modules/core/cli/types';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors';

// Mock dependencies
vi.mock('@/modules/loader');
vi.mock('@/modules/core/cli/services/help.service');

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('help command', () => {
  let mockContext: CLIContext;
  let mockCliService: any;
  let mockHelpService: any;
  let mockModuleLoader: any;
  let mockCliModule: any;
  let mockCommands: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock commands
    mockCommands = new Map([
      ['auth:login', {
        description: 'Login to the system',
        options: [
          { name: 'username', type: 'string', description: 'Username', required: true }
        ],
        execute: vi.fn()
      }],
      ['db:migrate', {
        description: 'Run database migrations',
        execute: vi.fn()
      }]
    ]);

    // Create mock CLI service
    mockCliService = {
      getAllCommands: vi.fn().mockResolvedValue(mockCommands),
      getCommandHelp: vi.fn().mockImplementation((name) => `Help for ${name}`),
      formatCommands: vi.fn().mockReturnValue('Formatted commands')
    };

    // Create mock CLI module
    mockCliModule = {
      exports: {
        service: vi.fn().mockReturnValue(mockCliService)
      }
    };

    // Create mock module loader
    mockModuleLoader = {
      getModule: vi.fn().mockReturnValue(mockCliModule)
    };

    // Create mock HelpService
    mockHelpService = {
      showSpecificCommandHelp: vi.fn().mockResolvedValue(undefined),
      showAllCommands: vi.fn().mockResolvedValue(undefined),
      showGeneralHelp: vi.fn().mockResolvedValue(undefined)
    };

    // Setup mocks
    vi.mocked(getModuleLoader).mockReturnValue(mockModuleLoader);
    vi.mocked(HelpService.getInstance).mockReturnValue(mockHelpService);

    // Create mock context
    mockContext = {
      cwd: '/test/dir',
      args: {},
      flags: {},
      env: {},
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
      expect(command.description).toBe('Show help information for commands');
      expect(command.options).toHaveLength(2);
      expect(command.options![0].name).toBe('command');
      expect(command.options![0].type).toBe('string');
      expect(command.options![0].description).toBe('Specific command to get help for');
      expect(command.options![1].name).toBe('all');
      expect(command.options![1].alias).toBe('a');
      expect(command.options![1].type).toBe('boolean');
      expect(command.options![1].description).toBe('Show all available commands with details');
      expect(command.options![1].default).toBe(false);
      expect(command.examples).toHaveLength(3);
      expect(command.examples).toContain('systemprompt cli:help');
      expect(command.examples).toContain('systemprompt cli:help --command database:migrate');
      expect(command.examples).toContain('systemprompt cli:help --all');
    });
  });

  describe('getCliService', () => {
    it('should return CLI service when module is properly loaded', async () => {
      await command.execute(mockContext);

      expect(getModuleLoader).toHaveBeenCalled();
      expect(mockModuleLoader.getModule).toHaveBeenCalledWith('cli');
      expect(mockCliModule.exports.service).toHaveBeenCalled();
    });

    it('should throw error when CLI module is null', async () => {
      mockModuleLoader.getModule.mockReturnValue(null);

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });

    it('should throw error when CLI module is undefined', async () => {
      mockModuleLoader.getModule.mockReturnValue(undefined);

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });

    it('should throw error when CLI module is not an object', async () => {
      mockModuleLoader.getModule.mockReturnValue('not an object');

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });

    it('should throw error when CLI module has no exports property', async () => {
      mockModuleLoader.getModule.mockReturnValue({});

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });

    it('should throw error when CLI module exports is null', async () => {
      mockModuleLoader.getModule.mockReturnValue({ exports: null });

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });

    it('should throw error when CLI module exports is undefined', async () => {
      mockModuleLoader.getModule.mockReturnValue({ exports: undefined });

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });

    it('should throw error when CLI service is null', async () => {
      mockCliModule.exports.service.mockReturnValue(null);

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });

    it('should throw error when CLI service is undefined', async () => {
      mockCliModule.exports.service.mockReturnValue(undefined);

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });
  });

  describe('execute', () => {
    it('should show general help when no args provided', async () => {
      await command.execute(mockContext);

      expect(getModuleLoader).toHaveBeenCalled();
      expect(mockModuleLoader.getModule).toHaveBeenCalledWith('cli');
      expect(HelpService.getInstance).toHaveBeenCalled();
      expect(mockHelpService.showGeneralHelp).toHaveBeenCalledWith(mockCliService);
    });

    it('should show help for specific command when command arg is provided', async () => {
      mockContext.args.command = 'auth:login';

      await command.execute(mockContext);

      expect(mockHelpService.showSpecificCommandHelp).toHaveBeenCalledWith('auth:login', mockCliService);
      expect(mockHelpService.showGeneralHelp).not.toHaveBeenCalled();
      expect(mockHelpService.showAllCommands).not.toHaveBeenCalled();
    });

    it('should show all commands when all flag is true', async () => {
      mockContext.args.all = true;

      await command.execute(mockContext);

      expect(mockHelpService.showAllCommands).toHaveBeenCalledWith(mockCliService);
      expect(mockHelpService.showGeneralHelp).not.toHaveBeenCalled();
      expect(mockHelpService.showSpecificCommandHelp).not.toHaveBeenCalled();
    });

    it('should handle command arg that is null', async () => {
      mockContext.args.command = null;

      await command.execute(mockContext);

      expect(mockHelpService.showGeneralHelp).toHaveBeenCalledWith(mockCliService);
      expect(mockHelpService.showSpecificCommandHelp).not.toHaveBeenCalled();
    });

    it('should handle command arg that is not a string', async () => {
      mockContext.args.command = 123;

      await command.execute(mockContext);

      expect(mockHelpService.showGeneralHelp).toHaveBeenCalledWith(mockCliService);
      expect(mockHelpService.showSpecificCommandHelp).not.toHaveBeenCalled();
    });

    it('should prioritize specific command over all flag when both are provided', async () => {
      mockContext.args.command = 'auth:login';
      mockContext.args.all = true;

      await command.execute(mockContext);

      expect(mockHelpService.showSpecificCommandHelp).toHaveBeenCalledWith('auth:login', mockCliService);
      expect(mockHelpService.showAllCommands).not.toHaveBeenCalled();
      expect(mockHelpService.showGeneralHelp).not.toHaveBeenCalled();
    });

    it('should show general help when all flag is false', async () => {
      mockContext.args.all = false;

      await command.execute(mockContext);

      expect(mockHelpService.showGeneralHelp).toHaveBeenCalledWith(mockCliService);
      expect(mockHelpService.showAllCommands).not.toHaveBeenCalled();
    });

    it('should throw CommandExecutionError when getCliService fails', async () => {
      const error = new Error('CLI module not loaded');
      mockModuleLoader.getModule.mockReturnValue(null);

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });

    it('should throw CommandExecutionError when HelpService method fails', async () => {
      const error = new Error('Help service failed');
      mockHelpService.showGeneralHelp.mockRejectedValue(error);

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });

    it('should wrap non-Error objects in CommandExecutionError', async () => {
      const errorString = 'String error';
      mockHelpService.showGeneralHelp.mockRejectedValue(errorString);

      await expect(command.execute(mockContext)).rejects.toThrow(CommandExecutionError);
      await expect(command.execute(mockContext)).rejects.toThrow('cli:help');
    });
  });
});