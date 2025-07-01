/**
 * @fileoverview Base AI provider interfaces and abstract classes
 * @module types/providers/base
 * @since 1.0.0
 */

import { z } from 'zod';
import { IAgent, AgentInitOptions } from '../core/agent.js';

/**
 * Interface for AI provider implementations
 * @interface
 * @template TConfig - Provider-specific configuration type
 * @template TResponse - Provider-specific response type
 * @since 1.0.0
 */
export interface IAgentProvider<TConfig = unknown, TResponse = unknown> {
  /**
   * Provider name (e.g., 'claude', 'gemini')
   * @since 1.0.0
   */
  readonly name: string;
  
  /**
   * Provider version
   * @since 1.0.0
   */
  readonly version: string;
  
  /**
   * Creates a new agent instance
   * @param {AgentInitOptions<TConfig>} options - Initialization options
   * @returns {Promise<IAgent<TConfig, TResponse>>} Initialized agent
   * @since 1.0.0
   */
  createAgent(options: AgentInitOptions<TConfig>): Promise<IAgent<TConfig, TResponse>>;
  
  /**
   * Validates provider configuration
   * @param {unknown} config - Configuration to validate
   * @returns {config is TConfig} True if configuration is valid
   * @since 1.0.0
   */
  validateConfig(config: unknown): config is TConfig;
  
  /**
   * Gets the Zod schema for configuration validation
   * @returns {z.ZodSchema<TConfig>} Configuration schema
   * @since 1.0.0
   */
  getConfigSchema(): z.ZodSchema<TConfig>;
}

/**
 * Standard provider response structure
 * @interface
 * @since 1.0.0
 */
export interface ProviderResponse {
  /**
   * Response content text
   * @since 1.0.0
   */
  readonly content: string;
  
  /**
   * Response role
   * @since 1.0.0
   */
  readonly role: 'assistant' | 'system';
  
  /**
   * Tool/function calls in the response
   * @since 1.0.0
   */
  readonly toolCalls?: ProviderToolCall[];
  
  /**
   * Additional provider-specific metadata
   * @since 1.0.0
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tool/function call from provider
 * @interface
 * @since 1.0.0
 */
export interface ProviderToolCall {
  /**
   * Unique tool call identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * Tool call type (currently only 'function')
   * @since 1.0.0
   */
  readonly type: 'function';
  
  /**
   * Function call details
   * @since 1.0.0
   */
  readonly function: {
    /**
     * Function name to call
     * @since 1.0.0
     */
    readonly name: string;
    
    /**
     * JSON-encoded function arguments
     * @since 1.0.0
     */
    readonly arguments: string;
  };
}

/**
 * Message format for provider communication
 * @interface
 * @since 1.0.0
 */
export interface ProviderMessage {
  /**
   * Message role
   * @since 1.0.0
   */
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  
  /**
   * Message content
   * @since 1.0.0
   */
  readonly content: string;
  
  /**
   * ID when responding to a tool call
   * @since 1.0.0
   */
  readonly toolCallId?: string;
  
  /**
   * Tool calls made in this message
   * @since 1.0.0
   */
  readonly toolCalls?: ProviderToolCall[];
}

/**
 * Streaming response chunk from provider
 * @interface
 * @since 1.0.0
 */
export interface ProviderStreamingResponse {
  /**
   * Content delta for this chunk
   * @since 1.0.0
   */
  readonly delta: string;
  
  /**
   * Whether the stream is finished
   * @since 1.0.0
   */
  readonly finished: boolean;
  
  /**
   * Partial tool call being streamed
   * @since 1.0.0
   */
  readonly toolCall?: Partial<ProviderToolCall>;
}

/**
 * Provider capabilities and limits
 * @interface
 * @since 1.0.0
 */
export interface ProviderCapabilities {
  /**
   * Available models
   * @since 1.0.0
   */
  readonly models: ModelInfo[];
  
  /**
   * Supported features
   * @since 1.0.0
   */
  readonly features: FeatureInfo[];
  
  /**
   * Rate and usage limits
   * @since 1.0.0
   */
  readonly limits: ProviderLimits;
}

/**
 * Information about a provider's model
 * @interface
 * @since 1.0.0
 */
export interface ModelInfo {
  /**
   * Model identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * Human-readable model name
   * @since 1.0.0
   */
  readonly name: string;
  
  /**
   * Maximum context window size in tokens
   * @since 1.0.0
   */
  readonly contextWindow: number;
  
  /**
   * Training data cutoff date
   * @since 1.0.0
   */
  readonly trainingCutoff?: Date;
  
  /**
   * Model capabilities (e.g., 'code', 'math', 'vision')
   * @since 1.0.0
   */
  readonly capabilities: string[];
}

/**
 * Information about a provider feature
 * @interface
 * @since 1.0.0
 */
export interface FeatureInfo {
  /**
   * Feature identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * Feature name
   * @since 1.0.0
   */
  readonly name: string;
  
  /**
   * Feature description
   * @since 1.0.0
   */
  readonly description: string;
  
  /**
   * Whether the feature is currently available
   * @since 1.0.0
   */
  readonly available: boolean;
}

/**
 * Provider rate and usage limits
 * @interface
 * @since 1.0.0
 */
export interface ProviderLimits {
  /**
   * Maximum tokens per request
   * @since 1.0.0
   */
  readonly maxTokensPerRequest: number;
  
  /**
   * Maximum requests per minute
   * @since 1.0.0
   */
  readonly maxRequestsPerMinute: number;
  
  /**
   * Maximum requests per day
   * @since 1.0.0
   */
  readonly maxRequestsPerDay: number;
  
  /**
   * Maximum concurrent requests
   * @since 1.0.0
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
 * @since 1.0.0
 */
export abstract class BaseAgentProvider<TConfig = unknown, TResponse = unknown> 
  implements IAgentProvider<TConfig, TResponse> {
  
  /**
   * Provider name
   * @abstract
   * @since 1.0.0
   */
  abstract readonly name: string;
  
  /**
   * Provider version
   * @abstract
   * @since 1.0.0
   */
  abstract readonly version: string;
  
  /**
   * Creates a new agent instance
   * @abstract
   * @param {AgentInitOptions<TConfig>} options - Initialization options
   * @returns {Promise<IAgent<TConfig, TResponse>>} Initialized agent
   * @since 1.0.0
   */
  abstract createAgent(options: AgentInitOptions<TConfig>): Promise<IAgent<TConfig, TResponse>>;
  
  /**
   * Validates provider configuration
   * @abstract
   * @param {unknown} config - Configuration to validate
   * @returns {config is TConfig} True if configuration is valid
   * @since 1.0.0
   */
  abstract validateConfig(config: unknown): config is TConfig;
  
  /**
   * Gets the Zod schema for configuration validation
   * @abstract
   * @returns {z.ZodSchema<TConfig>} Configuration schema
   * @since 1.0.0
   */
  abstract getConfigSchema(): z.ZodSchema<TConfig>;
  
  /**
   * Gets provider capabilities
   * @abstract
   * @protected
   * @returns {ProviderCapabilities} Provider capabilities
   * @since 1.0.0
   */
  protected abstract getCapabilities(): ProviderCapabilities;
}

/**
 * Zod schema for provider response validation
 * @since 1.0.0
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
 * @since 1.0.0
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