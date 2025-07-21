/**
 * @fileoverview Unit tests for install extension CLI command
 * @module tests/unit/modules/core/extension/cli/install
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/extension/cli/install';
import { ExtensionModule } from '../../../../../../src/modules/core/extension';

// Mock ExtensionModule
vi.mock('../../../../../../src/modules/core/extension', () => ({
  ExtensionModule: vi.fn()
}));

describe('install CLI command', () => {
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
      installExtension: vi.fn()
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
    expect(errorOutput).toContain('Usage: systemprompt extension:install --name <name> [--version <version>]');
  });
  
  it('installs extension successfully', async () => {
    const context = {
      cwd: '/test',
      args: {
        name: 'test-extension',
        version: '1.0.0'
      }
    };
    
    mockExtensionModule.getExtension.mockReturnValue(null);
    
    await command.execute(context);
    
    expect(ExtensionModule).toHaveBeenCalled();
    expect(mockExtensionModule.initialize).toHaveBeenCalledWith({ config: {} });
    expect(mockExtensionModule.getExtension).toHaveBeenCalledWith('test-extension');
    expect(mockExtensionModule.installExtension).toHaveBeenCalledWith('test-extension', {
      version: '1.0.0',
      force: undefined
    });
    
    const output = consoleOutput.join('\n');
    expect(output).toContain('Installing extension: test-extension@1.0.0');
    expect(output).toContain("✓ Extension 'test-extension' installed successfully");
  });
  
  it('installs extension without version', async () => {
    const context = {
      cwd: '/test',
      args: {
        name: 'test-extension'
      }
    };
    
    mockExtensionModule.getExtension.mockReturnValue(null);
    
    await command.execute(context);
    
    expect(mockExtensionModule.installExtension).toHaveBeenCalledWith('test-extension', {
      version: undefined,
      force: undefined
    });
    
    const output = consoleOutput.join('\n');
    expect(output).toContain('Installing extension: test-extension');
  });
  
  it('prevents installing already installed extension', async () => {
    const context = {
      cwd: '/test',
      args: {
        name: 'existing-extension'
      }
    };
    
    mockExtensionModule.getExtension.mockReturnValue({
      name: 'existing-extension',
      version: '2.0.0'
    });
    
    await expect(command.execute(context))
      .rejects.toThrow('Process exited');
    
    const errorOutput = consoleErrorOutput.join('\n');
    expect(errorOutput).toContain("Extension 'existing-extension' is already installed (v2.0.0)");
    expect(errorOutput).toContain('Use --force to reinstall');
  });
  
  it('allows force reinstall', async () => {
    const context = {
      cwd: '/test',
      args: {
        name: 'existing-extension',
        force: true
      }
    };
    
    mockExtensionModule.getExtension.mockReturnValue({
      name: 'existing-extension',
      version: '2.0.0'
    });
    
    await command.execute(context);
    
    expect(mockExtensionModule.installExtension).toHaveBeenCalledWith('existing-extension', {
      version: undefined,
      force: true
    });
    
    const output = consoleOutput.join('\n');
    expect(output).toContain("✓ Extension 'existing-extension' installed successfully");
  });
  
  it('handles installation errors', async () => {
    const context = {
      cwd: '/test',
      args: {
        name: 'error-extension'
      }
    };
    
    mockExtensionModule.getExtension.mockReturnValue(null);
    mockExtensionModule.installExtension.mockRejectedValue(new Error('Installation failed'));
    
    await expect(command.execute(context))
      .rejects.toThrow('Process exited');
    
    const errorOutput = consoleErrorOutput.join('\n');
    expect(errorOutput).toContain('Error installing extension: Installation failed');
    expect(errorOutput).toContain('Note: Extension installation is not yet fully implemented.');
    expect(errorOutput).toContain('To manually install an extension:');
    expect(errorOutput).toContain('1. Place module extensions in ./extensions/modules/<name>');
    expect(errorOutput).toContain('2. Place server extensions in ./extensions/servers/<name>');
    expect(errorOutput).toContain('3. Ensure proper module.yaml or server.yaml configuration');
  });
});