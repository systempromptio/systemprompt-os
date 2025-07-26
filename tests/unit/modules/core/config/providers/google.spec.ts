/**
 * @fileoverview Unit tests for Google Live API provider configuration
 * @module tests/unit/modules/core/config/providers/google
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { googleLiveAPIProvider, getModelConfig, getClientOptions } from '../../../../../../src/modules/core/config/providers/google.js';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';

// Mock environment variables
const originalEnv = process.env;

describe('Google Live API Provider Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
  
  describe('googleLiveAPIProvider', () => {
    it('exports provider configuration with correct structure', () => {
      expect(googleLiveAPIProvider).toBeDefined();
      expect(googleLiveAPIProvider.name).toBe('google-liveapi');
      expect(googleLiveAPIProvider.displayName).toBe('Google Live API (Gemini)');
      expect(googleLiveAPIProvider.description).toContain('Gemini AI models');
      expect(googleLiveAPIProvider.enabled).toBe(true);
      expect(googleLiveAPIProvider.version).toBe('1.0.0');
    });
    
    it('includes default model configuration', () => {
      const config = googleLiveAPIProvider.config as any;
      expect(config.defaultModel).toBe('default');
      expect(config.models).toBeDefined();
      expect(config.models.default).toBeDefined();
    });
    
    it('uses environment variable for API key', () => {
      // Test that the provider uses env var at initialization
      const config = googleLiveAPIProvider.config as any;
      expect(config.client.apiKey).toBeDefined();
      // The actual value depends on what's in the environment
      expect(typeof config.client.apiKey).toBe('string');
    });
  });
  
  describe('Model Configurations', () => {
    it('provides default model configuration', () => {
      const defaultModel = getModelConfig('default');
      expect(defaultModel).toBeDefined();
      expect(defaultModel?.model).toBe('gemini-1.5-flash');
      expect(defaultModel?.displayName).toBe('Gemini 1.5 Flash');
      expect(defaultModel?.generationConfig).toEqual({
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        candidateCount: 1,
        stopSequences: []
      });
    });
    
    it('provides coder model configuration', () => {
      const coderModel = getModelConfig('coder');
      expect(coderModel).toBeDefined();
      expect(coderModel?.model).toBe('gemini-1.5-pro');
      expect(coderModel?.displayName).toBe('Gemini 1.5 Pro (Coder)');
      expect(coderModel?.generationConfig?.temperature).toBe(0.2);
      expect(coderModel?.tools).toEqual([{ codeExecution: {} }]);
    });
    
    it('provides creative model configuration', () => {
      const creativeModel = getModelConfig('creative');
      expect(creativeModel).toBeDefined();
      expect(creativeModel?.model).toBe('gemini-1.5-flash');
      expect(creativeModel?.displayName).toBe('Gemini 1.5 Flash (Creative)');
      expect(creativeModel?.generationConfig?.temperature).toBe(1.2);
    });
    
    it('provides analyst model configuration', () => {
      const analystModel = getModelConfig('analyst');
      expect(analystModel).toBeDefined();
      expect(analystModel?.model).toBe('gemini-1.5-pro');
      expect(analystModel?.displayName).toBe('Gemini 1.5 Pro (Analyst)');
      expect(analystModel?.generationConfig?.responseMimeType).toBe('application/json');
      expect(analystModel?.tools).toEqual([{ codeExecution: {} }]);
    });
    
    it('returns undefined for unknown model', () => {
      const unknownModel = getModelConfig('unknown');
      expect(unknownModel).toBeUndefined();
    });
  });
  
  describe('Safety Settings', () => {
    it('applies default safety settings to all models', () => {
      const models = ['default', 'coder', 'creative', 'analyst'];
      
      models.forEach(modelName => {
        const model = getModelConfig(modelName);
        expect(model?.safetySettings).toBeDefined();
        expect(model?.safetySettings).toHaveLength(4);
        
        const settings = model?.safetySettings || [];
        expect(settings).toContainEqual({
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        });
        expect(settings).toContainEqual({
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        });
      });
    });
  });
  
  describe('System Instructions', () => {
    it('provides appropriate system instructions for each model', () => {
      const defaultModel = getModelConfig('default');
      expect(defaultModel?.systemInstruction).toContain('helpful AI assistant');
      
      const coderModel = getModelConfig('coder');
      expect(coderModel?.systemInstruction).toContain('expert software engineer');
      
      const creativeModel = getModelConfig('creative');
      expect(creativeModel?.systemInstruction).toContain('creative writing assistant');
      
      const analystModel = getModelConfig('analyst');
      expect(analystModel?.systemInstruction).toContain('data analyst');
    });
  });
  
  describe('getClientOptions', () => {
    it('returns client configuration options', () => {
      const options = getClientOptions();
      expect(options).toBeDefined();
      expect(options).toHaveProperty('apiKey');
      expect(options).toHaveProperty('vertexai');
      expect(options.vertexai).toBe(false);
    });
    
    it('returns string API key', () => {
      const options = getClientOptions();
      expect(typeof options.apiKey).toBe('string');
    });
    
    it('returns empty string when GOOGLE_API_KEY is not set', () => {
      delete process.env.GOOGLE_API_KEY;
      const options = getClientOptions();
      expect(options.apiKey).toBe('');
    });
    
    it('returns environment variable value when GOOGLE_API_KEY is set', () => {
      const testApiKey = 'test-api-key-12345';
      process.env.GOOGLE_API_KEY = testApiKey;
      const options = getClientOptions();
      expect(options.apiKey).toBe(testApiKey);
    });
    
    it('handles empty string GOOGLE_API_KEY environment variable', () => {
      process.env.GOOGLE_API_KEY = '';
      const options = getClientOptions();
      expect(options.apiKey).toBe('');
    });
    
    it('handles whitespace-only GOOGLE_API_KEY environment variable', () => {
      process.env.GOOGLE_API_KEY = '   ';
      const options = getClientOptions();
      expect(options.apiKey).toBe('   ');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    describe('getModelConfig edge cases', () => {
      it('returns undefined for null input', () => {
        const result = getModelConfig(null as any);
        expect(result).toBeUndefined();
      });
      
      it('returns undefined for undefined input', () => {
        const result = getModelConfig(undefined as any);
        expect(result).toBeUndefined();
      });
      
      it('returns undefined for empty string', () => {
        const result = getModelConfig('');
        expect(result).toBeUndefined();
      });
      
      it('returns undefined for whitespace-only string', () => {
        const result = getModelConfig('   ');
        expect(result).toBeUndefined();
      });
      
      it('returns undefined for number input', () => {
        const result = getModelConfig(123 as any);
        expect(result).toBeUndefined();
      });
      
      it('returns undefined for object input', () => {
        const result = getModelConfig({} as any);
        expect(result).toBeUndefined();
      });
      
      it('returns undefined for array input', () => {
        const result = getModelConfig([] as any);
        expect(result).toBeUndefined();
      });
      
      it('is case sensitive for model names', () => {
        expect(getModelConfig('DEFAULT')).toBeUndefined();
        expect(getModelConfig('Default')).toBeUndefined();
        expect(getModelConfig('CODER')).toBeUndefined();
        expect(getModelConfig('Coder')).toBeUndefined();
      });
      
      it('returns undefined for partially matching model names', () => {
        expect(getModelConfig('def')).toBeUndefined();
        expect(getModelConfig('cod')).toBeUndefined();
        expect(getModelConfig('defaultmodel')).toBeUndefined();
      });
    });
    
    describe('Model configuration immutability', () => {
      it('returns different object instances for same model', () => {
        const config1 = getModelConfig('default');
        const config2 = getModelConfig('default');
        expect(config1).not.toBe(config2);
        expect(config1).toEqual(config2);
      });
      
      it('modifying returned config does not affect subsequent calls', () => {
        const config1 = getModelConfig('default');
        if (config1 && config1.generationConfig) {
          config1.generationConfig.temperature = 999;
        }
        
        const config2 = getModelConfig('default');
        expect(config2?.generationConfig?.temperature).toBe(0.7);
      });
    });
    
    describe('Complete model configuration validation', () => {
      it('validates all default model properties are present', () => {
        const config = getModelConfig('default');
        expect(config).toMatchObject({
          model: expect.any(String),
          displayName: expect.any(String),
          systemInstruction: expect.any(String),
          generationConfig: expect.objectContaining({
            temperature: expect.any(Number),
            topK: expect.any(Number),
            topP: expect.any(Number),
            maxOutputTokens: expect.any(Number),
            candidateCount: expect.any(Number),
            stopSequences: expect.any(Array)
          }),
          safetySettings: expect.arrayContaining([
            expect.objectContaining({
              category: expect.any(String),
              threshold: expect.any(String)
            })
          ])
        });
      });
      
      it('validates all coder model specific properties', () => {
        const config = getModelConfig('coder');
        expect(config).toMatchObject({
          model: 'gemini-1.5-pro',
          displayName: 'Gemini 1.5 Pro (Coder)',
          tools: [{ codeExecution: {} }],
          generationConfig: expect.objectContaining({
            temperature: 0.2
          })
        });
      });
      
      it('validates all creative model specific properties', () => {
        const config = getModelConfig('creative');
        expect(config).toMatchObject({
          model: 'gemini-1.5-flash',
          displayName: 'Gemini 1.5 Flash (Creative)',
          generationConfig: expect.objectContaining({
            temperature: 1.2
          })
        });
        expect(config?.tools).toBeUndefined();
      });
      
      it('validates all analyst model specific properties', () => {
        const config = getModelConfig('analyst');
        expect(config).toMatchObject({
          model: 'gemini-1.5-pro',
          displayName: 'Gemini 1.5 Pro (Analyst)',
          tools: [{ codeExecution: {} }],
          generationConfig: expect.objectContaining({
            responseMimeType: 'application/json'
          })
        });
      });
    });
    
    describe('Safety settings validation', () => {
      it('ensures all models have exactly 4 safety settings', () => {
        const models = ['default', 'coder', 'creative', 'analyst'];
        models.forEach(modelName => {
          const config = getModelConfig(modelName);
          expect(config?.safetySettings).toHaveLength(4);
        });
      });
      
      it('ensures all required harm categories are covered', () => {
        const requiredCategories = [
          HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          HarmCategory.HARM_CATEGORY_HARASSMENT,
          HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT
        ];
        
        const models = ['default', 'coder', 'creative', 'analyst'];
        models.forEach(modelName => {
          const config = getModelConfig(modelName);
          const categories = config?.safetySettings?.map(s => s.category) || [];
          requiredCategories.forEach(category => {
            expect(categories).toContain(category);
          });
        });
      });
      
      it('ensures all safety settings use BLOCK_ONLY_HIGH threshold', () => {
        const models = ['default', 'coder', 'creative', 'analyst'];
        models.forEach(modelName => {
          const config = getModelConfig(modelName);
          config?.safetySettings?.forEach(setting => {
            expect(setting.threshold).toBe(HarmBlockThreshold.BLOCK_ONLY_HIGH);
          });
        });
      });
    });
  });

  describe('Provider Configuration Integration', () => {
    it('ensures provider config references correct models', () => {
      const config = googleLiveAPIProvider.config as any;
      expect(config.models).toBeDefined();
      expect(config.models.default).toBeDefined();
      expect(config.models.coder).toBeDefined();
      expect(config.models.creative).toBeDefined();
      expect(config.models.analyst).toBeDefined();
    });
    
    it('ensures provider client config matches getClientOptions', () => {
      const providerClientConfig = (googleLiveAPIProvider.config as any).client;
      const clientOptions = getClientOptions();
      expect(providerClientConfig).toEqual(clientOptions);
    });
    
    it('validates provider metadata completeness', () => {
      expect(googleLiveAPIProvider.name).toBeTruthy();
      expect(googleLiveAPIProvider.displayName).toBeTruthy();
      expect(googleLiveAPIProvider.description).toBeTruthy();
      expect(googleLiveAPIProvider.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(typeof googleLiveAPIProvider.enabled).toBe('boolean');
    });
  });

  describe('Environment Variable Behavior', () => {
    it('handles undefined process.env', () => {
      const originalProcessEnv = process.env;
      // @ts-ignore - Testing edge case
      global.process.env = undefined;
      
      const options = getClientOptions();
      expect(options.apiKey).toBe('');
      
      global.process.env = originalProcessEnv;
    });
    
    it('handles process.env as non-object', () => {
      const originalProcessEnv = process.env;
      // @ts-ignore - Testing edge case  
      global.process.env = 'not an object';
      
      const options = getClientOptions();
      expect(options.apiKey).toBe('');
      
      global.process.env = originalProcessEnv;
    });
    
    it('handles exception when accessing process.env', () => {
      const originalProcessEnv = process.env;
      const originalProcess = global.process;
      
      // @ts-ignore - Testing edge case
      global.process = {
        get env() {
          throw new Error('Access denied');
        }
      };
      
      const options = getClientOptions();
      expect(options.apiKey).toBe('');
      expect(options.vertexai).toBe(false);
      
      global.process = originalProcess;
      process.env = originalProcessEnv;
    });
  });
});