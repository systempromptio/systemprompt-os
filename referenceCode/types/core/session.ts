/**
 * @fileoverview Session management type definitions
 * @module types/core/session
 */

import { z } from 'zod';
import { AgentId, AgentProvider } from './agent.js';

/**
 * Branded type for session identifiers to ensure type safety
 */
export type SessionId = string & { readonly __brand: 'SessionId' };

/**
 * Creates a type-safe session identifier
 * @param {string} id - The raw session ID string
 * @returns {SessionId} A branded session ID
 * @example
 * ```typescript
 * const sessionId = createSessionId('session_123');
 * ```
 */
export const createSessionId = (id: string): SessionId => id as SessionId;

/**
 * Represents the current status of a session
 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Configuration options for a session
 * @interface
 */
export interface SessionConfig {
  /**
   * Maximum session duration in milliseconds
   */
  readonly maxDuration?: number;
  
  /**
   * Maximum number of conversation turns
   */
  readonly maxTurns?: number;
  
  /**
   * Whether to automatically save session state
   * @default true
   */
  readonly autoSave?: boolean;
  
  /**
   * Whether to persist session state across restarts
   * @default true
   */
  readonly persistState?: boolean;
}

/**
 * Runtime context for a session
 * @interface
 */
export interface SessionContext {
  /**
   * Working directory for file operations
   */
  readonly workingDirectory: string;
  
  /**
   * Environment variables available to the session
   */
  readonly environment: Record<string, string>;
  
  /**
   * Session-specific variables that persist across turns
   */
  readonly variables: Record<string, unknown>;
}

/**
 * Represents an active or completed agent session
 * @interface
 */
export interface Session {
  /**
   * Unique session identifier
   */
  readonly id: SessionId;
  
  /**
   * ID of the agent handling this session
   */
  readonly agentId: AgentId;
  
  /**
   * AI provider for this session
   */
  readonly provider: AgentProvider;
  
  /**
   * Current session status
   */
  readonly status: SessionStatus;
  
  /**
   * Session configuration
   */
  readonly config: SessionConfig;
  
  /**
   * Session runtime context
   */
  readonly context: SessionContext;
  
  /**
   * Session start timestamp
   */
  readonly startedAt: Date;
  
  /**
   * Session end timestamp (if completed)
   */
  readonly endedAt?: Date;
  
  /**
   * Additional session metadata
   */
  readonly metadata: Record<string, unknown>;
}

/**
 * Mutable state of a session
 * @interface
 */
export interface SessionState {
  /**
   * Conversation message history
   */
  readonly messages: SessionMessage[];
  
  /**
   * Number of conversation turns completed
   */
  readonly turns: number;
  
  /**
   * Total tokens consumed in this session
   */
  readonly tokensUsed: number;
  
  /**
   * Timestamp of last activity
   */
  readonly lastActivity: Date;
}

/**
 * Represents a single message in a session
 * @interface
 */
export interface SessionMessage {
  /**
   * Unique message identifier
   */
  readonly id: string;
  
  /**
   * Role of the message sender
   */
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  
  /**
   * Message content
   */
  readonly content: string;
  
  /**
   * Message timestamp
   */
  readonly timestamp: Date;
  
  /**
   * Additional message metadata
   */
  readonly metadata?: MessageMetadata;
}

/**
 * Metadata associated with a session message
 * @interface
 */
export interface MessageMetadata {
  /**
   * Tool calls made in this message
   */
  readonly toolCalls?: ToolCall[];
  
  /**
   * Results from tool executions
   */
  readonly toolResults?: ToolResult[];
  
  /**
   * Tokens used for this specific message
   */
  readonly tokensUsed?: number;
  
  /**
   * Model used to generate this message
   */
  readonly model?: string;
}

/**
 * Represents a tool/function call request
 * @interface
 */
export interface ToolCall {
  /**
   * Unique tool call identifier
   */
  readonly id: string;
  
  /**
   * Name of the tool to invoke
   */
  readonly name: string;
  
  /**
   * Arguments to pass to the tool
   */
  readonly arguments: unknown;
}

/**
 * Result from a tool execution
 * @interface
 */
export interface ToolResult {
  /**
   * Unique result identifier
   */
  readonly id: string;
  
  /**
   * ID of the tool call this result corresponds to
   */
  readonly toolCallId: string;
  
  /**
   * Output from the tool execution
   */
  readonly output: unknown;
  
  /**
   * Error message if tool execution failed
   */
  readonly error?: string;
}

/**
 * Interface for session management operations
 * @interface
 */
export interface SessionManager {
  /**
   * Creates a new session
   * @param {AgentProvider} provider - AI provider to use
   * @param {SessionConfig} [config] - Session configuration
   * @returns {Promise<Session>} The created session
   * @throws {Error} If session creation fails
   */
  createSession(provider: AgentProvider, config?: SessionConfig): Promise<Session>;
  
  /**
   * Retrieves a session by ID
   * @param {SessionId} id - Session identifier
   * @returns {Promise<Session | null>} The session or null if not found
   */
  getSession(id: SessionId): Promise<Session | null>;
  
  /**
   * Updates session properties
   * @param {SessionId} id - Session identifier
   * @param {Partial<Session>} updates - Properties to update
   * @returns {Promise<Session>} The updated session
   * @throws {Error} If session not found or update fails
   */
  updateSession(id: SessionId, updates: Partial<Session>): Promise<Session>;
  
  /**
   * Deletes a session
   * @param {SessionId} id - Session identifier
   * @returns {Promise<void>}
   * @throws {Error} If session not found
   */
  deleteSession(id: SessionId): Promise<void>;
  
  /**
   * Lists sessions matching the filter
   * @param {SessionFilter} [filter] - Optional filter criteria
   * @returns {Promise<Session[]>} Array of matching sessions
   */
  listSessions(filter?: SessionFilter): Promise<Session[]>;
}

/**
 * Filter criteria for listing sessions
 * @interface
 */
export interface SessionFilter {
  /**
   * Filter by AI provider
   */
  readonly provider?: AgentProvider;
  
  /**
   * Filter by session status
   */
  readonly status?: SessionStatus;
  
  /**
   * Filter sessions started after this date
   */
  readonly startedAfter?: Date;
  
  /**
   * Filter sessions started before this date
   */
  readonly startedBefore?: Date;
}

/**
 * Zod schema for validating session status
 */
export const SessionStatusSchema = z.enum(['active', 'paused', 'completed', 'failed', 'cancelled']);

/**
 * Zod schema for validating session configuration
 */
export const SessionConfigSchema = z.object({
  maxDuration: z.number().positive().optional(),
  maxTurns: z.number().positive().optional(),
  autoSave: z.boolean().optional(),
  persistState: z.boolean().optional()
});

/**
 * Zod schema for validating session messages
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