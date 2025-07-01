/**
 * @fileoverview Session management type definitions
 * @module types/core/session
 * @since 1.0.0
 */

import { z } from 'zod';
import { AgentId, AgentProvider } from './agent.js';

/**
 * Branded type for session identifiers to ensure type safety
 * @since 1.0.0
 */
export type SessionId = string & { readonly __brand: 'SessionId' };

/**
 * Creates a type-safe session identifier
 * @param {string} id - The raw session ID string
 * @returns {SessionId} A branded session ID
 * @since 1.0.0
 * @example
 * ```typescript
 * const sessionId = createSessionId('session_123');
 * ```
 */
export const createSessionId = (id: string): SessionId => id as SessionId;

/**
 * Represents the current status of a session
 * @since 1.0.0
 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Configuration options for a session
 * @interface
 * @since 1.0.0
 */
export interface SessionConfig {
  /**
   * Maximum session duration in milliseconds
   * @since 1.0.0
   */
  readonly maxDuration?: number;
  
  /**
   * Maximum number of conversation turns
   * @since 1.0.0
   */
  readonly maxTurns?: number;
  
  /**
   * Whether to automatically save session state
   * @default true
   * @since 1.0.0
   */
  readonly autoSave?: boolean;
  
  /**
   * Whether to persist session state across restarts
   * @default true
   * @since 1.0.0
   */
  readonly persistState?: boolean;
}

/**
 * Runtime context for a session
 * @interface
 * @since 1.0.0
 */
export interface SessionContext {
  /**
   * Working directory for file operations
   * @since 1.0.0
   */
  readonly workingDirectory: string;
  
  /**
   * Environment variables available to the session
   * @since 1.0.0
   */
  readonly environment: Record<string, string>;
  
  /**
   * Session-specific variables that persist across turns
   * @since 1.0.0
   */
  readonly variables: Record<string, unknown>;
}

/**
 * Represents an active or completed agent session
 * @interface
 * @since 1.0.0
 */
export interface Session {
  /**
   * Unique session identifier
   * @since 1.0.0
   */
  readonly id: SessionId;
  
  /**
   * ID of the agent handling this session
   * @since 1.0.0
   */
  readonly agentId: AgentId;
  
  /**
   * AI provider for this session
   * @since 1.0.0
   */
  readonly provider: AgentProvider;
  
  /**
   * Current session status
   * @since 1.0.0
   */
  readonly status: SessionStatus;
  
  /**
   * Session configuration
   * @since 1.0.0
   */
  readonly config: SessionConfig;
  
  /**
   * Session runtime context
   * @since 1.0.0
   */
  readonly context: SessionContext;
  
  /**
   * Session start timestamp
   * @since 1.0.0
   */
  readonly startedAt: Date;
  
  /**
   * Session end timestamp (if completed)
   * @since 1.0.0
   */
  readonly endedAt?: Date;
  
  /**
   * Additional session metadata
   * @since 1.0.0
   */
  readonly metadata: Record<string, unknown>;
}

/**
 * Mutable state of a session
 * @interface
 * @since 1.0.0
 */
export interface SessionState {
  /**
   * Conversation message history
   * @since 1.0.0
   */
  readonly messages: SessionMessage[];
  
  /**
   * Number of conversation turns completed
   * @since 1.0.0
   */
  readonly turns: number;
  
  /**
   * Total tokens consumed in this session
   * @since 1.0.0
   */
  readonly tokensUsed: number;
  
  /**
   * Timestamp of last activity
   * @since 1.0.0
   */
  readonly lastActivity: Date;
}

/**
 * Represents a single message in a session
 * @interface
 * @since 1.0.0
 */
export interface SessionMessage {
  /**
   * Unique message identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * Role of the message sender
   * @since 1.0.0
   */
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  
  /**
   * Message content
   * @since 1.0.0
   */
  readonly content: string;
  
  /**
   * Message timestamp
   * @since 1.0.0
   */
  readonly timestamp: Date;
  
  /**
   * Additional message metadata
   * @since 1.0.0
   */
  readonly metadata?: MessageMetadata;
}

/**
 * Metadata associated with a session message
 * @interface
 * @since 1.0.0
 */
export interface MessageMetadata {
  /**
   * Tool calls made in this message
   * @since 1.0.0
   */
  readonly toolCalls?: ToolCall[];
  
  /**
   * Results from tool executions
   * @since 1.0.0
   */
  readonly toolResults?: ToolResult[];
  
  /**
   * Tokens used for this specific message
   * @since 1.0.0
   */
  readonly tokensUsed?: number;
  
  /**
   * Model used to generate this message
   * @since 1.0.0
   */
  readonly model?: string;
}

/**
 * Represents a tool/function call request
 * @interface
 * @since 1.0.0
 */
export interface ToolCall {
  /**
   * Unique tool call identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * Name of the tool to invoke
   * @since 1.0.0
   */
  readonly name: string;
  
  /**
   * Arguments to pass to the tool
   * @since 1.0.0
   */
  readonly arguments: unknown;
}

/**
 * Result from a tool execution
 * @interface
 * @since 1.0.0
 */
export interface ToolResult {
  /**
   * Unique result identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * ID of the tool call this result corresponds to
   * @since 1.0.0
   */
  readonly toolCallId: string;
  
  /**
   * Output from the tool execution
   * @since 1.0.0
   */
  readonly output: unknown;
  
  /**
   * Error message if tool execution failed
   * @since 1.0.0
   */
  readonly error?: string;
}

/**
 * Interface for session management operations
 * @interface
 * @since 1.0.0
 */
export interface SessionManager {
  /**
   * Creates a new session
   * @param {AgentProvider} provider - AI provider to use
   * @param {SessionConfig} [config] - Session configuration
   * @returns {Promise<Session>} The created session
   * @throws {Error} If session creation fails
   * @since 1.0.0
   */
  createSession(provider: AgentProvider, config?: SessionConfig): Promise<Session>;
  
  /**
   * Retrieves a session by ID
   * @param {SessionId} id - Session identifier
   * @returns {Promise<Session | null>} The session or null if not found
   * @since 1.0.0
   */
  getSession(id: SessionId): Promise<Session | null>;
  
  /**
   * Updates session properties
   * @param {SessionId} id - Session identifier
   * @param {Partial<Session>} updates - Properties to update
   * @returns {Promise<Session>} The updated session
   * @throws {Error} If session not found or update fails
   * @since 1.0.0
   */
  updateSession(id: SessionId, updates: Partial<Session>): Promise<Session>;
  
  /**
   * Deletes a session
   * @param {SessionId} id - Session identifier
   * @returns {Promise<void>}
   * @throws {Error} If session not found
   * @since 1.0.0
   */
  deleteSession(id: SessionId): Promise<void>;
  
  /**
   * Lists sessions matching the filter
   * @param {SessionFilter} [filter] - Optional filter criteria
   * @returns {Promise<Session[]>} Array of matching sessions
   * @since 1.0.0
   */
  listSessions(filter?: SessionFilter): Promise<Session[]>;
}

/**
 * Filter criteria for listing sessions
 * @interface
 * @since 1.0.0
 */
export interface SessionFilter {
  /**
   * Filter by AI provider
   * @since 1.0.0
   */
  readonly provider?: AgentProvider;
  
  /**
   * Filter by session status
   * @since 1.0.0
   */
  readonly status?: SessionStatus;
  
  /**
   * Filter sessions started after this date
   * @since 1.0.0
   */
  readonly startedAfter?: Date;
  
  /**
   * Filter sessions started before this date
   * @since 1.0.0
   */
  readonly startedBefore?: Date;
}

/**
 * Zod schema for validating session status
 * @since 1.0.0
 */
export const SessionStatusSchema = z.enum(['active', 'paused', 'completed', 'failed', 'cancelled']);

/**
 * Zod schema for validating session configuration
 * @since 1.0.0
 */
export const SessionConfigSchema = z.object({
  maxDuration: z.number().positive().optional(),
  maxTurns: z.number().positive().optional(),
  autoSave: z.boolean().optional(),
  persistState: z.boolean().optional()
});

/**
 * Zod schema for validating session messages
 * @since 1.0.0
 */
export const SessionMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  timestamp: z.date(),
  metadata: z.object({
    toolCalls: z.array(z.object({
      id: z.string(),
      name: z.string(),
      arguments: z.unknown()
    })).optional(),
    toolResults: z.array(z.object({
      id: z.string(),
      toolCallId: z.string(),
      output: z.unknown(),
      error: z.string().optional()
    })).optional(),
    tokensUsed: z.number().optional(),
    model: z.string().optional()
  }).optional()
});