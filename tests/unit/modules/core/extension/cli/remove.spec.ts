/**
 * @fileoverview Unit tests for remove extension CLI command
 * @module tests/unit/modules/core/extension/cli/remove
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/extension/cli/remove';
import { ExtensionModule } from '../../../../../../src/modules/core/extension';

// Mock ExtensionModule
vi.mock('../../../../../../src/modules/core/extension', () => ({
  ExtensionModule: vi.fn()
}));

describe('remove CLI command', () => {
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let originalProcessExit: any;
  let consoleOutput: string[] = [];
  let consoleErrorOutput: string[] = [];
  let mockExtensionModule: any;
  
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
    
    // Mock ExtensionModule
    mockExtensionModule = {
      initialize: vi.fn(),
      getExtension: vi.fn(),
      removeExtension: vi.fn()
    };
    vi.mocked(ExtensionModule).mockReturnValue(mockExtensionModule);
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });
  
  it('requires extension name', async () => {
    const context = {
      cwd: '/test',
      args: {}
    };
    
    await expect(command.execute(context))
      .rejects.toThrow('Process exited');
    
    const errorOutput = consoleErrorOutput.join('\n');
    expect(errorOutput).toContain('Error: Extension name is required');
    expect(errorOutput).toContain('Usage: systemprompt extension:remove --name <name>');
  });
  
  it('removes extension successfully', async () => {
    const context = {
      cwd: '/test',
      args: {
        name: 'test-extension'
      }
    };
    
    mockExtensionModule.getExtension.mockReturnValue({
      name: 'test-extension',
      type: 'module',
      path: '/extensions/modules/test-extension'
    });
    
    await command.execute(context);
    
    expect(ExtensionModule).toHaveBeenCalled();
    expect(mockExtensionModule.initialize).toHaveBeenCalledWith({ 
      config: {
        modulesPath: './src/modules',
        extensionsPath: './extensions'
      }
    });
    expect(mockExtensionModule.getExtension).toHaveBeenCalledWith('test-extension');
    expect(mockExtensionModule.removeExtension).toHaveBeenCalledWith('test-extension', undefined);
    
    const output = consoleOutput.join('\n');
    expect(output).toContain('Removing extension: test-extension (module)');
    expect(output).toContain("✓ Extension 'test-extension' removed successfully");
  });
  
  it('preserves configuration when requested', async () => {
    const context = {
      cwd: '/test',
      args: {
        name: 'test-extension',
        'preserve-config': true
      }
    };
    
    mockExtensionModule.getExtension.mockReturnValue({
      name: 'test-extension',
      type: 'module',
      path: '/extensions/modules/test-extension'
    });
    
    await command.execute(context);
    
    expect(mockExtensionModule.removeExtension).toHaveBeenCalledWith('test-extension', true);
    
    const output = consoleOutput.join('\n');
    expect(output).toContain("✓ Extension 'test-extension' removed successfully");
    expect(output).toContain('Configuration files have been preserved');
  });
  
  it('handles extension not found', async () => {
    const context = {
      cwd: '/test',
      args: {
        name: 'nonexistent-extension'
      }
    };
    
    mockExtensionModule.getExtension.mockReturnValue(null);
    
    await expect(command.execute(context))
      .rejects.toThrow('Process exited');
    
    const errorOutput = consoleErrorOutput.join('\n');
    expect(errorOutput).toContain('Extension not found: nonexistent-extension');
  });
  
  it('prevents removing core modules', async () => {
    const context = {
      cwd: '/test',
      args: {
        name: 'auth'
      }
    };
    
    mockExtensionModule.getExtension.mockReturnValue({
      name: 'auth',
      type: 'module',
      path: '/src/modules/core/auth'
    });
    
    await expect(command.execute(context))
      .rejects.toThrow('Process exited');
    
    const output = consoleOutput.join('\n');
    expect(output).toContain('Removing extension: auth (module)');
    
    const errorOutput = consoleErrorOutput.join('\n');
    expect(errorOutput).toContain('Error: Cannot remove core modules');
  });
  
  it('handles removal errors', async () => {
    const context = {
      cwd: '/test',
      args: {
        name: 'error-extension'
      }
    };
    
    mockExtensionModule.getExtension.mockReturnValue({
      name: 'error-extension',
      type: 'server',
      path: '/extensions/servers/error-extension'
    });
    mockExtensionModule.removeExtension.mockRejectedValue(new Error('Removal failed'));
    
    await expect(command.execute(context))
      .rejects.toThrow('Process exited');
    
    const errorOutput = consoleErrorOutput.join('\n');
    expect(errorOutput).toContain('Error removing extension: Removal failed');
  });
});