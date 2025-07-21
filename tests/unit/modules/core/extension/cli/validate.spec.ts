/**
 * @fileoverview Unit tests for extension validate CLI command
 * @module tests/unit/modules/core/extension/cli/validate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/extension/cli/validate';
import { ExtensionModule } from '../../../../../../src/modules/core/extension';
import { resolve } from 'path';

// Mock ExtensionModule
vi.mock('../../../../../../src/modules/core/extension', () => ({
  ExtensionModule: vi.fn()
}));

// Mock path
vi.mock('path', () => ({
  resolve: vi.fn((cwd, path) => `${cwd}/${path}`)
}));

describe('extension validate CLI command', () => {
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
      validateExtension: vi.fn()
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
    it('shows error when path is not provided', async () => {
      await expect(command.execute(mockContext))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Error: Path is required');
      expect(consoleErrorOutput).toContain('Usage: systemprompt extension:validate --path <path>');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('validates extension successfully', async () => {
      mockContext.args.path = './extensions/test-ext';
      mockExtensionModule.validateExtension.mockReturnValue({
        valid: true,
        errors: []
      });
      
      await command.execute(mockContext);
      
      expect(mockExtensionModule.initialize).toHaveBeenCalledWith({ config: {} });
      expect(resolve).toHaveBeenCalledWith('/test/project', './extensions/test-ext');
      expect(mockExtensionModule.validateExtension).toHaveBeenCalledWith(
        '/test/project/./extensions/test-ext',
        undefined // strict is not set
      );
      expect(consoleOutput).toContain('Validating extension at: /test/project/./extensions/test-ext');
      expect(consoleOutput).toContain('✓ Extension structure is valid');
    });
    
    it('validates extension with strict mode', async () => {
      mockContext.args.path = 'modules/my-module';
      mockContext.args.strict = true;
      mockExtensionModule.validateExtension.mockReturnValue({
        valid: true,
        errors: []
      });
      
      await command.execute(mockContext);
      
      expect(mockExtensionModule.validateExtension).toHaveBeenCalledWith(
        '/test/project/modules/my-module',
        true
      );
    });
    
    it('shows validation errors', async () => {
      mockContext.args.path = './bad-extension';
      mockExtensionModule.validateExtension.mockReturnValue({
        valid: false,
        errors: [
          'Missing module.yaml or server.yaml',
          'No index.ts file found',
          'Invalid version format in config'
        ]
      });
      
      await expect(command.execute(mockContext))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('✗ Extension validation failed:');
      expect(errorOutput).toContain('1. Missing module.yaml or server.yaml');
      expect(errorOutput).toContain('2. No index.ts file found');
      expect(errorOutput).toContain('3. Invalid version format in config');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('handles absolute paths', async () => {
      mockContext.args.path = '/absolute/path/to/extension';
      mockExtensionModule.validateExtension.mockReturnValue({
        valid: true,
        errors: []
      });
      
      await command.execute(mockContext);
      
      expect(resolve).toHaveBeenCalledWith('/test/project', '/absolute/path/to/extension');
      expect(consoleOutput).toContain('Validating extension at: /test/project//absolute/path/to/extension');
    });
    
    it('handles validation errors with single error', async () => {
      mockContext.args.path = './extension';
      mockExtensionModule.validateExtension.mockReturnValue({
        valid: false,
        errors: ['Extension path does not exist']
      });
      
      await expect(command.execute(mockContext))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('1. Extension path does not exist');
    });
    
    it('handles exceptions during validation', async () => {
      mockContext.args.path = './extension';
      mockExtensionModule.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(command.execute(mockContext))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error validating extension: Error: Init failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('passes through validateExtension errors', async () => {
      mockContext.args.path = './extension';
      mockExtensionModule.validateExtension.mockImplementation(() => {
        throw new Error('Validation method failed');
      });
      
      await expect(command.execute(mockContext))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error validating extension: Error: Validation method failed');
    });
  });
});