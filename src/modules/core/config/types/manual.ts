/**
 * Manual type definitions for config module.
 * JUSTIFICATION: These types are required for external integrations and CLI commands
 * that cannot be auto-generated from database schema or service interfaces.
 * - ConfigSource enum: External reference for configuration value sources
 * - Google types: External API integration types for Google GenAI provider
 * - Model types: CLI configuration interfaces for model management
 * - Provider types: Extension of base provider interface with typed config.
 * @file Manual types for config module - justified external integrations.
 * @module modules/core/config/types/manual
 */

import type { HarmBlockThreshold, HarmCategory } from '@google/genai';

/**
 * Configuration source enum indicating where configuration values originate.
 */
export enum ConfigSource {
  DEFAULT = 'default',
  FILE = 'file',
  ENVIRONMENT = 'environment',
  RUNTIME = 'runtime'
}

// Google types for external API integration
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

// Model types for CLI configuration
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

/**
 * MCP server configuration interface for CLI commands.
 */
export interface IMcpServerConfig {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    scope?: 'local' | 'project' | 'user';
    transport?: 'stdio' | 'sse' | 'http';
    description?: string;
    metadata?: unknown;
    oauthConfig?: unknown;
}

/**
 * Configuration value type for CLI and service operations.
 */
export type ConfigValue = string | number | boolean | null | object;

// Validation CLI types - basic structure definitions
export interface ISystemDefaults {
  environment?: string;
  port?: number;
  host?: string;
  logLevel?: string;
}

export interface IDefaultsConfig {
  system?: ISystemDefaults;
}

export interface IProvidersConfig {
  available: string[];
  enabled: string[];
  default?: string;
}

export interface IConfigStructure {
  defaults?: IDefaultsConfig;
  providers?: IProvidersConfig;
}

export interface IValidateCommandContext {
  file?: string;
}

// Service types
export interface IConfigEntry {
  key: string;
  value: unknown;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMcpServerEntry {
  id: number;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  scope: string;
  transport: string;
  status: string;
  description: string | null;
  metadata?: unknown;
  oauthConfig?: unknown;
  createdAt: Date;
  updatedAt: Date;
  lastStartedAt: Date | null;
  lastError: string | null;
}

export interface IConfigService {
  get(key?: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<IConfigEntry[]>;
  validate(): Promise<unknown>;
  addMcpServer(config: IMcpServerConfig): Promise<void>;
  deleteMcpServer(name: string): Promise<void>;
  getMcpServer(name: string): Promise<IMcpServerEntry | null>;
  listMcpServers(): Promise<IMcpServerEntry[]>;
  updateMcpServerStatus(name: string, status: string, error?: string): Promise<void>;
}

// CLI Command types - required for CLI commands that cannot be auto-generated
/**
 * Extended provider interface with version and typed config.
 */
export interface IProviderWithVersion {
  name: string;
  displayName: string;
  enabled: boolean;
  version: string;
  description: string;
  config?: IProviderConfig;
}

/**
 * Command options interface for provider commands.
 */
export interface ICommandOptions {
  enabled?: boolean;
  name?: string;
  models?: boolean;
}

/**
 * Options for the list command.
 */
export interface IListCommandOptions {
  format?: 'tree' | 'json' | 'yaml';
}

/**
 * MCP server display interface for formatting in CLI.
 */
export interface McpServerDisplay {
  name: string;
  command: string;
  scope: string;
  transport: string;
  status: string;
  description?: string;
  args?: string[];
  env?: Record<string, string>;
  lastError?: string;
  createdAt?: string;
  updatedAt?: string;
}
