/**
 * @fileoverview Unit tests for providers CLI command
 * @module tests/unit/modules/core/auth/cli/providers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/auth/cli/providers.js';
import { getAuthModule } from '../../../../../../src/modules/core/auth/singleton.js';

// Mock the singleton
vi.mock('../../../../../../src/modules/core/auth/singleton', () => ({
  getAuthModule: vi.fn()
}));

describe('providers CLI command', () => {
  let mockContext: any;
  let mockAuthModule: any;
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
    
    // Mock auth module
    mockAuthModule = {
      getAllProviders: vi.fn(),
      reloadProviders: vi.fn()
    };
    
    vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);
    
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
  
  describe('list subcommand', () => {
    it('displays message when no providers configured', async () => {
      mockAuthModule.getAllProviders.mockReturnValue([]);
      
      await command.subcommands.list.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('No OAuth2/OIDC providers are currently configured.');
      expect(output).toContain('To enable providers, set the following environment variables:');
      expect(output).toContain('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for Google');
      expect(output).toContain('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET for GitHub');
      expect(output).toContain('Or add custom providers in src/modules/core/auth/providers/custom/');
    });
    
    it('lists configured providers', async () => {
      const mockProviders = [
        {
          id: 'google',
          name: 'Google',
          type: 'oidc'
        },
        {
          id: 'github',
          name: 'GitHub',
          type: 'oauth2'
        }
      ];
      
      mockAuthModule.getAllProviders.mockReturnValue(mockProviders);
      
      await command.subcommands.list.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Found 2 configured provider(s):');
      expect(output).toContain('google:');
      expect(output).toContain('Name: Google');
      expect(output).toContain('Type: oidc');
      expect(output).toContain('Status: Enabled');
      expect(output).toContain('github:');
      expect(output).toContain('Name: GitHub');
      expect(output).toContain('Type: oauth2');
    });
    
    it('handles errors when listing providers', async () => {
      mockAuthModule.getAllProviders.mockImplementation(() => {
        throw new Error('Failed to get providers');
      });
      
      await expect(command.subcommands.list.execute(mockContext))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error listing providers: Error: Failed to get providers');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
  
  describe('reload subcommand', () => {
    it('reloads providers successfully', async () => {
      const mockProviders = [
        { id: 'google', name: 'Google' },
        { id: 'github', name: 'GitHub' }
      ];
      
      mockAuthModule.reloadProviders.mockResolvedValue(undefined);
      mockAuthModule.getAllProviders.mockReturnValue(mockProviders);
      
      await command.subcommands.reload.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Reloading provider configurations...');
      expect(output).toContain('✓ Reloaded successfully. 2 provider(s) available.');
      expect(output).toContain('Active providers:');
      expect(output).toContain('- google (Google)');
      expect(output).toContain('- github (GitHub)');
      expect(mockAuthModule.reloadProviders).toHaveBeenCalled();
    });
    
    it('reloads with no providers', async () => {
      mockAuthModule.reloadProviders.mockResolvedValue(undefined);
      mockAuthModule.getAllProviders.mockReturnValue([]);
      
      await command.subcommands.reload.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Reloading provider configurations...');
      expect(output).toContain('✓ Reloaded successfully. 0 provider(s) available.');
      expect(output).not.toContain('Active providers:');
    });
    
    it('handles reload errors', async () => {
      mockAuthModule.reloadProviders.mockRejectedValue(new Error('Reload failed'));
      
      await expect(command.subcommands.reload.execute(mockContext))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error reloading providers: Error: Reload failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});