/**
 * @fileoverview Unit tests for Google Live API provider configuration
 * @module tests/unit/modules/core/config/providers/google
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { googleLiveAPIProvider, getModelConfig, getClientOptions } from '../../../../../../src/modules/core/config/providers/google';
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
  });
});