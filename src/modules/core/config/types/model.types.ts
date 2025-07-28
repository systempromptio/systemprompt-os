import type { HarmBlockThreshold, HarmCategory } from '@google/genai';

/**
 * Tool configuration interface.
 */
export interface ITool {
    codeExecution?: boolean;
}

/**
 * Safety setting configuration interface.
 */
export interface ISafetySetting {
    category: HarmCategory;
    threshold: HarmBlockThreshold;
}

/**
 * Generation configuration interface.
 */
export interface IGenerationConfig {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
    responseMimeType?: string;
    stopSequences?: string[];
}

/**
 * Model configuration interface.
 */
export interface IModelConfig {
    model: string;
    displayName: string;
    description?: string;
    generationConfig?: IGenerationConfig;
    tools?: ITool[];
    safetySettings?: ISafetySetting[];
    systemInstruction?: string;
}

/**
 * Provider configuration interface.
 */
export interface IProviderConfig {
    models?: Record<string, IModelConfig>;
    defaultModel?: string;
    client?: {
        apiKey?: string;
  };
}

/**
 * Provider interface.
 */
export interface IProvider {
    name: string;
    displayName: string;
    enabled: boolean;
    config?: IProviderConfig;
}

/**
 * Model command options interface.
 */
export interface IModelCommandOptions {
    provider?: string;
    model?: string;
    prompt?: string;
}

/**
 * Google Generative AI model parameters interface.
 */
export interface IModelParams {
    model: string;
    generationConfig?: IGenerationConfig;
    safetySettings?: ISafetySetting[];
    systemInstruction?: string;
    tools?: ITool[];
}
