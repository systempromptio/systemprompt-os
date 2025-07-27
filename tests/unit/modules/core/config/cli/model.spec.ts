/**
 * @fileoverview Unit tests for model CLI command
 * @module tests/unit/modules/core/config/cli/model
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/config/cli/model.js';
import { providers, getEnabledProviders, getProvider } from '../../../../../../src/modules/core/config/providers.js';
import { GoogleGenAI } from '@google/genai';
import { getLoggerService } from '../../../../../../src/modules/core/logger/index.js';
import { formatTools, logModelConfigDetails } from '../../../../../../src/modules/core/config/cli/model-helpers.js';
import { executeModelTest } from '../../../../../../src/modules/core/config/cli/model-commands.js';

// Mock dependencies
vi.mock('../../../../../../src/modules/core/config/providers', () => ({
  providers: {},
  getEnabledProviders: vi.fn(),
  getProvider: vi.fn()
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn()
}));

// Create shared logger mock that will be updated in beforeEach
let mockLogger: any;

// Mock logger service
vi.mock('../../../../../../src/modules/core/logger', () => ({
  getLoggerService: vi.fn(() => mockLogger)
}));

// Mock helper functions
vi.mock('../../../../../../src/modules/core/config/cli/model-helpers', () => ({
  formatTools: vi.fn((tools) => {
    if (!tools || !Array.isArray(tools)) return 'None';
    return tools.map(tool => {
      if (tool.codeExecution !== undefined) return 'Code Execution';
      return 'Unknown Tool';
    }).join(', ');
  }),
  logModelConfigDetails: vi.fn()
}));

// Mock model commands
vi.mock('../../../../../../src/modules/core/config/cli/model-commands', () => ({
  executeModelTest: vi.fn()
}));

describe('model CLI command', () => {
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let originalProcessExit: any;
  let originalEnv: any;
  let consoleOutput: string[] = [];
  let consoleErrorOutput: string[] = [];
  
  const mockGoogleProvider = {
    name: 'google-liveapi',
    displayName: 'Google Live API',
    enabled: true,
    config: {
      defaultModel: 'default',
      client: {
        apiKey: 'test-api-key'
      },
      models: {
        default: {
          model: 'gemini-1.5-flash',
          displayName: 'Gemini 1.5 Flash',
          description: 'Fast model',
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            candidateCount: 1,
            stopSequences: []
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' }
          ],
          systemInstruction: 'You are a helpful assistant',
          tools: [{ codeExecution: {} }]
        },
        coder: {
          model: 'gemini-1.5-pro',
          displayName: 'Gemini 1.5 Pro',
          description: 'Advanced model',
          generationConfig: {
            temperature: 0.2,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 16384,
            candidateCount: 1,
            responseMimeType: 'application/json'
          },
          safetySettings: []
        }
      }
    }
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutput = [];
    consoleErrorOutput = [];
    
    // Save and mock environment
    originalEnv = process.env;
    process.env = { ...originalEnv };
    
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
    
    // Set up default provider mocks
    Object.assign(providers, {
      'google-liveapi': mockGoogleProvider
    });
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    process.env = originalEnv;
  });
  
  describe('list subcommand', () => {
    it('lists all models from enabled providers', async () => {
      vi.mocked(getEnabledProviders).mockReturnValue([mockGoogleProvider]);
      
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Available AI Models:');
      expect(output).toContain('Provider: Google Live API (google-liveapi)');
      expect(output).toContain('default [DEFAULT]:');
      expect(output).toContain('Model: gemini-1.5-flash');
      expect(output).toContain('Display: Gemini 1.5 Flash');
      expect(output).toContain('Temperature: 0.7');
      expect(output).toContain('Tools: Code Execution');
      expect(output).toContain('coder:');
      expect(output).toContain('Model: gemini-1.5-pro');
      expect(output).toContain('Total models available: 2');
    });
    
    it('lists models from specific provider', async () => {
      await command.execute('list', { provider: 'google-liveapi' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Provider: Google Live API');
      expect(output).toContain('Total models available: 2');
    });
    
    it('handles provider not found', async () => {
      await expect(command.execute('list', { provider: 'unknown' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain("Error: Provider 'unknown' not found or not enabled.");
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('handles no enabled providers', async () => {
      vi.mocked(getEnabledProviders).mockReturnValue([]);
      
      await expect(command.execute('list', {}))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('No enabled providers found.');
    });
    
    it('handles non-google providers', async () => {
      const otherProvider = {
        name: 'other',
        displayName: 'Other Provider',
        enabled: true
      };
      vi.mocked(getEnabledProviders).mockReturnValue([otherProvider]);
      
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Provider: Other Provider (other)');
      expect(output).toContain('Model information not available for this provider.');
      expect(output).toContain('Total models available: 0');
    });
    
    it('handles models with unknown tool types', async () => {
      const providerWithUnknownTools = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: {
            test: {
              model: 'test-model',
              displayName: 'Test Model',
              tools: [{ unknownTool: {} }]
            }
          }
        }
      };
      vi.mocked(getEnabledProviders).mockReturnValue([providerWithUnknownTools]);
      
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Tools: Unknown Tool');
    });
  });
  
  describe('show subcommand', () => {
    it('shows model details', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await command.execute('show', { provider: 'google-liveapi', model: 'default' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Model Configuration:');
      expect(output).toContain('Provider: Google Live API');
      expect(output).toContain('Model Key: default');
      expect(output).toContain('Status: DEFAULT MODEL');
      expect(output).toContain('Model ID: gemini-1.5-flash');
      expect(output).toContain('Display Name: Gemini 1.5 Flash');
      expect(output).toContain('Generation Configuration:');
      expect(output).toContain('Temperature: 0.7');
      expect(output).toContain('Safety Settings:');
      expect(output).toContain('HARM_CATEGORY_HATE_SPEECH: BLOCK_ONLY_HIGH');
      expect(output).toContain('System Instruction:');
      expect(output).toContain('You are a helpful assistant');
      expect(output).toContain('Available Tools:');
      expect(output).toContain('- Code Execution');
      expect(output).toContain('Full Configuration (JSON):');
    });
    
    it('shows model with response mime type', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await command.execute('show', { provider: 'google-liveapi', model: 'coder' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Response MIME Type: application/json');
      expect(output).not.toContain('Status: DEFAULT MODEL');
    });
    
    it('shows model with stop sequences', async () => {
      const providerWithStopSequences = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: {
            ...mockGoogleProvider.config.models,
            default: {
              ...mockGoogleProvider.config.models.default,
              generationConfig: {
                ...mockGoogleProvider.config.models.default.generationConfig,
                stopSequences: ['STOP', 'END']
              }
            }
          }
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithStopSequences);
      
      await command.execute('show', { provider: 'google-liveapi', model: 'default' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Stop Sequences: STOP, END');
    });
    
    it('handles provider not found', async () => {
      vi.mocked(getProvider).mockReturnValue(null);
      
      await expect(command.execute('show', { provider: 'unknown', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain("Error: Provider 'unknown' not found.");
    });
    
    it('handles disabled provider', async () => {
      vi.mocked(getProvider).mockReturnValue({ ...mockGoogleProvider, enabled: false });
      
      await expect(command.execute('show', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain("Error: Provider 'google-liveapi' is not enabled.");
    });
    
    it('handles non-google provider', async () => {
      vi.mocked(getProvider).mockReturnValue({ name: 'other', enabled: true });
      
      await expect(command.execute('show', { provider: 'other', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Model details are only available for google-liveapi provider.');
    });
    
    it('handles model not found', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await expect(command.execute('show', { provider: 'google-liveapi', model: 'unknown' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain("Error: Model 'unknown' not found");
      expect(errorOutput).toContain('Available models: default, coder');
    });
    
    it('handles provider with no models configured', async () => {
      const providerWithoutModels = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: undefined
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithoutModels);
      
      await expect(command.execute('show', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('No models configured for this provider.');
    });

    it('handles provider with empty models object', async () => {
      const providerWithEmptyModels = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: {}
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithEmptyModels);
      
      await expect(command.execute('show', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain("Error: Model 'default' not found in provider 'google-liveapi'.");
      expect(errorOutput).toContain('Available models: ');
    });
  });
  
  describe('test subcommand', () => {
    let mockClient: any;
    
    beforeEach(() => {
      mockClient = {
        models: {
          generateContent: vi.fn()
        }
      };
      vi.mocked(GoogleGenAI).mockImplementation(() => mockClient);
    });
    
    it('tests model with default prompt', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      mockClient.models.generateContent.mockResolvedValue({
        text: 'Test successful!',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15
        }
      });
      
      await command.execute('test', { provider: 'google-liveapi', model: 'default' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Testing Model Configuration:');
      expect(output).toContain('Provider: Google Live API');
      expect(output).toContain('Model: Gemini 1.5 Flash (gemini-1.5-flash)');
      expect(output).toContain("Prompt: Hello, please respond with 'Test successful!'");
      expect(output).toContain('Response received!');
      expect(output).toContain('Prompt Tokens: 10');
      expect(output).toContain('Response Tokens: 5');
      expect(output).toContain('Test successful!');
      expect(output).toContain('✓ Model test completed successfully!');
    });
    
    it('tests model with custom prompt', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      mockClient.models.generateContent.mockResolvedValue({
        text: '42'
      });
      
      await command.execute('test', { 
        provider: 'google-liveapi', 
        model: 'default',
        prompt: 'What is 21 + 21?'
      });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Prompt: What is 21 + 21?');
      expect(output).toContain('42');
    });
    
    it('handles missing API key', async () => {
      const providerNoKey = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          client: { apiKey: '' }
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerNoKey);
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error: API key not configured');
    });
    
    it('handles test errors', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      mockClient.models.generateContent.mockRejectedValue(new Error('API Error'));
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error testing model:');
      expect(errorOutput).toContain('API Error');
    });
    
    it('shows stack trace in debug mode', async () => {
      process.env.DEBUG = 'true';
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      const error = new Error('API Error');
      error.stack = 'Error: API Error\n    at test.js:10';
      mockClient.models.generateContent.mockRejectedValue(error);
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Stack trace:');
      expect(errorOutput).toContain('at test.js:10');
    });
    
    it('handles provider with no models configured for test', async () => {
      const providerWithoutModels = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: undefined
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithoutModels);
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('No models configured for this provider.');
    });

    it('handles provider with empty models object for test', async () => {
      const providerWithEmptyModels = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: {}
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithEmptyModels);
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain("Error: Model 'default' not found in provider 'google-liveapi'.");
      expect(errorOutput).toContain('Available models: ');
    });

    it('handles model not found in test', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'nonexistent' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain("Error: Model 'nonexistent' not found in provider 'google-liveapi'.");
      expect(errorOutput).toContain('Available models: default, coder');
    });

    it('handles provider not found for test', async () => {
      vi.mocked(getProvider).mockReturnValue(null);
      
      await expect(command.execute('test', { provider: 'unknown', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain("Error: Provider 'unknown' not found.");
    });

    it('handles disabled provider for test', async () => {
      vi.mocked(getProvider).mockReturnValue({ ...mockGoogleProvider, enabled: false });
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain("Error: Provider 'google-liveapi' is not enabled.");
    });

    it('handles non-google provider for test', async () => {
      vi.mocked(getProvider).mockReturnValue({ name: 'other', enabled: true });
      
      await expect(command.execute('test', { provider: 'other', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Model testing is only available for google-liveapi provider.');
    });
  });
  
  describe('execute', () => {
    it('handles unknown subcommand', async () => {
      await expect(command.execute('unknown', {}))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Unknown model subcommand: unknown');
      expect(consoleErrorOutput).toContain('Available subcommands: list, show, test');
    });
  });

  describe('Internal helper functions', () => {
    // Test internal functions through their effects on public API
    it('handles provider structure validation through createTypedProvider', async () => {
      // Test invalid provider structure (null object)
      vi.mocked(getProvider).mockReturnValue(null);
      
      await expect(command.execute('show', { provider: 'invalid', model: 'test' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain("Error: Provider 'invalid' not found.");
    });

    it('handles provider with invalid structure', async () => {
      // Test provider with missing required fields
      vi.mocked(getProvider).mockReturnValue({ name: 'test' } as any);
      
      await expect(command.execute('show', { provider: 'test', model: 'test' }))
        .rejects.toThrow('Process exited');
    });

    it('handles provider with config but no models/client/defaultModel', async () => {
      const providerWithEmptyConfig = {
        name: 'google-liveapi',
        displayName: 'Google Live API',
        enabled: true,
        config: {
          someOtherProperty: 'value'
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithEmptyConfig);
      
      await expect(command.execute('show', { provider: 'google-liveapi', model: 'test' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('No models configured for this provider.');
    });

    it('validates API key when empty string is provided', async () => {
      const providerWithEmptyKey = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          client: { apiKey: '' }
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithEmptyKey);
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('API key not configured for this provider.');
    });

    it('handles missing required parameters for show command', async () => {
      await expect(command.execute('show', { provider: undefined, model: 'test' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Both provider and model must be specified.');
    });

    it('handles missing required parameters for test command', async () => {
      await expect(command.execute('test', { provider: 'google-liveapi', model: undefined }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Both provider and model must be specified.');
    });

    it('handles providers with undefined config', async () => {
      const providerWithoutConfig = {
        name: 'google-liveapi',
        displayName: 'Google Live API',
        enabled: true
        // No config property
      };
      vi.mocked(getProvider).mockReturnValue(providerWithoutConfig);
      
      await expect(command.execute('show', { provider: 'google-liveapi', model: 'test' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('No models configured for this provider.');
    });

    it('handles provider config with null models', async () => {
      const providerWithNullModels = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: null
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithNullModels);
      
      await expect(command.execute('show', { provider: 'google-liveapi', model: 'test' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('No models configured for this provider.');
    });

    it('logs model details for models without description', async () => {
      const providerWithoutDescription = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: {
            test: {
              model: 'test-model',
              displayName: 'Test Model'
              // No description
            }
          }
        }
      };
      vi.mocked(getEnabledProviders).mockReturnValue([providerWithoutDescription]);
      
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Test Model');
      expect(output).not.toContain('Description:');
    });

    it('logs model details for models without temperature', async () => {
      const providerWithoutTemp = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: {
            test: {
              model: 'test-model',
              displayName: 'Test Model',
              generationConfig: {
                topK: 20
                // No temperature
              }
            }
          }
        }
      };
      vi.mocked(getEnabledProviders).mockReturnValue([providerWithoutTemp]);
      
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Test Model');
      expect(output).not.toContain('Temperature:');
    });

    it('logs model details for models without tools', async () => {
      const providerWithoutTools = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: {
            test: {
              model: 'test-model',
              displayName: 'Test Model'
              // No tools
            }
          }
        }
      };
      vi.mocked(getEnabledProviders).mockReturnValue([providerWithoutTools]);
      
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Test Model');
      expect(output).not.toContain('Tools:');
    });

    it('handles error without stack trace when DEBUG is not set', async () => {
      delete process.env.DEBUG;
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      const mockClient = {
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error('API Error'))
        }
      };
      vi.mocked(GoogleGenAI).mockImplementation(() => mockClient);
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('API Error');
      expect(errorOutput).not.toContain('Stack trace:');
    });

    it('handles non-Error objects in test error handling', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      const mockClient = {
        models: {
          generateContent: vi.fn().mockRejectedValue('String error')
        }
      };
      vi.mocked(GoogleGenAI).mockImplementation(() => mockClient);
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('String error');
    });

    it('verifies helper function calls during model listing', async () => {
      vi.mocked(getEnabledProviders).mockReturnValue([mockGoogleProvider]);
      vi.mocked(formatTools).mockReturnValue('Code Execution');
      
      await command.execute('list', {});
      
      expect(formatTools).toHaveBeenCalledWith([{ codeExecution: {} }]);
    });

    it('verifies helper function calls during model show', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await command.execute('show', { provider: 'google-liveapi', model: 'default' });
      
      expect(logModelConfigDetails).toHaveBeenCalledWith(mockGoogleProvider.config.models.default);
    });

    it('verifies test execution with helper functions', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      const mockClient = {
        models: {
          generateContent: vi.fn()
        }
      };
      vi.mocked(GoogleGenAI).mockImplementation(() => mockClient);
      vi.mocked(executeModelTest).mockResolvedValue();
      
      await command.execute('test', { provider: 'google-liveapi', model: 'default' });
      
      expect(executeModelTest).toHaveBeenCalledWith(
        expect.any(Object), // GoogleGenAI instance
        mockGoogleProvider.config.models.default,
        "Hello, please respond with 'Test successful!'"
      );
    });

    it('handles providers directly from providers object in getProvidersToCheck', async () => {
      // This tests the branch where providerName is specified and we use providers[providerName]
      Object.assign(providers, {
        'test-provider': {
          name: 'test-provider',
          displayName: 'Test Provider',
          enabled: true
        }
      });
      
      await command.execute('list', { provider: 'test-provider' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Test Provider');
    });

    it('creates typed provider with config containing client, models, and defaultModel', async () => {
      const complexProvider = {
        name: 'google-liveapi',
        displayName: 'Google Live API',
        enabled: true,
        config: {
          client: { apiKey: 'test-key' },
          models: { test: { model: 'test' } },
          defaultModel: 'test'
        }
      };
      vi.mocked(getProvider).mockReturnValue(complexProvider);
      
      await command.execute('show', { provider: 'google-liveapi', model: 'test' });
      
      // If this doesn't throw, the typed provider was created successfully
      expect(consoleErrorOutput).not.toContain('Invalid provider structure');
    });

    it('handles provider with config as non-object', async () => {
      const invalidProvider = {
        name: 'google-liveapi',
        displayName: 'Google Live API',
        enabled: true,
        config: 'invalid-config' // Non-object config
      };
      vi.mocked(getProvider).mockReturnValue(invalidProvider);
      
      await expect(command.execute('show', { provider: 'google-liveapi', model: 'test' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('No models configured for this provider.');
    });

    it('handles provider with config as null', async () => {
      const nullConfigProvider = {
        name: 'google-liveapi',
        displayName: 'Google Live API',
        enabled: true,
        config: null
      };
      vi.mocked(getProvider).mockReturnValue(nullConfigProvider);
      
      await expect(command.execute('show', { provider: 'google-liveapi', model: 'test' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('No models configured for this provider.');
    });

    it('handles API key validation when client is undefined', async () => {
      const providerWithoutClient = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          client: undefined
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithoutClient);
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('API key not configured for this provider.');
    });

    it('handles prepareModelTest throwing error when API key is missing after validation', async () => {
      const providerWithUndefinedKey = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          client: { apiKey: undefined }
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithUndefinedKey);
      
      await expect(command.execute('test', { provider: 'google-liveapi', model: 'default' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('API key not configured for this provider.');
    });

    it('handles model status display for non-default models', async () => {
      vi.mocked(getProvider).mockReturnValue(mockGoogleProvider);
      
      await command.execute('show', { provider: 'google-liveapi', model: 'coder' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Status: AVAILABLE');
      expect(output).not.toContain('Status: DEFAULT MODEL');
    });

    it('handles provider without defaultModel in config', async () => {
      const providerWithoutDefault = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          defaultModel: undefined
        }
      };
      vi.mocked(getProvider).mockReturnValue(providerWithoutDefault);
      
      await command.execute('show', { provider: 'google-liveapi', model: 'default' });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Status: AVAILABLE');
    });

    it('handles models with undefined generationConfig', async () => {
      const providerWithoutGenConfig = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: {
            test: {
              model: 'test-model',
              displayName: 'Test Model',
              generationConfig: undefined
            }
          }
        }
      };
      vi.mocked(getEnabledProviders).mockReturnValue([providerWithoutGenConfig]);
      
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Test Model');
      expect(output).not.toContain('Temperature:');
    });

    it('verifies all console output is captured correctly', async () => {
      vi.mocked(getEnabledProviders).mockReturnValue([mockGoogleProvider]);
      
      await command.execute('list', {});
      
      // Verify that console.log was called for various parts of the output
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput.some(line => line.includes('Available AI Models:'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Provider: Google Live API'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Total models available:'))).toBe(true);
    });

    it('handles providers with different config structures correctly', async () => {
      const minimalProvider = {
        name: 'google-liveapi',
        displayName: 'Google Live API',
        enabled: true,
        config: {
          models: {
            simple: {
              model: 'simple-model',
              displayName: 'Simple Model'
            }
          }
        }
      };
      vi.mocked(getEnabledProviders).mockReturnValue([minimalProvider]);
      
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Simple Model');
      expect(output).toContain('Total models available: 1');
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('handles empty providers object', async () => {
      Object.assign(providers, {});
      
      await expect(command.execute('list', { provider: 'nonexistent' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain("Provider 'nonexistent' not found or not enabled.");
    });

    it('handles provider with disabled state in providers object', async () => {
      Object.assign(providers, {
        'disabled-provider': {
          name: 'disabled-provider',
          displayName: 'Disabled Provider',
          enabled: false
        }
      });
      
      await expect(command.execute('list', { provider: 'disabled-provider' }))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain("Provider 'disabled-provider' not found or not enabled.");
    });

    it('handles large model configurations', async () => {
      const largeProvider = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: Array.from({ length: 10 }, (_, i) => ({
            [`model${i}`]: {
              model: `test-model-${i}`,
              displayName: `Test Model ${i}`,
              description: `Description for model ${i}`,
              generationConfig: {
                temperature: 0.5 + (i * 0.1),
                topK: 10 + i,
                topP: 0.8 + (i * 0.01),
                maxOutputTokens: 1000 + (i * 100)
              }
            }
          })).reduce((acc, curr) => ({ ...acc, ...curr }), {})
        }
      };
      vi.mocked(getEnabledProviders).mockReturnValue([largeProvider]);
      
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Total models available: 10');
      expect(output).toContain('Test Model 0');
      expect(output).toContain('Test Model 9');
    });

    it('handles model with all optional fields present', async () => {
      const completeProvider = {
        ...mockGoogleProvider,
        config: {
          ...mockGoogleProvider.config,
          models: {
            complete: {
              model: 'complete-model',
              displayName: 'Complete Model',
              description: 'A model with all fields',
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
                candidateCount: 1,
                responseMimeType: 'application/json',
                stopSequences: ['STOP', 'END']
              },
              safetySettings: [
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' }
              ],
              systemInstruction: 'You are a complete assistant',
              tools: [{ codeExecution: {} }]
            }
          }
        }
      };
      vi.mocked(getEnabledProviders).mockReturnValue([completeProvider]);
      
      await command.execute('list', {});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Complete Model');
      expect(output).toContain('Temperature: 0.7');
      expect(output).toContain('Tools: Code Execution');
    });
  });
});