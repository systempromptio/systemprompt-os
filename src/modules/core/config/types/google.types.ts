/**
 * @file Google provider type definitions.
 * @module modules/core/config/types/google
 */

import type { HarmBlockThreshold, HarmCategory } from '@google/genai';

/**
 * Safety setting configuration for Google models.
 */
export interface SafetySetting {
  readonly category: HarmCategory;
  readonly threshold: HarmBlockThreshold;
}

/**
 * Generation configuration for Google models.
 */
export interface GenerationConfig {
  readonly temperature: number;
  readonly topK: number;
  readonly topP: number;
  readonly maxOutputTokens: number;
  readonly candidateCount: number;
  readonly stopSequences: readonly string[];
  readonly responseMimeType?: string;
}

/**
 * Tool configuration for Google models.
 */
export interface ToolConfig {
  readonly codeExecution: Record<string, never>;
}

/**
 * Model configuration for Google API.
 */
export interface ModelConfiguration {
  readonly model: string;
  readonly displayName: string;
  readonly systemInstruction: string;
  readonly generationConfig: GenerationConfig;
  readonly safetySettings: readonly SafetySetting[];
  readonly tools?: readonly ToolConfig[];
}

/**
 * Collection of model configurations by name.
 */
export interface ModelConfigurations {
  readonly [key: string]: ModelConfiguration;
}

/**
 * Client configuration options for Google API.
 */
export interface ClientOptions {
  readonly apiKey: string;
  readonly vertexai: boolean;
}

/**
 * Google Live API provider configuration.
 */
export interface GoogleLiveAPIProvider {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly version: string;
  readonly config: {
    readonly defaultModel: string;
    readonly models: ModelConfigurations;
    readonly client: ClientOptions;
  };
}
