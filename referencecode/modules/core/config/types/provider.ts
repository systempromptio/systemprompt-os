/**
 * @fileoverview Provider configuration type definitions
 * @module modules/core/config/types/provider
 */

import type {
  GenerationConfig,
  SafetySetting,
} from '@google/genai';

/**
 * Base provider configuration interface
 */
export interface ProviderConfig {
  /** Provider name */
  name: string;

  /** Provider display name */
  displayName: string;

  /** Provider description */
  description: string;

  /** Whether provider is enabled */
  enabled: boolean;

  /** Provider version */
  version: string;

  /** Provider-specific configuration */
  config: GoogleLiveAPIConfig | Record<string, unknown>;
}

/**
 * Google Live API provider configuration
 */
export interface GoogleLiveAPIConfig {
  /** Google GenAI client options */
  client: {
    apiKey: string;
    vertexai?: boolean;
  };

  /** Available models for this provider */
  models: Record<string, ModelConfig>;

  /** Default model to use */
  defaultModel: string;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  /** Model identifier */
  model: string;

  /** Model display name */
  displayName: string;

  /** Model description */
  description: string;

  /** Generation configuration */
  generationConfig: GenerationConfig;

  /** Safety settings */
  safetySettings: SafetySetting[];

  /** System instruction */
  systemInstruction?: string;

  /** Available tools for this model */
  tools?: Array<{
    functionDeclarations?: any[];
    codeExecution?: any;
  }>;
}

/**
 * Provider registry configuration
 */
export interface ProviderRegistry {
  /** List of available providers */
  availableProviders: string[];

  /** List of enabled providers */
  enabledProviders: string[];

  /** Default provider */
  defaultProvider: string;
}