/**
 * @fileoverview Unit tests for model CLI command
 * @module tests/unit/modules/core/config/cli/model
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/config/cli/model';
import { providers, getEnabledProviders, getProvider } from '../../../../../../src/modules/core/config/providers';
import { GoogleGenAI } from '@google/genai';

// Mock dependencies
vi.mock('../../../../../../src/modules/core/config/providers', () => ({
  providers: {},
  getEnabledProviders: vi.fn(),
  getProvider: vi.fn()
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn()
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
  });
  
  describe('execute', () => {
    it('handles unknown subcommand', async () => {
      await expect(command.execute('unknown', {}))
        .rejects.toThrow('Process exited');
      
      expect(consoleErrorOutput).toContain('Unknown model subcommand: unknown');
      expect(consoleErrorOutput).toContain('Available subcommands: list, show, test');
    });
  });
});