/**
 * @fileoverview Unit tests for generatekey CLI command
 * @module tests/unit/modules/core/auth/cli/generatekey
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/auth/cli/generatekey.js';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('../../../../../../src/modules/core/auth/utils/generate-key.js', () => ({
  generateJWTKeyPair: vi.fn()
}));

// Import mocked module
import { generateJWTKeyPair } from '../../../../../../src/modules/core/auth/utils/generate-key.js';

describe('generatekey CLI command', () => {
  let mockContext: any;
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
    
    // Mock process.exit to throw an error to stop execution
    originalProcessExit = process.exit;
    process.exit = vi.fn(() => {
      throw new Error('Process exited');
    }) as any;
    
    // Mock path.resolve
    vi.mocked(resolve).mockImplementation((...args) => args.join('/'));
    
    // Default mock context
    mockContext = {
      cwd: '/test/project',
      args: {
        type: 'jwt',
        algorithm: 'RS256',
        format: 'pem'
      }
    };
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });
  
  describe('execute', () => {
    it('generates JWT keys with default output directory', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdirSync).mockImplementation(() => undefined);
      vi.mocked(generateJWTKeyPair).mockResolvedValue(undefined);
      
      await command.execute(mockContext);
      
      expect(mkdirSync).toHaveBeenCalledWith(
        '/test/project/state/auth/keys',
        { recursive: true }
      );
      
      expect(generateJWTKeyPair).toHaveBeenCalledWith({
        type: 'jwt',
        algorithm: 'RS256',
        outputDir: '/test/project/state/auth/keys',
        format: 'pem'
      });
      
      expect(consoleOutput).toContain('Generating RS256 keys in pem format...');
      expect(consoleOutput).toContain('✓ Keys generated successfully in: /test/project/state/auth/keys');
      expect(consoleOutput).toContain('  - private.key');
      expect(consoleOutput).toContain('  - public.key');
    });
    
    it('generates JWT keys with custom output directory', async () => {
      mockContext.args.output = '/custom/keys';
      vi.mocked(generateJWTKeyPair).mockResolvedValue(undefined);
      
      await command.execute(mockContext);
      
      expect(generateJWTKeyPair).toHaveBeenCalledWith({
        type: 'jwt',
        algorithm: 'RS256',
        outputDir: '/custom/keys',
        format: 'pem'
      });
      
      expect(consoleOutput).toContain('✓ Keys generated successfully in: /custom/keys');
    });
    
    it('generates keys in JWK format', async () => {
      mockContext.args.format = 'jwk';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(generateJWTKeyPair).mockResolvedValue(undefined);
      
      await command.execute(mockContext);
      
      expect(consoleOutput).toContain('Generating RS256 keys in jwk format...');
      expect(consoleOutput).toContain('  - jwks.json');
      expect(consoleOutput).not.toContain('  - private.key');
    });
    
    it('rejects non-JWT key types', async () => {
      mockContext.args.type = 'rsa';
      
      await expect(command.execute(mockContext)).rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Error: Only JWT key generation is currently supported');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(vi.mocked(generateJWTKeyPair)).not.toHaveBeenCalled();
    });
    
    it('handles key generation errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(generateJWTKeyPair).mockRejectedValue(new Error('Key generation failed'));
      
      await expect(command.execute(mockContext)).rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Error generating keys: Error: Key generation failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('creates output directory if it does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdirSync).mockImplementation(() => undefined);
      vi.mocked(generateJWTKeyPair).mockResolvedValue(undefined);
      
      await command.execute(mockContext);
      
      expect(existsSync).toHaveBeenCalledWith('/test/project/state/auth/keys');
      expect(mkdirSync).toHaveBeenCalledWith(
        '/test/project/state/auth/keys',
        { recursive: true }
      );
    });
    
    it('does not create directory if custom output is provided', async () => {
      mockContext.args.output = '/existing/path';
      vi.mocked(generateJWTKeyPair).mockResolvedValue(undefined);
      
      await command.execute(mockContext);
      
      expect(mkdirSync).not.toHaveBeenCalled();
    });
  });
});