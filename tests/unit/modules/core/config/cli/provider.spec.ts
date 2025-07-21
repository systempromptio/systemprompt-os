/**
 * @fileoverview Unit tests for provider CLI command
 * @module tests/unit/modules/core/config/cli/provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/config/cli/provider';
import { 
  providers, 
  getEnabledProviders, 
  providerRegistry, 
  getProvider, 
  enableProvider, 
  disableProvider, 
  setDefaultProvider 
} from '../../../../../../src/modules/core/config/providers';

// Mock dependencies
vi.mock('../../../../../../src/modules/core/config/providers', () => ({
  providers: {},
  getEnabledProviders: vi.fn(),
  providerRegistry: {
    defaultProvider: 'google-liveapi',
    enabledProviders: ['google-liveapi']
  },
  getProvider: vi.fn(),
  enableProvider: vi.fn(),
  disableProvider: vi.fn(),
  setDefaultProvider: vi.fn()
}));

describe('provider CLI command', () => {
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let originalProcessExit: any;
  let consoleOutput: string[] = [];
  let consoleErrorOutput: string[] = [];
  
  const mockGoogleProvider = {
    name: 'google-liveapi',
    displayName: 'Google Live API',
    version: '1.0.0',
    description: 'Google AI provider',
    enabled: true,
    config: {
      client: {
        apiKey: 'test-key-1234'
      },
      defaultModel: 'default',
      models: {
        default: {
          model: 'gemini-1.5-flash',
          displayName: 'Gemini 1.5 Flash',
          description: 'Fast model',
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192
          },
          systemInstruction: 'You are a helpful assistant that provides concise answers.',
          tools: [{ codeExecution: {} }]
        }
      }
    }
  };
  
  const mockOtherProvider = {
    name: 'other-provider',
    displayName: 'Other Provider',
    version: '2.0.0',
    description: 'Alternative AI provider',
    enabled: false,
    config: {
      apiKey: 'other-key'
    }
  };
  
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
    
    // Reset provider mocks
    Object.assign(providers, {
      'google-liveapi': mockGoogleProvider,
      'other-provider': mockOtherProvider
    });
    
    providerRegistry.defaultProvider = 'google-liveapi';
    providerRegistry.enabledProviders = ['google-liveapi'];
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });
  
  describe('list subcommand', () => {
    it('lists all providers', async () => {
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('AI Providers:');
      expect(output).toContain('✓ google-liveapi (default) - Google Live API v1.0.0');
      expect(output).toContain('Google AI provider');
      expect(output).toContain('✗ other-provider - Other Provider v2.0.0');
      expect(output).toContain('Alternative AI provider');
      expect(output).toContain('Provider Status:');
      expect(output).toContain('Total: 2');
      expect(output).toContain('Enabled: 1');
      expect(output).toContain('Default: google-liveapi');
    });
    
    it('lists only enabled providers', async () => {
      vi.mocked(getEnabledProviders).mockReturnValue([mockGoogleProvider]);
      
      await command.execute('list', { enabled: true });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('✓ google-liveapi (default)');
      expect(output).not.toContain('other-provider');
      expect(output).not.toContain('Provider Status:');
    });
    
    it('handles no providers', async () => {
      vi.mocked(getEnabledProviders).mockReturnValue([]);
      
      await command.execute('list', { enabled: true });
      
      expect(consoleOutput).toContain('No providers found.');
    });
  });
  
  describe('show subcommand', () => {
    it('shows provider details', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await command.execute('show', { name: 'google-liveapi' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Provider Details:');
      expect(output).toContain('Name: google-liveapi');
      expect(output).toContain('Display Name: Google Live API');
      expect(output).toContain('Version: 1.0.0');
      expect(output).toContain('Status: Enabled');
      expect(output).toContain('Description: Google AI provider');
      expect(output).toContain('Configuration:');
      expect(output).toContain('API Key: ***1234');
      expect(output).toContain('Default Model: default');
    });
    
    it('shows provider with models', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await command.execute('show', { name: 'google-liveapi', models: true });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Available Models:');
      expect(output).toContain('default:');
      expect(output).toContain('Model: gemini-1.5-flash');
      expect(output).toContain('Display Name: Gemini 1.5 Flash');
      expect(output).toContain('Temperature: 0.7');
      expect(output).toContain('Max Output Tokens: 8192');
      expect(output).toContain('System Instruction: You are a helpful assistant that provides concise answers....');
      expect(output).toContain('Tools: Code Execution');
    });
    
    it('shows non-google provider config as JSON', async () => {
      vi.mocked(getProvider).mockReturnValue(mockOtherProvider);
      
      await command.execute('show', { name: 'other-provider' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Configuration:');
      expect(output).toContain(JSON.stringify(mockOtherProvider.config, null, 2));
    });
    
    it('handles provider not found', async () => {
      vi.mocked(getProvider).mockReturnValue(null);
      
      await expect(command.execute('show', { name: 'unknown' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain("Error: Provider 'unknown' not found.");
    });
    
    it('masks API key properly', async () => {
      const providerNoKey = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          client: { apiKey: '' }
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerNoKey);
      
      await command.execute('show', { name: 'google-liveapi' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('API Key: Not set');
    });
  });
  
  describe('enable subcommand', () => {
    it('enables disabled provider', async () => {
      vi.mocked(getProvider).mockReturnValue({ ...mockOtherProvider, enabled: false });
      vi.mocked(enableProvider).mockReturnValue(true);
      
      await command.execute('enable', { name: 'other-provider' });
      
      expect(enableProvider).toHaveBeenCalledWith('other-provider');
      const output = consoleOutput.join('\n');
      expect(output).toContain("✓ Provider 'other-provider' has been enabled.");
      expect(output).toContain('Display Name: Other Provider');
      expect(output).toContain('Version: 2.0.0');
    });
    
    it('handles already enabled provider', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await command.execute('enable', { name: 'google-liveapi' });
      
      expect(enableProvider).not.toHaveBeenCalled();
      const output = consoleOutput.join('\n');
      expect(output).toContain("Provider 'google-liveapi' is already enabled.");
    });
    
    it('handles provider not found', async () => {
      vi.mocked(getProvider).mockReturnValue(null);
      
      await expect(command.execute('enable', { name: 'unknown' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain("Error: Provider 'unknown' not found.");
      expect(errorOutput).toContain('Run "provider:list" to see available providers.');
    });
    
    it('handles enable failure', async () => {
      vi.mocked(getProvider).mockReturnValue({ ...mockOtherProvider, enabled: false });
      vi.mocked(enableProvider).mockReturnValue(false);
      
      await expect(command.execute('enable', { name: 'other-provider' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain("Failed to enable provider 'other-provider'.");
    });
  });
  
  describe('disable subcommand', () => {
    it('disables enabled provider', async () => {
      providerRegistry.enabledProviders = ['google-liveapi', 'other-provider'];
      providerRegistry.defaultProvider = 'other-provider';
      vi.mocked(getProvider).mockReturnValue({ ...mockGoogleProvider, enabled: true });
      vi.mocked(disableProvider).mockReturnValue(true);
      
      await command.execute('disable', { name: 'google-liveapi' });
      
      expect(disableProvider).toHaveBeenCalledWith('google-liveapi');
      const output = consoleOutput.join('\n');
      expect(output).toContain("✓ Provider 'google-liveapi' has been disabled.");
      expect(output).toContain('Remaining enabled providers: google-liveapi, other-provider');
    });
    
    it('prevents disabling default provider', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await expect(command.execute('disable', { name: 'google-liveapi' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain("Error: Cannot disable the default provider 'google-liveapi'.");
      expect(errorOutput).toContain('Please set a different default provider first');
    });
    
    it('prevents disabling last provider', async () => {
      providerRegistry.enabledProviders = ['other-provider'];
      providerRegistry.defaultProvider = 'other-provider';
      vi.mocked(getProvider).mockReturnValue({ ...mockOtherProvider, enabled: true });
      
      await expect(command.execute('disable', { name: 'other-provider' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      // Since it's both the default and the last provider, it will show the default provider error first
      expect(errorOutput).toContain("Error: Cannot disable the default provider 'other-provider'.");
      expect(errorOutput).toContain('Please set a different default provider first');
    });
    
    it('handles already disabled provider', async () => {
      vi.mocked(getProvider).mockReturnValue({ ...mockOtherProvider, enabled: false });
      
      await command.execute('disable', { name: 'other-provider' });
      
      expect(disableProvider).not.toHaveBeenCalled();
      const output = consoleOutput.join('\n');
      expect(output).toContain("Provider 'other-provider' is already disabled.");
    });
  });
  
  describe('set-default subcommand', () => {
    it('sets new default provider', async () => {
      providerRegistry.enabledProviders = ['google-liveapi', 'other-provider'];
      vi.mocked(getProvider).mockReturnValue({ ...mockOtherProvider, enabled: true });
      vi.mocked(setDefaultProvider).mockReturnValue(true);
      
      await command.execute('set-default', { name: 'other-provider' });
      
      expect(setDefaultProvider).toHaveBeenCalledWith('other-provider');
      const output = consoleOutput.join('\n');
      expect(output).toContain("✓ Default provider changed from 'google-liveapi' to 'other-provider'.");
      expect(output).toContain('Display Name: Other Provider');
    });
    
    it('handles already default provider', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await command.execute('set-default', { name: 'google-liveapi' });
      
      expect(setDefaultProvider).not.toHaveBeenCalled();
      const output = consoleOutput.join('\n');
      expect(output).toContain("Provider 'google-liveapi' is already the default.");
    });
    
    it('prevents setting disabled provider as default', async () => {
      vi.mocked(getProvider).mockReturnValue({ ...mockOtherProvider, enabled: false });
      
      await expect(command.execute('set-default', { name: 'other-provider' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain("Error: Provider 'other-provider' is not enabled.");
      expect(errorOutput).toContain('Only enabled providers can be set as default.');
    });
  });
  
  describe('execute', () => {
    it('handles unknown subcommand', async () => {
      await expect(command.execute('unknown', {}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Unknown provider subcommand: unknown');
      expect(errorOutput).toContain('Available subcommands: list, show, enable, disable, set-default');
    });
  });
});