/**
 * @fileoverview Core agent type definitions for AI agent abstraction
 * @module types/core/agent
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

/**
 * Supported AI agent providers
 */
export type AgentProvider = 'claude' | 'gemini' | 'custom';

/**
 * Represents the current operational status of an AI agent
 */
export type AgentStatus = 'idle' | 'initializing' | 'ready' | 'processing' | 'error' | 'terminated';

/**
 * Branded type for agent identifiers to ensure type safety
 */
export type AgentId = string & { readonly __brand: 'AgentId' };

/**
 * Creates a type-safe agent identifier
 * @param {string} id - The raw agent ID string
 * @returns {AgentId} A branded agent ID
 * @example
 * ```typescript
 * const agentId = createAgentId('agent_123');
 * ```
 */
export const createAgentId = (id: string): AgentId => id as AgentId;

/**
 * Defines the capabilities supported by an AI agent
 * @interface
 */
export interface AgentCapabilities {
  /**
   * Whether the agent supports streaming responses
   */
  readonly supportsStreaming: boolean;
  
  /**
   * Whether the agent supports tool/function calling
   */
  readonly supportsTools: boolean;
  
  /**
   * Whether the agent supports multimodal inputs (images, etc.)
   */
  readonly supportsMultimodal: boolean;
  
  /**
   * Maximum context length in tokens
   */
  readonly maxContextLength: number;
  
  /**
   * List of supported file types for multimodal inputs
   */
  readonly supportedFileTypes: readonly string[];
}

/**
 * Metadata about an AI agent instance
 * @interface
 */
export interface AgentMetadata {
  /**
   * The AI provider for this agent
   */
  readonly provider: AgentProvider;
  
  /**
   * Specific model identifier (e.g., 'claude-3-opus')
   */
  readonly model?: string;
  
  /**
   * Version of the agent implementation
   */
  readonly version?: string;
  
  /**
   * Capabilities supported by this agent
   */
  readonly capabilities: AgentCapabilities;
}

/**
 * Options for initializing an AI agent
 * @interface
 * @template TConfig - Type of provider-specific configuration
 */
export interface AgentInitOptions<TConfig = unknown> {
  /**
   * Optional agent ID (auto-generated if not provided)
   */
  readonly id?: AgentId;
  
  /**
   * Working directory for the agent's operations
   */
  readonly workingDirectory?: string;
  
  /**
   * Environment variables for the agent process
   */
  readonly environment?: Record<string, string>;
  
  /**
   * Provider-specific configuration
   */
  readonly config: TConfig;
  
  /**
   * Additional metadata for the agent
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Context for executing a query against an AI agent
 * @interface
 */
export interface QueryContext {
  /**
   * Unique session identifier for this query
   */
  readonly sessionId: string;
  
  /**
   * Parent task ID for hierarchical task tracking
   */
  readonly parentTaskId?: string;
  
  /**
   * Whether to enable tool/function calling for this query
   * @default true
   */
  readonly toolsEnabled?: boolean;
  
  /**
   * Whether to stream the response
   * @default false
   */
  readonly streamResponse?: boolean;
  
  /**
   * Query timeout in milliseconds
   */
  readonly timeout?: number;
  
  /**
   * Additional metadata for the query
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Result of an AI agent query
 * @interface
 * @template TResponse - Type of the response data
 */
export interface QueryResult<TResponse = unknown> {
  /**
   * Whether the query executed successfully
   */
  readonly success: boolean;
  
  /**
   * The response data (present if success is true)
   */
  readonly response?: TResponse;
  
  /**
   * Error details (present if success is false)
   */
  readonly error?: AgentError;
  
  /**
   * Query execution duration in milliseconds
   */
  readonly duration: number;
  
  /**
   * Token usage statistics for this query
   */
  readonly tokensUsed?: TokenUsage;
}

/**
 * Token usage statistics for an AI query
 * @interface
 */
export interface TokenUsage {
  /**
   * Number of input tokens consumed
   */
  readonly input: number;
  
  /**
   * Number of output tokens generated
   */
  readonly output: number;
  
  /**
   * Total tokens used (input + output)
   */
  readonly total: number;
}

/**
 * Structured error information from an AI agent
 * @interface
 */
export interface AgentError {
  /**
   * Categorized error code
   */
  readonly code: AgentErrorCode;
  
  /**
   * Human-readable error message
   */
  readonly message: string;
  
  /**
   * Additional error details or context
   */
  readonly details?: unknown;
  
  /**
   * Whether this error can be retried
   */
  readonly retryable: boolean;
}

/**
 * Enumeration of possible agent error codes
 * @enum {string}
 * @readonly
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
 */
export interface IAgent<TConfig = unknown, TResponse = unknown> extends EventEmitter {
  /**
   * Unique identifier for this agent instance
   */
  readonly id: AgentId;
  
  /**
   * Current operational status
   */
  readonly status: AgentStatus;
  
  /**
   * Agent metadata and capabilities
   */
  readonly metadata: AgentMetadata;
  
  /**
   * Initializes the agent with the provided options
   * @param {AgentInitOptions<TConfig>} options - Initialization options
   * @returns {Promise<void>} Resolves when initialization is complete
   * @throws {AgentError} If initialization fails
   * @fires IAgent#initialized
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
   */
  query(prompt: string, context?: QueryContext): Promise<QueryResult<TResponse>>;
  
  /**
   * Gracefully terminates the agent
   * @returns {Promise<void>} Resolves when termination is complete
   * @fires IAgent#terminated
   */
  terminate(): Promise<void>;
  
  /**
   * Gets the current agent status
   * @returns {AgentStatus} Current status
   */
  getStatus(): AgentStatus;
  
  /**
   * Gets the agent metadata
   * @returns {AgentMetadata} Agent metadata
   */
  getMetadata(): AgentMetadata;
  
  /**
   * Checks if the agent is ready to accept queries
   * @returns {boolean} True if agent is ready
   */
  isReady(): boolean;
}

/**
 * Zod schema for validating agent status
 */
export const AgentStatusSchema = z.enum(['idle', 'initializing', 'ready', 'processing', 'error', 'terminated']);

/**
 * Zod schema for validating agent provider
 */
export const AgentProviderSchema = z.enum(['claude', 'gemini', 'custom']);

/**
 * Zod schema for validating agent capabilities
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