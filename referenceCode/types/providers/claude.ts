/**
 * @fileoverview Claude AI provider type definitions
 * @module types/providers/claude
 */

import { z } from 'zod';
import type { Options } from '@anthropic-ai/claude-code';
import { ProviderMessage, ProviderResponse } from './base.js';

/**
 * Claude-specific configuration options
 * @interface
 * @extends {Partial<Options>}
 */
export interface ClaudeConfig extends Partial<Options> {
  /**
   * Anthropic API key
   */
  readonly apiKey?: string;
  
  /**
   * Model to use (e.g., 'claude-3-opus-20240229')
   */
  readonly model?: string;
  
  /**
   * Maximum conversation turns
   */
  readonly maxTurns?: number;
  
  /**
   * Sampling temperature (0-1)
   */
  readonly temperature?: number;
  
  /**
   * System prompt for the conversation
   */
  readonly systemPrompt?: string;
  
  /**
   * Working directory for file operations
   */
  readonly workingDirectory?: string;
  
  /**
   * Allowed tool names
   */
  readonly allowedTools?: string[];
  
  /**
   * Custom tool definitions
   */
  readonly customTools?: Record<string, unknown>;
}

/**
 * Claude-specific response structure
 * @interface
 * @extends {ProviderResponse}
 */
export interface ClaudeResponse extends ProviderResponse {
  /**
   * Model used for the response
   */
  readonly model: string;
  
  /**
   * Reason the response stopped
   */
  readonly stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  
  /**
   * Token usage statistics
   */
  readonly usage?: {
    /**
     * Number of input tokens
     */
    readonly inputTokens: number;
    
    /**
     * Number of output tokens
     */
    readonly outputTokens: number;
  };
}

/**
 * Claude-specific message format
 * @interface
 * @extends {ProviderMessage}
 */
export interface ClaudeMessage extends ProviderMessage {
  /**
   * Optional name for the message sender
   */
  readonly name?: string;
  
  /**
   * Cache control for message reuse
   */
  readonly cacheControl?: {
    /**
     * Cache type
     */
    readonly type: 'ephemeral';
  };
}

/**
 * Claude tool/function definition
 * @interface
 */
export interface ClaudeToolDefinition {
  /**
   * Tool name
   */
  readonly name: string;
  
  /**
   * Tool description for the model
   */
  readonly description: string;
  
  /**
   * JSON Schema for tool input
   */
  readonly inputSchema: {
    /**
     * Schema type (always 'object' for tools)
     */
    readonly type: 'object';
    
    /**
     * Property definitions
     */
    readonly properties: Record<string, unknown>;
    
    /**
     * Required property names
     */
    readonly required?: string[];
  };
}

/**
 * Streaming event from Claude API
 * @interface
 */
export interface ClaudeStreamEvent {
  /**
   * Event type
   */
  readonly type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'error';
  
  /**
   * Partial message data
   */
  readonly message?: Partial<ClaudeResponse>;
  
  /**
   * Content delta for streaming
   */
  readonly delta?: {
    /**
     * Delta type
     */
    readonly type: 'text_delta' | 'input_json_delta';
    
    /**
     * Text content delta
     */
    readonly text?: string;
    
    /**
     * Partial JSON for tool calls
     */
    readonly partial_json?: string;
  };
  
  /**
   * Content block information
   */
  readonly content_block?: {
    /**
     * Block type
     */
    readonly type: 'text' | 'tool_use';
    
    /**
     * Block identifier
     */
    readonly id?: string;
    
    /**
     * Tool name (for tool_use blocks)
     */
    readonly name?: string;
    
    /**
     * Tool input (for tool_use blocks)
     */
    readonly input?: unknown;
  };
  
  /**
   * Error information
   */
  readonly error?: {
    /**
     * Error type
     */
    readonly type: string;
    
    /**
     * Error message
     */
    readonly message: string;
  };
}

/**
 * Zod schema for Claude configuration validation
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
 */
export interface SDKMessage {
  /**
   * Message type
   */
  type: 'user' | 'assistant' | 'system';
  
  /**
   * Message content (text or structured)
   */
  content: string | Array<{ type: 'text'; text: string }>;
  
  /**
   * Optional role identifier
   */
  role?: string;
  
  /**
   * Optional sender name
   */
  name?: string;
  
  /**
   * Tool call ID when responding to tools
   */
  toolCallId?: string;
  
  /**
   * Tool calls made in this message
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
 */
export interface SDKAssistantMessage extends SDKMessage {
  /**
   * Message type (always 'assistant')
   */
  type: 'assistant';
  
  /**
   * Model used for generation
   */
  model?: string;
  
  /**
   * Reason generation stopped
   */
  stopReason?: string;
  
  /**
   * Token usage statistics
   */
  usage?: {
    /**
     * Input token count
     */
    inputTokens: number;
    
    /**
     * Output token count
     */
    outputTokens: number;
  };
}

/**
 * Adapter function to convert SDK messages to Claude format
 */
export type ClaudeMessageAdapter = (message: SDKMessage) => ClaudeMessage;

/**
 * Adapter function to convert SDK responses to Claude format
 */
export type ClaudeResponseAdapter = (message: SDKAssistantMessage) => ClaudeResponse;

/**
 * Claude provider capabilities
 * @interface
 */
export interface ClaudeCapabilities {
  /**
   * Available Claude models
   */
  readonly models: ClaudeModelInfo[];
  
  /**
   * Maximum context window in tokens
   */
  readonly maxContextTokens: number;
  
  /**
   * Whether vision/image input is supported
   */
  readonly supportsVision: boolean;
  
  /**
   * Whether tool/function calling is supported
   */
  readonly supportsTools: boolean;
  
  /**
   * Whether message caching is supported
   */
  readonly supportsCaching: boolean;
  
  /**
   * Whether streaming responses are supported
   */
  readonly supportsStreaming: boolean;
}

/**
 * Information about a specific Claude model
 * @interface
 */
export interface ClaudeModelInfo {
  /**
   * Model identifier
   */
  readonly id: string;
  
  /**
   * Human-readable model name
   */
  readonly name: string;
  
  /**
   * Context window size in tokens
   */
  readonly contextWindow: number;
  
  /**
   * Maximum output tokens
   */
  readonly maxOutputTokens: number;
  
  /**
   * Training data cutoff date
   */
  readonly trainingCutoff: Date;
  
  /**
   * Whether this model supports function calling
   */
  readonly supportsFunctionCalling: boolean;
  
  /**
   * Whether this model supports vision input
   */
  readonly supportsVision: boolean;
  
  /**
   * Pricing information
   */
  readonly pricing: {
    /**
     * Cost per 1000 input tokens in USD
     */
    readonly inputCostPer1kTokens: number;
    
    /**
     * Cost per 1000 output tokens in USD
     */
    readonly outputCostPer1kTokens: number;
  };
}