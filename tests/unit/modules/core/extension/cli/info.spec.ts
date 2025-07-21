/**
 * @fileoverview Unit tests for extension info CLI command
 * @module tests/unit/modules/core/extension/cli/info
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/extension/cli/info';
import { ExtensionModule } from '../../../../../../src/modules/core/extension';
import { existsSync, readdirSync } from 'fs';

// Mock ExtensionModule
vi.mock('../../../../../../src/modules/core/extension', () => ({
  ExtensionModule: vi.fn()
}));

// Mock fs
vi.mock('fs');

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/'))
}));

describe('extension info CLI command', () => {
  let mockContext: any;
  let mockExtensionModule: any;
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let originalProcessExit: any;
  let consoleOutput: string[] = [];
  let consoleErrorOutput: string[] = [];
  
  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutput = [];
    consoleErrorOutput = [];
    
    // Mock console
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = vi.fn((...args) => consoleOutput.push(args.join(' ')));
    console.error = vi.fn((...args) => consoleErrorOutput.push(args.join(' ')));
    
    // Mock process.exit
    originalProcessExit = process.exit;
    process.exit = vi.fn(() => {
      throw new Error('Process exited');
    }) as any;
    
    // Mock ExtensionModule instance
    mockExtensionModule = {
      initialize: vi.fn(),
      getExtension: vi.fn()
    };
    
    vi.mocked(ExtensionModule).mockImplementation(() => mockExtensionModule);
    
    // Default mock context
    mockContext = {
      cwd: '/test/project',
      args: {}
    };
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });
  
  describe('execute', () => {
    it('shows error when name is not provided', async () => {
      await expect(command.execute(mockContext))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Error: Extension name is required');
      expect(consoleErrorOutput).toContain('Usage: systemprompt extension:info --name <name>');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('shows error when extension not found', async () => {
      mockContext.args.name = 'unknown-ext';
      mockExtensionModule.getExtension.mockReturnValue(null);
      
      await expect(command.execute(mockContext))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Extension not found: unknown-ext');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('displays basic extension info', async () => {
      const mockExtension = {
        name: 'test-extension',
        type: 'module',
        version: '1.0.0',
        description: 'Test extension',
        author: 'Test Author',
        dependencies: ['dep1', 'dep2'],
        path: '/extensions/test-extension'
      };
      
      mockContext.args.name = 'test-extension';
      mockExtensionModule.getExtension.mockReturnValue(mockExtension);
      vi.mocked(existsSync).mockReturnValue(false);
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Extension: test-extension');
      expect(output).toContain('========================='); // "Extension: test-extension".length = 25
      expect(output).toContain('Type: module');
      expect(output).toContain('Version: 1.0.0');
      expect(output).toContain('Description: Test extension');
      expect(output).toContain('Author: Test Author');
      expect(output).toContain('Dependencies: dep1, dep2');
      expect(output).toContain('Path: /extensions/test-extension');
    });
    
    it('displays module-specific info with CLI commands', async () => {
      const mockExtension = {
        name: 'test-module',
        type: 'module',
        version: '1.0.0',
        path: '/modules/test-module'
      };
      
      mockContext.args.name = 'test-module';
      mockExtensionModule.getExtension.mockReturnValue(mockExtension);
      
      // Mock fs checks
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path === '/modules/test-module/cli') return true;
        if (path === '/modules/test-module/index.ts') return true;
        if (path === '/modules/test-module/tests') return true;
        if (path === '/modules/test-module/README.md') return true;
        return false;
      });
      
      vi.mocked(readdirSync).mockReturnValue(['command1.ts', 'command2.js', 'README.md'] as any);
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('CLI Commands:');
      expect(output).toContain('test-module:command1');
      expect(output).toContain('test-module:command2');
      expect(output).toContain('Documentation: README.md available');
      expect(output).toContain('Structure:');
      expect(output).toContain('Entry point: ✓');
      expect(output).toContain('Tests: ✓');
      expect(output).toContain('CLI commands: ✓');
    });
    
    it('shows structure with missing components', async () => {
      const mockExtension = {
        name: 'minimal-module',
        type: 'module',
        version: '1.0.0',
        path: '/modules/minimal'
      };
      
      mockContext.args.name = 'minimal-module';
      mockExtensionModule.getExtension.mockReturnValue(mockExtension);
      vi.mocked(existsSync).mockReturnValue(false);
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Structure:');
      expect(output).toContain('Entry point: ✗');
      expect(output).toContain('Tests: ✗');
      expect(output).toContain('CLI commands: ✗');
    });
    
    it('handles server type extensions', async () => {
      const mockExtension = {
        name: 'test-server',
        type: 'server',
        version: '2.0.0',
        path: '/servers/test-server'
      };
      
      mockContext.args.name = 'test-server';
      mockExtensionModule.getExtension.mockReturnValue(mockExtension);
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Type: server');
      expect(output).not.toContain('Structure:'); // Module-specific info not shown
    });
    
    it('handles minimal extension info', async () => {
      const mockExtension = {
        name: 'minimal',
        type: 'module',
        version: '0.1.0',
        path: '/minimal'
        // No optional fields
      };
      
      mockContext.args.name = 'minimal';
      mockExtensionModule.getExtension.mockReturnValue(mockExtension);
      vi.mocked(existsSync).mockReturnValue(false);
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Extension: minimal');
      expect(output).not.toContain('Description:');
      expect(output).not.toContain('Author:');
      expect(output).not.toContain('Dependencies:');
    });
    
    it('handles errors during execution', async () => {
      mockContext.args.name = 'error-ext';
      mockExtensionModule.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(command.execute(mockContext))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error getting extension info: Error: Init failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('checks for .js index file when .ts not found', async () => {
      const mockExtension = {
        name: 'js-module',
        type: 'module',
        version: '1.0.0',
        path: '/modules/js-module'
      };
      
      mockContext.args.name = 'js-module';
      mockExtensionModule.getExtension.mockReturnValue(mockExtension);
      
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path === '/modules/js-module/index.js') return true;
        return false;
      });
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Entry point: ✓');
    });
  });
});