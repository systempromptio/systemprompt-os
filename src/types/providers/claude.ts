/**
 * @fileoverview Claude AI provider type definitions
 * @module types/providers/claude
 * @since 1.0.0
 */

import { z } from 'zod';
import type { Options } from '@anthropic-ai/claude-code';
import { ProviderMessage, ProviderResponse } from './base.js';

/**
 * Claude-specific configuration options
 * @interface
 * @extends {Partial<Options>}
 * @since 1.0.0
 */
export interface ClaudeConfig extends Partial<Options> {
  /**
   * Anthropic API key
   * @since 1.0.0
   */
  readonly apiKey?: string;
  
  /**
   * Model to use (e.g., 'claude-3-opus-20240229')
   * @since 1.0.0
   */
  readonly model?: string;
  
  /**
   * Maximum conversation turns
   * @since 1.0.0
   */
  readonly maxTurns?: number;
  
  /**
   * Sampling temperature (0-1)
   * @since 1.0.0
   */
  readonly temperature?: number;
  
  /**
   * System prompt for the conversation
   * @since 1.0.0
   */
  readonly systemPrompt?: string;
  
  /**
   * Working directory for file operations
   * @since 1.0.0
   */
  readonly workingDirectory?: string;
  
  /**
   * Allowed tool names
   * @since 1.0.0
   */
  readonly allowedTools?: string[];
  
  /**
   * Custom tool definitions
   * @since 1.0.0
   */
  readonly customTools?: Record<string, unknown>;
}

/**
 * Claude-specific response structure
 * @interface
 * @extends {ProviderResponse}
 * @since 1.0.0
 */
export interface ClaudeResponse extends ProviderResponse {
  /**
   * Model used for the response
   * @since 1.0.0
   */
  readonly model: string;
  
  /**
   * Reason the response stopped
   * @since 1.0.0
   */
  readonly stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  
  /**
   * Token usage statistics
   * @since 1.0.0
   */
  readonly usage?: {
    /**
     * Number of input tokens
     * @since 1.0.0
     */
    readonly inputTokens: number;
    
    /**
     * Number of output tokens
     * @since 1.0.0
     */
    readonly outputTokens: number;
  };
}

/**
 * Claude-specific message format
 * @interface
 * @extends {ProviderMessage}
 * @since 1.0.0
 */
export interface ClaudeMessage extends ProviderMessage {
  /**
   * Optional name for the message sender
   * @since 1.0.0
   */
  readonly name?: string;
  
  /**
   * Cache control for message reuse
   * @since 1.0.0
   */
  readonly cacheControl?: {
    /**
     * Cache type
     * @since 1.0.0
     */
    readonly type: 'ephemeral';
  };
}

/**
 * Claude tool/function definition
 * @interface
 * @since 1.0.0
 */
export interface ClaudeToolDefinition {
  /**
   * Tool name
   * @since 1.0.0
   */
  readonly name: string;
  
  /**
   * Tool description for the model
   * @since 1.0.0
   */
  readonly description: string;
  
  /**
   * JSON Schema for tool input
   * @since 1.0.0
   */
  readonly inputSchema: {
    /**
     * Schema type (always 'object' for tools)
     * @since 1.0.0
     */
    readonly type: 'object';
    
    /**
     * Property definitions
     * @since 1.0.0
     */
    readonly properties: Record<string, unknown>;
    
    /**
     * Required property names
     * @since 1.0.0
     */
    readonly required?: string[];
  };
}

/**
 * Streaming event from Claude API
 * @interface
 * @since 1.0.0
 */
export interface ClaudeStreamEvent {
  /**
   * Event type
   * @since 1.0.0
   */
  readonly type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'error';
  
  /**
   * Partial message data
   * @since 1.0.0
   */
  readonly message?: Partial<ClaudeResponse>;
  
  /**
   * Content delta for streaming
   * @since 1.0.0
   */
  readonly delta?: {
    /**
     * Delta type
     * @since 1.0.0
     */
    readonly type: 'text_delta' | 'input_json_delta';
    
    /**
     * Text content delta
     * @since 1.0.0
     */
    readonly text?: string;
    
    /**
     * Partial JSON for tool calls
     * @since 1.0.0
     */
    readonly partial_json?: string;
  };
  
  /**
   * Content block information
   * @since 1.0.0
   */
  readonly content_block?: {
    /**
     * Block type
     * @since 1.0.0
     */
    readonly type: 'text' | 'tool_use';
    
    /**
     * Block identifier
     * @since 1.0.0
     */
    readonly id?: string;
    
    /**
     * Tool name (for tool_use blocks)
     * @since 1.0.0
     */
    readonly name?: string;
    
    /**
     * Tool input (for tool_use blocks)
     * @since 1.0.0
     */
    readonly input?: unknown;
  };
  
  /**
   * Error information
   * @since 1.0.0
   */
  readonly error?: {
    /**
     * Error type
     * @since 1.0.0
     */
    readonly type: string;
    
    /**
     * Error message
     * @since 1.0.0
     */
    readonly message: string;
  };
}

/**
 * Zod schema for Claude configuration validation
 * @since 1.0.0
 */
export const ClaudeConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
  maxTurns: z.number().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
  systemPrompt: z.string().optional(),
  workingDirectory: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  customTools: z.record(z.unknown()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional()
});

/**
 * Zod schema for Claude response validation
 * @since 1.0.0
 */
export const ClaudeResponseSchema = z.object({
  content: z.string(),
  role: z.literal('assistant'),
  model: z.string(),
  stopReason: z.enum(['end_turn', 'max_tokens', 'stop_sequence', 'tool_use']).optional(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number()
  }).optional(),
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
 * Zod schema for Claude tool definition validation
 * @since 1.0.0
 */
export const ClaudeToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.unknown()),
    required: z.array(z.string()).optional()
  })
});

/**
 * Message format from Claude SDK
 * @interface
 * @since 1.0.0
 */
export interface SDKMessage {
  /**
   * Message type
   * @since 1.0.0
   */
  type: 'user' | 'assistant' | 'system';
  
  /**
   * Message content (text or structured)
   * @since 1.0.0
   */
  content: string | Array<{ type: 'text'; text: string }>;
  
  /**
   * Optional role identifier
   * @since 1.0.0
   */
  role?: string;
  
  /**
   * Optional sender name
   * @since 1.0.0
   */
  name?: string;
  
  /**
   * Tool call ID when responding to tools
   * @since 1.0.0
   */
  toolCallId?: string;
  
  /**
   * Tool calls made in this message
   * @since 1.0.0
   */
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * Assistant message from Claude SDK
 * @interface
 * @extends {SDKMessage}
 * @since 1.0.0
 */
export interface SDKAssistantMessage extends SDKMessage {
  /**
   * Message type (always 'assistant')
   * @since 1.0.0
   */
  type: 'assistant';
  
  /**
   * Model used for generation
   * @since 1.0.0
   */
  model?: string;
  
  /**
   * Reason generation stopped
   * @since 1.0.0
   */
  stopReason?: string;
  
  /**
   * Token usage statistics
   * @since 1.0.0
   */
  usage?: {
    /**
     * Input token count
     * @since 1.0.0
     */
    inputTokens: number;
    
    /**
     * Output token count
     * @since 1.0.0
     */
    outputTokens: number;
  };
}

/**
 * Adapter function to convert SDK messages to Claude format
 * @since 1.0.0
 */
export type ClaudeMessageAdapter = (message: SDKMessage) => ClaudeMessage;

/**
 * Adapter function to convert SDK responses to Claude format
 * @since 1.0.0
 */
export type ClaudeResponseAdapter = (message: SDKAssistantMessage) => ClaudeResponse;

/**
 * Claude provider capabilities
 * @interface
 * @since 1.0.0
 */
export interface ClaudeCapabilities {
  /**
   * Available Claude models
   * @since 1.0.0
   */
  readonly models: ClaudeModelInfo[];
  
  /**
   * Maximum context window in tokens
   * @since 1.0.0
   */
  readonly maxContextTokens: number;
  
  /**
   * Whether vision/image input is supported
   * @since 1.0.0
   */
  readonly supportsVision: boolean;
  
  /**
   * Whether tool/function calling is supported
   * @since 1.0.0
   */
  readonly supportsTools: boolean;
  
  /**
   * Whether message caching is supported
   * @since 1.0.0
   */
  readonly supportsCaching: boolean;
  
  /**
   * Whether streaming responses are supported
   * @since 1.0.0
   */
  readonly supportsStreaming: boolean;
}

/**
 * Information about a specific Claude model
 * @interface
 * @since 1.0.0
 */
export interface ClaudeModelInfo {
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
   * Context window size in tokens
   * @since 1.0.0
   */
  readonly contextWindow: number;
  
  /**
   * Maximum output tokens
   * @since 1.0.0
   */
  readonly maxOutputTokens: number;
  
  /**
   * Training data cutoff date
   * @since 1.0.0
   */
  readonly trainingCutoff: Date;
  
  /**
   * Whether this model supports function calling
   * @since 1.0.0
   */
  readonly supportsFunctionCalling: boolean;
  
  /**
   * Whether this model supports vision input
   * @since 1.0.0
   */
  readonly supportsVision: boolean;
  
  /**
   * Pricing information
   * @since 1.0.0
   */
  readonly pricing: {
    /**
     * Cost per 1000 input tokens in USD
     * @since 1.0.0
     */
    readonly inputCostPer1kTokens: number;
    
    /**
     * Cost per 1000 output tokens in USD
     * @since 1.0.0
     */
    readonly outputCostPer1kTokens: number;
  };
}