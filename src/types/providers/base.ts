/**
 * @fileoverview Base AI provider interfaces and abstract classes
 * @module types/providers/base
 */

import { z } from 'zod';
import { IAgent, AgentInitOptions } from '../core/agent.js';

/**
 * Interface for AI provider implementations
 * @interface
 * @template TConfig - Provider-specific configuration type
 * @template TResponse - Provider-specific response type
 */
export interface IAgentProvider<TConfig = unknown, TResponse = unknown> {
  /**
   * Provider name (e.g., 'claude', 'gemini')
   */
  readonly name: string;
  
  /**
   * Provider version
   */
  readonly version: string;
  
  /**
   * Creates a new agent instance
   * @param {AgentInitOptions<TConfig>} options - Initialization options
   * @returns {Promise<IAgent<TConfig, TResponse>>} Initialized agent
   */
  createAgent(options: AgentInitOptions<TConfig>): Promise<IAgent<TConfig, TResponse>>;
  
  /**
   * Validates provider configuration
   * @param {unknown} config - Configuration to validate
   * @returns {config is TConfig} True if configuration is valid
   */
  validateConfig(config: unknown): config is TConfig;
  
  /**
   * Gets the Zod schema for configuration validation
   * @returns {z.ZodSchema<TConfig>} Configuration schema
   */
  getConfigSchema(): z.ZodSchema<TConfig>;
}

/**
 * Standard provider response structure
 * @interface
 */
export interface ProviderResponse {
  /**
   * Response content text
   */
  readonly content: string;
  
  /**
   * Response role
   */
  readonly role: 'assistant' | 'system';
  
  /**
   * Tool/function calls in the response
   */
  readonly toolCalls?: ProviderToolCall[];
  
  /**
   * Additional provider-specific metadata
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tool/function call from provider
 * @interface
 */
export interface ProviderToolCall {
  /**
   * Unique tool call identifier
   */
  readonly id: string;
  
  /**
   * Tool call type (currently only 'function')
   */
  readonly type: 'function';
  
  /**
   * Function call details
   */
  readonly function: {
    /**
     * Function name to call
     */
    readonly name: string;
    
    /**
     * JSON-encoded function arguments
     */
    readonly arguments: string;
  };
}

/**
 * Message format for provider communication
 * @interface
 */
export interface ProviderMessage {
  /**
   * Message role
   */
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  
  /**
   * Message content
   */
  readonly content: string;
  
  /**
   * ID when responding to a tool call
   */
  readonly toolCallId?: string;
  
  /**
   * Tool calls made in this message
   */
  readonly toolCalls?: ProviderToolCall[];
}

/**
 * Streaming response chunk from provider
 * @interface
 */
export interface ProviderStreamingResponse {
  /**
   * Content delta for this chunk
   */
  readonly delta: string;
  
  /**
   * Whether the stream is finished
   */
  readonly finished: boolean;
  
  /**
   * Partial tool call being streamed
   */
  readonly toolCall?: Partial<ProviderToolCall>;
}

/**
 * Provider capabilities and limits
 * @interface
 */
export interface ProviderCapabilities {
  /**
   * Available models
   */
  readonly models: ModelInfo[];
  
  /**
   * Supported features
   */
  readonly features: FeatureInfo[];
  
  /**
   * Rate and usage limits
   */
  readonly limits: ProviderLimits;
}

/**
 * Information about a provider's model
 * @interface
 */
export interface ModelInfo {
  /**
   * Model identifier
   */
  readonly id: string;
  
  /**
   * Human-readable model name
   */
  readonly name: string;
  
  /**
   * Maximum context window size in tokens
   */
  readonly contextWindow: number;
  
  /**
   * Training data cutoff date
   */
  readonly trainingCutoff?: Date;
  
  /**
   * Model capabilities (e.g., 'code', 'math', 'vision')
   */
  readonly capabilities: string[];
}

/**
 * Information about a provider feature
 * @interface
 */
export interface FeatureInfo {
  /**
   * Feature identifier
   */
  readonly id: string;
  
  /**
   * Feature name
   */
  readonly name: string;
  
  /**
   * Feature description
   */
  readonly description: string;
  
  /**
   * Whether the feature is currently available
   */
  readonly available: boolean;
}

/**
 * Provider rate and usage limits
 * @interface
 */
export interface ProviderLimits {
  /**
   * Maximum tokens per request
   */
  readonly maxTokensPerRequest: number;
  
  /**
   * Maximum requests per minute
   */
  readonly maxRequestsPerMinute: number;
  
  /**
   * Maximum requests per day
   */
  readonly maxRequestsPerDay: number;
  
  /**
   * Maximum concurrent requests
   */
  readonly maxConcurrentRequests: number;
}

/**
 * Base class for AI provider implementations
 * @abstract
 * @class
 * @template TConfig - Provider-specific configuration type
 * @template TResponse - Provider-specific response type
 * @implements {IAgentProvider<TConfig, TResponse>}
 */
export abstract class BaseAgentProvider<TConfig = unknown, TResponse = unknown> 
  implements IAgentProvider<TConfig, TResponse> {
  
  /**
   * Provider name
   * @abstract
   */
  abstract readonly name: string;
  
  /**
   * Provider version
   * @abstract
   */
  abstract readonly version: string;
  
  /**
   * Creates a new agent instance
   * @abstract
   * @param {AgentInitOptions<TConfig>} options - Initialization options
   * @returns {Promise<IAgent<TConfig, TResponse>>} Initialized agent
   */
  abstract createAgent(options: AgentInitOptions<TConfig>): Promise<IAgent<TConfig, TResponse>>;
  
  /**
   * Validates provider configuration
   * @abstract
   * @param {unknown} config - Configuration to validate
   * @returns {config is TConfig} True if configuration is valid
   */
  abstract validateConfig(config: unknown): config is TConfig;
  
  /**
   * Gets the Zod schema for configuration validation
   * @abstract
   * @returns {z.ZodSchema<TConfig>} Configuration schema
   */
  abstract getConfigSchema(): z.ZodSchema<TConfig>;
  
  /**
   * Gets provider capabilities
   * @abstract
   * @protected
   * @returns {ProviderCapabilities} Provider capabilities
   */
  protected abstract getCapabilities(): ProviderCapabilities;
}

/**
 * Zod schema for provider response validation
 */
export const ProviderResponseSchema = z.object({
  content: z.string(),
  role: z.enum(['assistant', 'system']),
  toolCalls: z.array(z.object({
    id: z.string(),
    type: z.literal('function'),
    function: z.object({
      name: z.string(),
      arguments: z.string()
    })
  })).optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Zod schema for provider message validation
 */
export const ProviderMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  toolCallId: z.string().optional(),
  toolCalls: z.array(z.object({
    id: z.string(),
    type: z.literal('function'),
    function: z.object({
      name: z.string(),
      arguments: z.string()
    })
  })).optional()
});