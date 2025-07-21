/**
 * @fileoverview Unit tests for CLI Main Entry Point
 * @module tests/unit/cli/src/index
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Command } from 'commander';

// Create mock program
const mockProgram = {
  name: vi.fn().mockReturnThis(),
  description: vi.fn().mockReturnThis(),
  version: vi.fn().mockReturnThis(),
  command: vi.fn(),
  option: vi.fn().mockReturnThis(),
  action: vi.fn().mockReturnThis(),
  parse: vi.fn().mockReturnThis(),
  outputHelp: vi.fn().mockReturnThis(),
  opts: vi.fn().mockReturnValue({}),
  args: []
};

// Mock modules before imports
vi.mock('commander', () => ({
  Command: vi.fn(() => mockProgram)
}));

const mockDiscoveryInstance = {
  discoverCommands: vi.fn().mockResolvedValue(new Map())
};

vi.mock('../../../../src/cli/src/discovery', () => ({
  CommandDiscovery: vi.fn(() => mockDiscoveryInstance)
}));

describe('CLI Main Entry Point', () => {
  let originalArgv: string[];
  let mockExit: any;
  let mockConsoleError: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Store original values
    originalArgv = process.argv;
    process.argv = ['node', 'cli'];
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation();
    
    // Reset mock program
    mockProgram.name.mockClear().mockReturnThis();
    mockProgram.description.mockClear().mockReturnThis();
    mockProgram.version.mockClear().mockReturnThis();
    mockProgram.command.mockClear().mockReturnThis();
    mockProgram.parse.mockClear().mockReturnThis();
    mockProgram.outputHelp.mockClear().mockReturnThis();
    
    // Reset discovery mock
    mockDiscoveryInstance.discoverCommands.mockClear().mockResolvedValue(new Map());
  });

  afterEach(() => {
    process.argv = originalArgv;
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Program Setup', () => {
    it('should create commander program with correct configuration', async () => {
      // Import the CLI to trigger setup
      await import('../../../../src/cli/src/index');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockProgram.name).toHaveBeenCalledWith('systemprompt');
      expect(mockProgram.description).toHaveBeenCalledWith(
        expect.stringContaining('operating system for autonomous agents')
      );
      expect(mockProgram.version).toHaveBeenCalledWith('0.1.0');
    });
  });

  describe('Command Discovery', () => {
    it('should discover and register commands on startup', async () => {
      await import('../../../../src/cli/src/index');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockDiscoveryInstance.discoverCommands).toHaveBeenCalled();
    });

    it('should handle discovery errors', async () => {
      mockDiscoveryInstance.discoverCommands.mockRejectedValue(new Error('Discovery failed'));
      
      await import('../../../../src/cli/src/index');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error discovering module commands:',
        expect.any(Error)
      );
    });
  });

  describe('Command Registration', () => {
    it('should register discovered commands', async () => {
      const mockCommands = new Map([
        ['test-cmd', {
          description: 'Test command',
          action: vi.fn()
        }]
      ]);
      
      mockDiscoveryInstance.discoverCommands.mockResolvedValue(mockCommands);
      
      const mockSubCommand = {
        description: vi.fn().mockReturnThis(),
        action: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis()
      };
      
      mockProgram.command.mockReturnValue(mockSubCommand);
      
      await import('../../../../src/cli/src/index');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockProgram.command).toHaveBeenCalledWith('test-cmd');
      expect(mockSubCommand.description).toHaveBeenCalledWith('Test command');
    });

    it('should register command options', async () => {
      const mockCommands = new Map([
        ['cmd', {
          description: 'Command with options',
          options: [
            {
              name: 'verbose',
              alias: 'v',
              type: 'boolean',
              description: 'Verbose output'
            },
            {
              name: 'output',
              alias: 'o',
              type: 'string',
              description: 'Output file',
              required: true
            }
          ],
          action: vi.fn()
        }]
      ]);
      
      mockDiscoveryInstance.discoverCommands.mockResolvedValue(mockCommands);
      
      const mockSubCommand = {
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn().mockReturnThis()
      };
      
      mockProgram.command.mockReturnValue(mockSubCommand);
      
      await import('../../../../src/cli/src/index');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockSubCommand.option).toHaveBeenCalledWith(
        '-v, --verbose',
        'Verbose output',
        undefined
      );
      expect(mockSubCommand.option).toHaveBeenCalledWith(
        '-o, --output <value>',
        'Output file',
        undefined
      );
    });
  });

  describe('Program Execution', () => {
    it('should parse command line arguments', async () => {
      process.argv = ['node', 'cli', '--help'];
      
      await import('../../../../src/cli/src/index');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockProgram.parse).toHaveBeenCalledWith(process.argv);
    });
    
    it('should show help when no arguments provided', async () => {
      process.argv = ['node', 'cli'];
      
      await import('../../../../src/cli/src/index');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockProgram.outputHelp).toHaveBeenCalled();
    });
  });
});