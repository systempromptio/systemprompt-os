/**
 * @fileoverview Type definitions for Agent Manager service
 * @module services/agent-manager/types
 * @since 1.0.0
 * 
 * @remarks
 * This module contains all type definitions used by the agent manager service.
 * These types define the contracts for agent sessions, commands, results, and
 * configuration options, ensuring type safety across the agent management system.
 */

import type { ClaudeCodeOptions } from '../claude-code/types.js';
import type { AgentState } from '../../types/session-states.js';

/**
 * Represents the type of AI agent available in the system.
 * 
 * @typedef {'claude'} AgentType
 * @since 1.0.0
 * 
 * @remarks
 * Currently only supports 'claude', but designed to be extensible for future agent types.
 * Use this when specifying which type of agent to create or manage.
 */
export type AgentType = 'claude';

/**
 * Alias for AgentState, representing the current status of an agent session.
 * 
 * @typedef {AgentState} AgentSessionStatus
 * @since 1.0.0
 * 
 * @remarks
 * Use this when you need to track or update the lifecycle state of an agent.
 * States typically include: initializing, ready, busy, error, completed, etc.
 */
export type AgentSessionStatus = AgentState;

/**
 * Represents a running agent session with all its associated metadata and state.
 * 
 * @interface AgentSession
 * @since 1.0.0
 * 
 * @remarks
 * This is the primary data structure for tracking active AI agents in the system.
 * Use this when managing agent lifecycles, monitoring status, or retrieving session information.
 */
export interface AgentSession {
  /**
   * Unique identifier for this agent session
   */
  readonly id: string;
  
  /**
   * The type of agent (e.g., 'claude')
   */
  readonly type: AgentType;
  
  /**
   * ID of the underlying service session (e.g., Claude process ID)
   */
  readonly serviceSessionId: string;
  
  /**
   * Current state of the agent (mutable as agent progresses)
   */
  status: AgentState;
  
  /**
   * Absolute path to the project directory where the agent operates
   */
  readonly projectPath: string;
  
  /**
   * Optional ID linking this session to a specific task
   */
  readonly taskId?: string;
  
  /**
   * Optional MCP session ID for cross-system correlation
   */
  readonly mcpSessionId?: string;
  
  /**
   * ISO timestamp when the session was created
   */
  readonly created_at: string;
  
  /**
   * ISO timestamp of the last activity (updated on any interaction)
   */
  last_activity: string;
  
  /**
   * Array of output messages from the agent (stdout)
   */
  readonly output_buffer: string[];
  
  /**
   * Array of error messages from the agent (stderr)
   */
  readonly error_buffer: string[];
}

/**
 * Represents a command to be executed by an agent.
 * 
 * @interface AgentCommand
 * @since 1.0.0
 * 
 * @remarks
 * Use this when sending instructions or queries to an active agent session.
 * Commands are typically natural language instructions for the AI agent.
 */
export interface AgentCommand {
  /**
   * The command text to send to the agent (e.g., "implement user authentication")
   */
  command: string;
  
  /**
   * Optional timeout in milliseconds for command execution (defaults to system timeout)
   */
  timeout?: number;
}

/**
 * Represents the result of executing a command on an agent.
 * 
 * @interface AgentCommandResult
 * @since 1.0.0
 * 
 * @remarks
 * Contains both success/failure status and any output or error information.
 * Use this to handle agent responses and determine next steps in your workflow.
 */
export interface AgentCommandResult {
  /**
   * Whether the command executed successfully
   */
  success: boolean;
  
  /**
   * The agent's response or output (present on success)
   */
  output?: string;
  
  /**
   * Error information if the command failed
   */
  error?: string | AgentError;
  
  /**
   * Execution time in milliseconds
   */
  duration: number;
}

/**
 * Structured error information from agent operations.
 * 
 * @interface AgentError
 * @since 1.0.0
 * 
 * @remarks
 * Provides detailed error context and indicates whether the operation can be retried.
 * Use this for error handling and determining retry strategies.
 */
export interface AgentError {
  /**
   * Machine-readable error code (e.g., 'TIMEOUT', 'PROCESS_DIED', 'INVALID_STATE')
   */
  code: string;
  
  /**
   * Human-readable error description
   */
  message: string;
  
  /**
   * Whether this error is transient and the operation can be retried
   */
  retryable: boolean;
}

/**
 * Configuration options for creating a new Claude agent session.
 * 
 * @interface ClaudeSessionConfig
 * @since 1.0.0
 * 
 * @remarks
 * Contains all necessary parameters to initialize a Claude AI agent with proper context.
 * Use this when starting a new Claude session through the agent manager.
 */
export interface ClaudeSessionConfig {
  /**
   * Absolute path to the project directory where Claude will operate
   */
  project_path: string;
  
  /**
   * Optional task ID to associate this session with a specific task
   */
  task_id?: string;
  
  /**
   * Optional MCP session ID for cross-system tracking
   */
  mcp_session_id?: string;
  
  /**
   * Operation mode:
   * - 'interactive': Real-time interaction with user feedback
   * - 'batch': Automated execution without user interaction
   * - 'review': Code review and analysis mode
   */
  mode?: 'interactive' | 'batch' | 'review';
  
  /**
   * Custom environment variables for the Claude process
   */
  environment_variables?: Record<string, string>;
  
  /**
   * Initial context or instructions to provide to Claude on startup
   */
  initial_context?: string;
  
  /**
   * Additional Claude-specific configuration options
   */
  options?: ClaudeCodeOptions;
}

/**
 * System-wide metrics for monitoring agent sessions.
 * 
 * @interface SessionMetrics
 * @since 1.0.0
 * 
 * @remarks
 * Provides aggregate statistics about all agent sessions in the system.
 * Use this for health monitoring, capacity planning, and system dashboards.
 */
export interface SessionMetrics {
  /**
   * Total number of sessions (active + inactive)
   */
  totalSessions: number;
  
  /**
   * Number of currently active sessions
   */
  activeSessions: number;
  
  /**
   * Number of sessions actively processing commands
   */
  busySessions: number;
  
  /**
   * Number of sessions in error state
   */
  errorSessions: number;
  
  /**
   * Breakdown of sessions by agent type
   */
  sessionsByType: Record<AgentType, number>;
}

/**
 * Event payload for session-related events in the event system.
 * 
 * @interface SessionEvent
 * @since 1.0.0
 * 
 * @remarks
 * Used for pub/sub notifications about session lifecycle changes.
 * Subscribe to these events to react to session creation, updates, or termination.
 */
export interface SessionEvent {
  /**
   * The ID of the session that triggered the event
   */
  sessionId: string;
  
  /**
   * Optional agent type for additional context
   */
  type?: AgentType;
}

/**
 * Event payload for task progress updates.
 * 
 * @interface TaskProgressEvent
 * @since 1.0.0
 * 
 * @remarks
 * Emitted when significant progress occurs during task execution.
 * Use this to track task progress, update UIs, or trigger dependent workflows.
 */
export interface TaskProgressEvent {
  /**
   * The ID of the task making progress
   */
  taskId: string;
  
  /**
   * Event type (e.g., 'started', 'progress', 'completed', 'failed')
   */
  event: string;
  
  /**
   * Event-specific data payload (structure depends on event type)
   */
  data: any;
}