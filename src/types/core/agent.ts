/**
 * @fileoverview Core agent type definitions for AI agent abstraction
 * @module types/core/agent
 * @since 1.0.0
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

/**
 * Supported AI agent providers
 * @since 1.0.0
 */
export type AgentProvider = 'claude' | 'gemini' | 'custom';

/**
 * Represents the current operational status of an AI agent
 * @since 1.0.0
 */
export type AgentStatus = 'idle' | 'initializing' | 'ready' | 'processing' | 'error' | 'terminated';

/**
 * Branded type for agent identifiers to ensure type safety
 * @since 1.0.0
 */
export type AgentId = string & { readonly __brand: 'AgentId' };

/**
 * Creates a type-safe agent identifier
 * @param {string} id - The raw agent ID string
 * @returns {AgentId} A branded agent ID
 * @since 1.0.0
 * @example
 * ```typescript
 * const agentId = createAgentId('agent_123');
 * ```
 */
export const createAgentId = (id: string): AgentId => id as AgentId;

/**
 * Defines the capabilities supported by an AI agent
 * @interface
 * @since 1.0.0
 */
export interface AgentCapabilities {
  /**
   * Whether the agent supports streaming responses
   * @since 1.0.0
   */
  readonly supportsStreaming: boolean;
  
  /**
   * Whether the agent supports tool/function calling
   * @since 1.0.0
   */
  readonly supportsTools: boolean;
  
  /**
   * Whether the agent supports multimodal inputs (images, etc.)
   * @since 1.0.0
   */
  readonly supportsMultimodal: boolean;
  
  /**
   * Maximum context length in tokens
   * @since 1.0.0
   */
  readonly maxContextLength: number;
  
  /**
   * List of supported file types for multimodal inputs
   * @since 1.0.0
   */
  readonly supportedFileTypes: readonly string[];
}

/**
 * Metadata about an AI agent instance
 * @interface
 * @since 1.0.0
 */
export interface AgentMetadata {
  /**
   * The AI provider for this agent
   * @since 1.0.0
   */
  readonly provider: AgentProvider;
  
  /**
   * Specific model identifier (e.g., 'claude-3-opus')
   * @since 1.0.0
   */
  readonly model?: string;
  
  /**
   * Version of the agent implementation
   * @since 1.0.0
   */
  readonly version?: string;
  
  /**
   * Capabilities supported by this agent
   * @since 1.0.0
   */
  readonly capabilities: AgentCapabilities;
}

/**
 * Options for initializing an AI agent
 * @interface
 * @template TConfig - Type of provider-specific configuration
 * @since 1.0.0
 */
export interface AgentInitOptions<TConfig = unknown> {
  /**
   * Optional agent ID (auto-generated if not provided)
   * @since 1.0.0
   */
  readonly id?: AgentId;
  
  /**
   * Working directory for the agent's operations
   * @since 1.0.0
   */
  readonly workingDirectory?: string;
  
  /**
   * Environment variables for the agent process
   * @since 1.0.0
   */
  readonly environment?: Record<string, string>;
  
  /**
   * Provider-specific configuration
   * @since 1.0.0
   */
  readonly config: TConfig;
  
  /**
   * Additional metadata for the agent
   * @since 1.0.0
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Context for executing a query against an AI agent
 * @interface
 * @since 1.0.0
 */
export interface QueryContext {
  /**
   * Unique session identifier for this query
   * @since 1.0.0
   */
  readonly sessionId: string;
  
  /**
   * Parent task ID for hierarchical task tracking
   * @since 1.0.0
   */
  readonly parentTaskId?: string;
  
  /**
   * Whether to enable tool/function calling for this query
   * @default true
   * @since 1.0.0
   */
  readonly toolsEnabled?: boolean;
  
  /**
   * Whether to stream the response
   * @default false
   * @since 1.0.0
   */
  readonly streamResponse?: boolean;
  
  /**
   * Query timeout in milliseconds
   * @since 1.0.0
   */
  readonly timeout?: number;
  
  /**
   * Additional metadata for the query
   * @since 1.0.0
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Result of an AI agent query
 * @interface
 * @template TResponse - Type of the response data
 * @since 1.0.0
 */
export interface QueryResult<TResponse = unknown> {
  /**
   * Whether the query executed successfully
   * @since 1.0.0
   */
  readonly success: boolean;
  
  /**
   * The response data (present if success is true)
   * @since 1.0.0
   */
  readonly response?: TResponse;
  
  /**
   * Error details (present if success is false)
   * @since 1.0.0
   */
  readonly error?: AgentError;
  
  /**
   * Query execution duration in milliseconds
   * @since 1.0.0
   */
  readonly duration: number;
  
  /**
   * Token usage statistics for this query
   * @since 1.0.0
   */
  readonly tokensUsed?: TokenUsage;
}

/**
 * Token usage statistics for an AI query
 * @interface
 * @since 1.0.0
 */
export interface TokenUsage {
  /**
   * Number of input tokens consumed
   * @since 1.0.0
   */
  readonly input: number;
  
  /**
   * Number of output tokens generated
   * @since 1.0.0
   */
  readonly output: number;
  
  /**
   * Total tokens used (input + output)
   * @since 1.0.0
   */
  readonly total: number;
}

/**
 * Structured error information from an AI agent
 * @interface
 * @since 1.0.0
 */
export interface AgentError {
  /**
   * Categorized error code
   * @since 1.0.0
   */
  readonly code: AgentErrorCode;
  
  /**
   * Human-readable error message
   * @since 1.0.0
   */
  readonly message: string;
  
  /**
   * Additional error details or context
   * @since 1.0.0
   */
  readonly details?: unknown;
  
  /**
   * Whether this error can be retried
   * @since 1.0.0
   */
  readonly retryable: boolean;
}

/**
 * Enumeration of possible agent error codes
 * @enum {string}
 * @readonly
 * @since 1.0.0
 */
export enum AgentErrorCode {
  /** Agent initialization failed */
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  /** Query execution failed */
  QUERY_FAILED = 'QUERY_FAILED',
  /** Operation timed out */
  TIMEOUT = 'TIMEOUT',
  /** Rate limit exceeded */
  RATE_LIMIT = 'RATE_LIMIT',
  /** Invalid configuration provided */
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  /** Network communication error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Authentication/authorization failed */
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  /** Unknown or unclassified error */
  UNKNOWN = 'UNKNOWN'
}

/**
 * Core interface that all AI agents must implement
 * @interface
 * @extends {EventEmitter}
 * @template TConfig - Type of provider-specific configuration
 * @template TResponse - Type of query response data
 * @fires IAgent#status:changed
 * @fires IAgent#query:start
 * @fires IAgent#query:complete
 * @fires IAgent#error
 * @fires IAgent#initialized
 * @fires IAgent#terminated
 * @since 1.0.0
 */
export interface IAgent<TConfig = unknown, TResponse = unknown> extends EventEmitter {
  /**
   * Unique identifier for this agent instance
   * @since 1.0.0
   */
  readonly id: AgentId;
  
  /**
   * Current operational status
   * @since 1.0.0
   */
  readonly status: AgentStatus;
  
  /**
   * Agent metadata and capabilities
   * @since 1.0.0
   */
  readonly metadata: AgentMetadata;
  
  /**
   * Initializes the agent with the provided options
   * @param {AgentInitOptions<TConfig>} options - Initialization options
   * @returns {Promise<void>} Resolves when initialization is complete
   * @throws {AgentError} If initialization fails
   * @fires IAgent#initialized
   * @since 1.0.0
   */
  initialize(options: AgentInitOptions<TConfig>): Promise<void>;
  
  /**
   * Executes a query against the AI agent
   * @param {string} prompt - The query prompt
   * @param {QueryContext} [context] - Optional query context
   * @returns {Promise<QueryResult<TResponse>>} The query result
   * @throws {AgentError} If query execution fails
   * @fires IAgent#query:start
   * @fires IAgent#query:complete
   * @since 1.0.0
   */
  query(prompt: string, context?: QueryContext): Promise<QueryResult<TResponse>>;
  
  /**
   * Gracefully terminates the agent
   * @returns {Promise<void>} Resolves when termination is complete
   * @fires IAgent#terminated
   * @since 1.0.0
   */
  terminate(): Promise<void>;
  
  /**
   * Gets the current agent status
   * @returns {AgentStatus} Current status
   * @since 1.0.0
   */
  getStatus(): AgentStatus;
  
  /**
   * Gets the agent metadata
   * @returns {AgentMetadata} Agent metadata
   * @since 1.0.0
   */
  getMetadata(): AgentMetadata;
  
  /**
   * Checks if the agent is ready to accept queries
   * @returns {boolean} True if agent is ready
   * @since 1.0.0
   */
  isReady(): boolean;
}

/**
 * Zod schema for validating agent status
 * @since 1.0.0
 */
export const AgentStatusSchema = z.enum(['idle', 'initializing', 'ready', 'processing', 'error', 'terminated']);

/**
 * Zod schema for validating agent provider
 * @since 1.0.0
 */
export const AgentProviderSchema = z.enum(['claude', 'gemini', 'custom']);

/**
 * Zod schema for validating agent capabilities
 * @since 1.0.0
 */
export const AgentCapabilitiesSchema = z.object({
  supportsStreaming: z.boolean(),
  supportsTools: z.boolean(),
  supportsMultimodal: z.boolean(),
  maxContextLength: z.number().positive(),
  supportedFileTypes: z.array(z.string()).readonly()
});

/**
 * Zod schema for validating query context
 * @since 1.0.0
 */
export const QueryContextSchema = z.object({
  sessionId: z.string(),
  parentTaskId: z.string().optional(),
  toolsEnabled: z.boolean().optional(),
  streamResponse: z.boolean().optional(),
  timeout: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Type-safe event map for agent instance events
 * @since 1.0.0
 */
export type AgentInstanceEventMap = {
  /**
   * Fired when agent status changes
   * @event
   */
  'status:changed': (status: AgentStatus) => void;
  
  /**
   * Fired when a query starts processing
   * @event
   */
  'query:start': (context: QueryContext) => void;
  
  /**
   * Fired when a query completes (success or failure)
   * @event
   */
  'query:complete': (result: QueryResult) => void;
  
  /**
   * Fired when an error occurs
   * @event
   */
  'error': (error: AgentError) => void;
  
  /**
   * Fired when agent initialization completes
   * @event
   */
  'initialized': () => void;
  
  /**
   * Fired when agent termination completes
   * @event
   */
  'terminated': () => void;
};