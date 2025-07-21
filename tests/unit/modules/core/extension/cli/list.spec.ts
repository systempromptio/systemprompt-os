/**
 * @fileoverview Unit tests for extension list CLI command
 * @module tests/unit/modules/core/extension/cli/list
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/extension/cli/list';
import { ExtensionModule } from '../../../../../../src/modules/core/extension';

// Mock ExtensionModule
vi.mock('../../../../../../src/modules/core/extension', () => ({
  ExtensionModule: vi.fn()
}));

describe('extension list CLI command', () => {
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
      getExtensions: vi.fn()
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
    it('displays message when no extensions found', async () => {
      mockExtensionModule.getExtensions.mockReturnValue([]);
      
      await command.execute(mockContext);
      
      expect(consoleOutput).toContain('No extensions found');
      expect(mockExtensionModule.initialize).toHaveBeenCalledWith({
        config: {
          modulesPath: './src/modules',
          extensionsPath: './extensions'
        }
      });
    });
    
    it('lists extensions in text format', async () => {
      const mockExtensions = [
        {
          name: 'test-module',
          type: 'module',
          version: '1.0.0',
          description: 'Test module extension'
        },
        {
          name: 'test-server',
          type: 'server',
          version: '2.0.0',
          description: 'Test server extension'
        }
      ];
      
      mockExtensionModule.getExtensions.mockReturnValue(mockExtensions);
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Installed Extensions');
      expect(output).toContain('Modules:');
      expect(output).toContain('test-module (v1.0.0)');
      expect(output).toContain('Test module extension');
      expect(output).toContain('Servers:');
      expect(output).toContain('test-server (v2.0.0)');
      expect(output).toContain('Total: 2 extension(s)');
    });
    
    it('lists extensions in JSON format', async () => {
      const mockExtensions = [
        { name: 'ext1', type: 'module', version: '1.0.0' }
      ];
      
      mockExtensionModule.getExtensions.mockReturnValue(mockExtensions);
      mockContext.args.format = 'json';
      
      await command.execute(mockContext);
      
      expect(consoleOutput).toContain(JSON.stringify(mockExtensions, null, 2));
    });
    
    it('lists extensions in table format', async () => {
      const mockExtensions = [
        {
          name: 'long-extension-name',
          type: 'module',
          version: '1.2.3',
          description: 'This is a very long description that should be truncated in the table view'
        }
      ];
      
      mockExtensionModule.getExtensions.mockReturnValue(mockExtensions);
      mockContext.args.format = 'table';
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Name'.padEnd(20) + 'Type'.padEnd(10) + 'Version'.padEnd(10) + 'Description');
      expect(output).toContain('-'.repeat(70));
      expect(output).toContain('long-extension-name');
      expect(output).toContain('1.2.3');
      expect(output).toContain('...'); // Truncated description
    });
    
    it('filters extensions by type', async () => {
      const allExtensions = [
        { name: 'mod1', type: 'module', version: '1.0.0' },
        { name: 'srv1', type: 'server', version: '1.0.0' }
      ];
      
      mockExtensionModule.getExtensions.mockReturnValue([allExtensions[0]]);
      mockContext.args.type = 'module';
      
      await command.execute(mockContext);
      
      expect(mockExtensionModule.getExtensions).toHaveBeenCalledWith('module');
    });
    
    it('shows all extensions when type is "all"', async () => {
      mockExtensionModule.getExtensions.mockReturnValue([]);
      mockContext.args.type = 'all';
      
      await command.execute(mockContext);
      
      expect(mockExtensionModule.getExtensions).toHaveBeenCalledWith(undefined);
    });
    
    it('handles modules only', async () => {
      const mockExtensions = [
        { name: 'mod1', type: 'module', version: '1.0.0' },
        { name: 'mod2', type: 'module', version: '2.0.0' }
      ];
      
      mockExtensionModule.getExtensions.mockReturnValue(mockExtensions);
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Modules:');
      expect(output).not.toContain('Servers:');
    });
    
    it('handles servers only', async () => {
      const mockExtensions = [
        { name: 'srv1', type: 'server', version: '1.0.0' },
        { name: 'srv2', type: 'server', version: '2.0.0' }
      ];
      
      mockExtensionModule.getExtensions.mockReturnValue(mockExtensions);
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Servers:');
      expect(output).not.toContain('Modules:');
    });
    
    it('handles errors during listing', async () => {
      mockExtensionModule.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(command.execute(mockContext)).rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error listing extensions: Error: Init failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});