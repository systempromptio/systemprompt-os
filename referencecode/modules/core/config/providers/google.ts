/**
 * @fileoverview Google Live API provider configuration
 * @module modules/core/config/providers/google
 */

import type {
  SafetySetting,
} from '@google/genai';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import type { ProviderConfig, GoogleLiveAPIConfig, ModelConfig } from '../types/provider.js';

/**
 * Default safety settings for all models
 */
const defaultSafetySettings: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

/**
 * Model configurations for Google Live API
 */
const models: Record<string, ModelConfig> = {
  default: {
    model: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    description: 'Fast, versatile model for most tasks',
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      candidateCount: 1,
      stopSequences: [],
    },
    safetySettings: defaultSafetySettings,
    systemInstruction: 'You are a helpful AI assistant. Be concise and accurate in your responses.',
  },

  coder: {
    model: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro (Coder)',
    description: 'Advanced model optimized for code generation and technical tasks',
    generationConfig: {
      temperature: 0.2,
      topK: 20,
      topP: 0.8,
      maxOutputTokens: 16384,
      candidateCount: 1,
    },
    safetySettings: defaultSafetySettings,
    systemInstruction: 'You are an expert software engineer. Provide clear, efficient, and well-documented code. Follow best practices and consider edge cases.',
    tools: [{ codeExecution: {} }],
  },

  creative: {
    model: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash (Creative)',
    description: 'Model tuned for creative writing and content generation',
    generationConfig: {
      temperature: 1.2,
      topK: 60,
      topP: 0.95,
      maxOutputTokens: 8192,
      candidateCount: 1,
    },
    safetySettings: defaultSafetySettings,
    systemInstruction: 'You are a creative writing assistant. Generate engaging, original, and imaginative content.',
  },

  analyst: {
    model: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro (Analyst)',
    description: 'Model optimized for data analysis and structured outputs',
    generationConfig: {
      temperature: 0.3,
      topK: 30,
      topP: 0.9,
      maxOutputTokens: 8192,
      candidateCount: 1,
      responseMimeType: 'application/json',
    },
    safetySettings: defaultSafetySettings,
    systemInstruction: 'You are a data analyst. Provide accurate, detailed analysis with clear insights. Use structured formats when appropriate.',
    tools: [{ codeExecution: {} }],
  },
};

/**
 * Google Live API provider configuration
 */
export const googleLiveAPIProvider: ProviderConfig = {
  name: 'google-liveapi',
  displayName: 'Google Live API (Gemini)',
  description: 'Google\'s Gemini AI models accessed through the Live API',
  enabled: true,
  version: '1.0.0',
  config: {
    client: {
      apiKey: process.env['GEMINI_API_KEY'] || '',
      vertexai: false,
      // project: process.env.GOOGLE_CLOUD_PROJECT,  // For Vertex AI
      // location: process.env.GOOGLE_CLOUD_LOCATION  // For Vertex AI
    },
    defaultModel: 'default',
    models,
  } as GoogleLiveAPIConfig,
};

/**
 * Helper to get a specific model configuration
 */
export function getModelConfig(modelName: string): ModelConfig | undefined {
  return models[modelName];
}

/**
 * Helper to get client options with API key
 */
export function getClientOptions(): { apiKey: string; vertexai?: boolean } {
  const config = googleLiveAPIProvider.config as GoogleLiveAPIConfig;
  return config.client;
}

