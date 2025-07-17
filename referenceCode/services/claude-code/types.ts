/**
 * @fileoverview Type definitions for Claude Code service
 * @module services/claude-code/types
 * 
 * @remarks
 * This module provides comprehensive type definitions for the Claude Code service.
 * It includes session management types, configuration options, messages, and events.
 * These types ensure type safety across the Claude Code integration.
 */

import type { SDKMessage, Options } from '@anthropic-ai/claude-code';
import type { ClaudeCodeState } from '../../types/session-states.js';
import type { SessionMetrics } from '../../types/shared.js';

export type { SessionMetrics };

/**
 * Session status type alias for Claude Code states
 */
export type SessionStatus = ClaudeCodeState;

/**
 * Represents a Claude Code session with its state and configuration
 * 
 * @interface ClaudeCodeSession
 * 
 * @example
 * ```typescript
 * const session: ClaudeCodeSession = {
 *   id: 'claude_12345',
 *   status: 'ready',
 *   workingDirectory: '/project',
 *   options: { maxTurns: 20 },
 *   outputBuffer: [],
 *   errorBuffer: [],
 *   streamBuffer: [],
 *   createdAt: new Date(),
 *   lastActivity: new Date()
 * };
 * ```
 */
export interface ClaudeCodeSession {
  /**
   * Unique session identifier
   */
  readonly id: string;
  
  /**
   * Abort controller for cancelling operations
   */
  abortController?: AbortController;
  
  /**
   * Current session status
   */
  status: ClaudeCodeState;
  
  /**
   * Working directory for Claude operations
   */
  readonly workingDirectory: string;
  
  /**
   * Session configuration options
   */
  readonly options: ClaudeCodeOptions;
  
  /**
   * Buffer of SDK messages
   */
  readonly outputBuffer: SDKMessage[];
  
  /**
   * Buffer of error messages
   */
  readonly errorBuffer: string[];
  
  /**
   * Session creation timestamp
   */
  readonly createdAt: Date;
  
  /**
   * Last activity timestamp
   */
  lastActivity: Date;
  
  /**
   * Associated task ID
   */
  taskId?: string;
  
  /**
   * Associated MCP session ID
   */
  mcpSessionId?: string;
  
  /**
   * Buffer of streaming output
   */
  readonly streamBuffer: string[];
}

/**
 * Configuration options for Claude Code sessions
 * 
 * @interface ClaudeCodeOptions
 * @extends {Partial<Options>}
 * 
 * @example
 * ```typescript
 * const options: ClaudeCodeOptions = {
 *   workingDirectory: '/home/user/project',
 *   maxTurns: 30,
 *   model: 'claude-3-opus-20240229',
 *   timeout: 300000,
 *   allowedTools: ['Bash', 'Read', 'Write']
 * };
 * ```
 */
export interface ClaudeCodeOptions extends Partial<Options> {
  /**
   * Working directory for Claude operations
   */
  workingDirectory?: string;
  
  /**
   * Query timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Maximum conversation turns
   */
  maxTurns?: number;
  
  /**
   * Claude model to use
   */
  model?: string;
  
  /**
   * List of allowed tools
   */
  allowedTools?: string[];
  
  /**
   * Custom system prompt
   */
  customSystemPrompt?: string;
}

/**
 * Response from Claude Code operations
 * 
 * @interface ClaudeCodeResponse
 */
export interface ClaudeCodeResponse {
  /**
   * Response type
   */
  type: 'message' | 'tool_use' | 'error' | 'completion';
  
  /**
   * Text content of the response
   */
  content?: string;
  
  /**
   * Name of tool used (for tool_use type)
   */
  toolName?: string;
  
  /**
   * Input to the tool (for tool_use type)
   */
  toolInput?: unknown;
  
  /**
   * Error message (for error type)
   */
  error?: string;
}

/**
 * Message sent to the host proxy daemon
 * 
 * @interface HostProxyMessage
 */
export interface HostProxyMessage {
  /**
   * Tool to execute (always 'claude')
   */
  tool: 'claude';
  
  /**
   * Command/prompt to execute
   */
  command: string;
  
  /**
   * Working directory on host machine
   */
  workingDirectory: string;
  
  /**
   * Environment variables
   */
  env?: Record<string, string>;
}

/**
 * Response from the host proxy daemon
 * 
 * @interface HostProxyResponse
 */
export interface HostProxyResponse {
  /**
   * Response type
   */
  type: 'stream' | 'error' | 'complete' | 'pid';
  
  /**
   * Response data (for stream/error types)
   */
  data?: string;
  
  /**
   * Process ID (for pid type)
   */
  pid?: number;
  
  /**
   * Exit code (for complete type)
   */
  exitCode?: number;
}

/**
 * Result of a Claude query execution
 * 
 * @interface QueryResult
 */
export interface QueryResult {
  /**
   * Extracted text content from Claude's response
   */
  content: string;
  
  /**
   * All SDK messages from the conversation
   */
  messages: SDKMessage[];
}


/**
 * Progress event for task tracking
 * 
 * @interface ProgressEvent
 */
export interface ProgressEvent {
  /**
   * Task ID this progress relates to
   */
  taskId: string;
  
  /**
   * Event type/name
   */
  event: string;
  
  /**
   * Event data/description
   */
  data: string;
}

/**
 * Streaming data event
 * 
 * @interface StreamEvent
 */
export interface StreamEvent {
  /**
   * Session ID emitting the stream
   */
  sessionId: string;
  
  /**
   * Stream data
   */
  data: string;
  
  /**
   * Optional associated task ID
   */
  taskId?: string;
}