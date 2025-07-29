/**
 * @file Google Live API provider configuration.
 * @module modules/core/config/providers/google
 */

import { HarmBlockThreshold, HarmCategory } from '@google/genai';

/**
 * Safety setting configuration for Google models.
 */
interface SafetySetting {
  readonly category: HarmCategory;
  readonly threshold: HarmBlockThreshold;
}

/**
 * Generation configuration for Google models.
 */
interface GenerationConfig {
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
interface ToolConfig {
  readonly codeExecution: Record<string, never>;
}

/**
 * Model configuration for Google API.
 */
interface ModelConfiguration {
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
interface ModelConfigurations {
  readonly [key: string]: ModelConfiguration;
}

/**
 * Client configuration options for Google API.
 */
interface ClientOptions {
  readonly apiKey: string;
  readonly vertexai: boolean;
}

/**
 * Google Live API provider configuration.
 */
interface GoogleLiveAPIProvider {
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

/**
 * Default safety settings for all Google models.
 */
const defaultSafetySettings: readonly SafetySetting[] = [
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
 * Model configurations for different use cases.
 */
const modelConfigurations: ModelConfigurations = {
  default: {
    model: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    systemInstruction: 'You are a helpful AI assistant. Provide accurate, helpful, and concise responses to user queries.',
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      candidateCount: 1,
      stopSequences: [],
    },
    safetySettings: defaultSafetySettings,
  },
  coder: {
    model: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro (Coder)',
    systemInstruction: 'You are an expert software engineer. Provide clean, efficient, and well-documented code solutions. Follow best practices and explain your reasoning.',
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      candidateCount: 1,
      stopSequences: [],
    },
    safetySettings: defaultSafetySettings,
    tools: [{ codeExecution: {} }],
  },
  creative: {
    model: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash (Creative)',
    systemInstruction: 'You are a creative writing assistant. Help with creative content, storytelling, and imaginative tasks. Be expressive and engaging.',
    generationConfig: {
      temperature: 1.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      candidateCount: 1,
      stopSequences: [],
    },
    safetySettings: defaultSafetySettings,
  },
  analyst: {
    model: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro (Analyst)',
    systemInstruction: 'You are a data analyst. Provide structured analysis, insights, and recommendations based on data. Format responses as JSON when appropriate.',
    generationConfig: {
      temperature: 0.1,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      candidateCount: 1,
      stopSequences: [],
      responseMimeType: 'application/json',
    },
    safetySettings: defaultSafetySettings,
    tools: [{ codeExecution: {} }],
  },
};

/**
 * Get model configuration by name.
 * @param modelName - The name of the model configuration.
 * @returns Model configuration object or undefined if not found.
 */
export const getModelConfig = (modelName: string): ModelConfiguration | undefined => {
  if (typeof modelName !== 'string') {
    return undefined;
  }

  const config = modelConfigurations[modelName];
  if (!config) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(config)) as ModelConfiguration;
};

/**
 * Get client options for Google API.
 * @returns Client configuration options.
 */
export const getClientOptions = (): ClientOptions => {
  let apiKey = '';

  try {
    if (process?.env && typeof process.env === 'object' && process.env.GOOGLE_API_KEY) {
      apiKey = process.env.GOOGLE_API_KEY;
    }
  } catch {
    apiKey = '';
  }

  return {
    apiKey,
    vertexai: false,
  };
};

/**
 * Google Live API provider configuration.
 */
export const googleLiveAPIProvider: GoogleLiveAPIProvider = {
  name: 'google-liveapi',
  displayName: 'Google Live API (Gemini)',
  description: 'Access to Google\'s Gemini AI models through the Live API',
  enabled: true,
  version: '1.0.0',
  config: {
    defaultModel: 'default',
    models: modelConfigurations,
    client: getClientOptions(),
  },
};
