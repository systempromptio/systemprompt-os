/**
 * @fileoverview Unit tests for provider CLI command
 * @module tests/unit/modules/core/config/cli/provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/config/cli/provider.js';
import { 
  providers, 
  getEnabledProviders, 
  providerRegistry, 
  getProvider, 
  enableProvider, 
  disableProvider, 
  setDefaultProvider 
} from '../../../../../../src/modules/core/config/providers.js';

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
      vi.mocked(getEnabledProviders).mockReturnValue([mockGoogleProvider]);
      
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
      expect(output).toContain('System Instruction: You are a helpful assistant that provides concise ....');
      expect(output).toContain('Tools: Unknown Tool');
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
      vi.mocked(getEnabledProviders).mockReturnValue([
        { name: 'google-liveapi' },
        { name: 'other-provider' }
      ]);
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
      vi.mocked(getEnabledProviders).mockReturnValue([mockGoogleProvider]);
      
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

  describe('edge cases and helper functions', () => {
    describe('maskApiKey edge cases', () => {
      it('handles API key with 4 or fewer characters', async () => {
        const providerShortKey = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            client: { apiKey: 'abc' }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerShortKey);
        
        await command.execute('show', { name: 'google-liveapi' });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('API Key: ***');
      });

      it('handles API key with exactly 4 characters', async () => {
        const providerShortKey = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            client: { apiKey: 'abcd' }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerShortKey);
        
        await command.execute('show', { name: 'google-liveapi' });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('API Key: ***');
      });
    });

    describe('formatTools edge cases', () => {
      it('handles unknown tool types', async () => {
        const providerWithUnknownTool = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                ...mockGoogleProvider.config.models.default,
                tools: [{ unknownTool: {} }]
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerWithUnknownTool);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('Tools: Unknown Tool');
      });

      it('handles codeExecution tool with explicit true value', async () => {
        const providerWithCodeExecution = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                ...mockGoogleProvider.config.models.default,
                tools: [{ codeExecution: true }]
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerWithCodeExecution);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('Tools: Code Execution');
      });
    });

    describe('formatModelDetails edge cases', () => {
      it('handles model without description', async () => {
        const providerNoDescription = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                model: 'test-model',
                displayName: 'Test Model'
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerNoDescription);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('Model: test-model');
        expect(output).toContain('Display Name: Test Model');
        // The provider itself has a description, so we need to check for the model description specifically
        const modelSection = output.split('Available Models:')[1];
        expect(modelSection).not.toContain('Description:');
      });

      it('handles model with empty description', async () => {
        const providerEmptyDescription = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                model: 'test-model',
                displayName: 'Test Model',
                description: ''
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerEmptyDescription);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        // The provider itself has a description, so we need to check for the model description specifically
        const modelSection = output.split('Available Models:')[1];
        expect(modelSection).not.toContain('Description:');
      });

      it('handles model without generationConfig', async () => {
        const providerNoGenConfig = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                model: 'test-model',
                displayName: 'Test Model',
                description: 'Test description'
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerNoGenConfig);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).not.toContain('Temperature:');
        expect(output).not.toContain('Max Output Tokens:');
      });

      it('handles model without systemInstruction', async () => {
        const providerNoSystemInstruction = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                model: 'test-model',
                displayName: 'Test Model',
                description: 'Test description'
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerNoSystemInstruction);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).not.toContain('System Instruction:');
      });

      it('handles model with empty systemInstruction', async () => {
        const providerEmptySystemInstruction = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                model: 'test-model',
                displayName: 'Test Model',
                description: 'Test description',
                systemInstruction: ''
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerEmptySystemInstruction);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).not.toContain('System Instruction:');
      });

      it('handles model with short systemInstruction (under 50 chars)', async () => {
        const providerShortSystemInstruction = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                model: 'test-model',
                displayName: 'Test Model',
                description: 'Test description',
                systemInstruction: 'Short instruction'
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerShortSystemInstruction);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('System Instruction: Short instruction');
        expect(output).not.toContain('....');
      });

      it('handles model without tools', async () => {
        const providerNoTools = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                model: 'test-model',
                displayName: 'Test Model',
                description: 'Test description'
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerNoTools);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).not.toContain('Tools:');
      });

      it('handles model with empty tools array', async () => {
        const providerEmptyTools = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                model: 'test-model',
                displayName: 'Test Model',
                description: 'Test description',
                tools: []
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerEmptyTools);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).not.toContain('Tools:');
      });
    });

    describe('formatGenerationConfig edge cases', () => {
      it('handles generationConfig with only temperature', async () => {
        const providerOnlyTemperature = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                model: 'test-model',
                displayName: 'Test Model',
                generationConfig: {
                  temperature: 0.5
                }
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerOnlyTemperature);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('Temperature: 0.5');
        expect(output).not.toContain('Max Output Tokens:');
      });

      it('handles generationConfig with only maxOutputTokens', async () => {
        const providerOnlyTokens = {
          ...mockGoogleProvider,
          config: {
            ...mockGoogleProvider.config,
            models: {
              default: {
                model: 'test-model',
                displayName: 'Test Model',
                generationConfig: {
                  maxOutputTokens: 4096
                }
              }
            }
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerOnlyTokens);
        
        await command.execute('show', { name: 'google-liveapi', models: true });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('Max Output Tokens: 4096');
        expect(output).not.toContain('Temperature:');
      });
    });

    describe('list providers edge cases', () => {
      it('handles empty providers object', async () => {
        Object.keys(providers).forEach(key => delete providers[key]);
        vi.mocked(getEnabledProviders).mockReturnValue([]);
        
        await command.execute('list', {});
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('AI Providers:');
        expect(output).toContain('Total: 0');
        expect(output).toContain('Enabled: 0');
      });
    });

    describe('canDisableProvider scenarios', () => {
      it('prevents disabling the last enabled provider (not default)', async () => {
        // Set up scenario where there are multiple providers but only one enabled
        // and it's not the default provider
        providerRegistry.enabledProviders = ['other-provider'];
        providerRegistry.defaultProvider = 'google-liveapi';
        vi.mocked(getEnabledProviders).mockReturnValue([{ name: 'other-provider' }]);
        vi.mocked(getProvider).mockReturnValue({ ...mockOtherProvider, enabled: true });
        
        await expect(command.execute('disable', { name: 'other-provider' }))
          .rejects.toThrow('Process exited');
        
        const errorOutput = consoleErrorOutput.join('\n');
        expect(errorOutput).toContain("Error: Cannot disable the last enabled provider 'other-provider'.");
        expect(errorOutput).toContain('At least one provider must remain enabled.');
      });
    });

    describe('parameter validation', () => {
      it('handles showProvider with undefined name', async () => {
        await expect(command.execute('show', {}))
          .rejects.toThrow('Process exited');
        
        const errorOutput = consoleErrorOutput.join('\n');
        expect(errorOutput).toContain('Error: Provider name is required.');
      });

      it('handles enableProviderCommand with undefined name', async () => {
        await expect(command.execute('enable', {}))
          .rejects.toThrow('Process exited');
        
        const errorOutput = consoleErrorOutput.join('\n');
        expect(errorOutput).toContain('Error: Provider name is required.');
      });

      it('handles disableProviderCommand with undefined name', async () => {
        await expect(command.execute('disable', {}))
          .rejects.toThrow('Process exited');
        
        const errorOutput = consoleErrorOutput.join('\n');
        expect(errorOutput).toContain('Error: Provider name is required.');
      });

      it('handles setDefaultProviderCommand with undefined name', async () => {
        await expect(command.execute('set-default', {}))
          .rejects.toThrow('Process exited');
        
        const errorOutput = consoleErrorOutput.join('\n');
        expect(errorOutput).toContain('Error: Provider name is required.');
      });
    });

    describe('additional failure scenarios', () => {
      it('handles setDefaultProvider failure', async () => {
        providerRegistry.enabledProviders = ['google-liveapi', 'other-provider'];
        vi.mocked(getProvider).mockReturnValue({ ...mockOtherProvider, enabled: true });
        vi.mocked(setDefaultProvider).mockReturnValue(false);
        
        await expect(command.execute('set-default', { name: 'other-provider' }))
          .rejects.toThrow('Process exited');
        
        const errorOutput = consoleErrorOutput.join('\n');
        expect(errorOutput).toContain("Failed to set 'other-provider' as default provider.");
      });

      it('handles disableProvider failure', async () => {
        providerRegistry.enabledProviders = ['google-liveapi', 'other-provider'];
        providerRegistry.defaultProvider = 'google-liveapi';
        vi.mocked(getProvider).mockReturnValue({ ...mockOtherProvider, enabled: true });
        vi.mocked(getEnabledProviders).mockReturnValue([
          { name: 'google-liveapi' },
          { name: 'other-provider' }
        ]);
        vi.mocked(disableProvider).mockReturnValue(false);
        
        await expect(command.execute('disable', { name: 'other-provider' }))
          .rejects.toThrow('Process exited');
        
        const errorOutput = consoleErrorOutput.join('\n');
        expect(errorOutput).toContain("Failed to disable provider 'other-provider'.");
      });

      it('handles provider not found in disable command', async () => {
        vi.mocked(getProvider).mockReturnValue(null);
        
        await expect(command.execute('disable', { name: 'unknown' }))
          .rejects.toThrow('Process exited');
        
        const errorOutput = consoleErrorOutput.join('\n');
        expect(errorOutput).toContain("Error: Provider 'unknown' not found.");
      });

      it('handles provider not found in set-default command', async () => {
        vi.mocked(getProvider).mockReturnValue(null);
        
        await expect(command.execute('set-default', { name: 'unknown' }))
          .rejects.toThrow('Process exited');
        
        const errorOutput = consoleErrorOutput.join('\n');
        expect(errorOutput).toContain("Error: Provider 'unknown' not found.");
      });
    });

    describe('google provider config edge cases', () => {
      it('handles google provider without defaultModel', async () => {
        const providerNoDefaultModel = {
          ...mockGoogleProvider,
          config: {
            client: {
              apiKey: 'test-key-1234'
            }
            // no defaultModel
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerNoDefaultModel);
        
        await command.execute('show', { name: 'google-liveapi' });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('API Key: ***1234');
        expect(output).not.toContain('Default Model:');
      });

      it('handles google provider without apiKey defined', async () => {
        const providerNoApiKey = {
          ...mockGoogleProvider,
          config: {
            client: {
              // no apiKey property
            },
            defaultModel: 'default'
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerNoApiKey);
        
        await command.execute('show', { name: 'google-liveapi' });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('Configuration:');
        // Should fall back to JSON stringification since apiKey is undefined
        expect(output).toContain(JSON.stringify(providerNoApiKey.config, null, 2));
      });

      it('handles google provider without client config', async () => {
        const providerNoClient = {
          ...mockGoogleProvider,
          config: {
            // no client property
            defaultModel: 'default'
          }
        };
        vi.mocked(getProvider).mockReturnValue(providerNoClient);
        
        await command.execute('show', { name: 'google-liveapi' });
        
        const output = consoleOutput.join('\n');
        expect(output).toContain('Configuration:');
        // Should fall back to JSON stringification since client is undefined
        expect(output).toContain(JSON.stringify(providerNoClient.config, null, 2));
      });
    });
  });
});