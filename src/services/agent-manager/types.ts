/**
 * @file Type definitions for Agent Manager service
 * @module services/agent-manager/types
 */

import type { ClaudeCodeOptions } from '../claude-code/types.js';
import type { AgentState } from '../../types/session-states.js';

/**
 * Represents the type of AI agent available in the system.
 * Currently only supports 'claude', but designed to be extensible for future agent types.
 * Use this when specifying which type of agent to create or manage.
 */
export type AgentType = 'claude';

/**
 * Alias for AgentState, representing the current status of an agent session.
 * Use this when you need to track or update the lifecycle state of an agent.
 * States typically include: initializing, ready, busy, error, completed, etc.
 */
export type AgentSessionStatus = AgentState;

/**
 * Represents a running agent session with all its associated metadata and state.
 * This is the primary data structure for tracking active AI agents in the system.
 * Use this when managing agent lifecycles, monitoring status, or retrieving session information.
 * 
 * @interface AgentSession
 * @property {string} id - Unique identifier for this agent session
 * @property {AgentType} type - The type of agent (e.g., 'claude')
 * @property {string} serviceSessionId - ID of the underlying service session (e.g., Claude process ID)
 * @property {AgentState} status - Current state of the agent (mutable as agent progresses)
 * @property {string} projectPath - Absolute path to the project directory where the agent operates
 * @property {string} [taskId] - Optional ID linking this session to a specific task
 * @property {string} [mcpSessionId] - Optional MCP session ID for cross-system correlation
 * @property {string} created_at - ISO timestamp when the session was created
 * @property {string} last_activity - ISO timestamp of the last activity (updated on any interaction)
 * @property {string[]} output_buffer - Array of output messages from the agent (stdout)
 * @property {string[]} error_buffer - Array of error messages from the agent (stderr)
 */
export interface AgentSession {
  readonly id: string;
  readonly type: AgentType;
  readonly serviceSessionId: string;
  status: AgentState;
  readonly projectPath: string;
  readonly taskId?: string;
  readonly mcpSessionId?: string;
  readonly created_at: string;
  last_activity: string;
  readonly output_buffer: string[];
  readonly error_buffer: string[];
}

/**
 * Represents a command to be executed by an agent.
 * Use this when sending instructions or queries to an active agent session.
 * Commands are typically natural language instructions for the AI agent.
 * 
 * @interface AgentCommand
 * @property {string} command - The command text to send to the agent (e.g., "implement user authentication")
 * @property {number} [timeout] - Optional timeout in milliseconds for command execution (defaults to system timeout)
 */
export interface AgentCommand {
  command: string;
  timeout?: number;
}

/**
 * Represents the result of executing a command on an agent.
 * Contains both success/failure status and any output or error information.
 * Use this to handle agent responses and determine next steps in your workflow.
 * 
 * @interface AgentCommandResult
 * @property {boolean} success - Whether the command executed successfully
 * @property {string} [output] - The agent's response or output (present on success)
 * @property {string | AgentError} [error] - Error information if the command failed
 * @property {number} duration - Execution time in milliseconds
 */
export interface AgentCommandResult {
  success: boolean;
  output?: string;
  error?: string | AgentError;
  duration: number;
}

/**
 * Structured error information from agent operations.
 * Provides detailed error context and indicates whether the operation can be retried.
 * Use this for error handling and determining retry strategies.
 * 
 * @interface AgentError
 * @property {string} code - Machine-readable error code (e.g., 'TIMEOUT', 'PROCESS_DIED', 'INVALID_STATE')
 * @property {string} message - Human-readable error description
 * @property {boolean} retryable - Whether this error is transient and the operation can be retried
 */
export interface AgentError {
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * Configuration options for creating a new Claude agent session.
 * Contains all necessary parameters to initialize a Claude AI agent with proper context.
 * Use this when starting a new Claude session through the agent manager.
 * 
 * @interface ClaudeSessionConfig
 * @property {string} project_path - Absolute path to the project directory where Claude will operate
 * @property {string} [task_id] - Optional task ID to associate this session with a specific task
 * @property {string} [mcp_session_id] - Optional MCP session ID for cross-system tracking
 * @property {'interactive' | 'batch' | 'review'} [mode] - Operation mode:
 *   - 'interactive': Real-time interaction with user feedback
 *   - 'batch': Automated execution without user interaction
 *   - 'review': Code review and analysis mode
 * @property {Record<string, string>} [environment_variables] - Custom environment variables for the Claude process
 * @property {string} [initial_context] - Initial context or instructions to provide to Claude on startup
 * @property {ClaudeCodeOptions} [options] - Additional Claude-specific configuration options
 */
export interface ClaudeSessionConfig {
  project_path: string;
  task_id?: string;
  mcp_session_id?: string;
  mode?: 'interactive' | 'batch' | 'review';
  environment_variables?: Record<string, string>;
  initial_context?: string;
  options?: ClaudeCodeOptions;
}

/**
 * System-wide metrics for monitoring agent sessions.
 * Provides aggregate statistics about all agent sessions in the system.
 * Use this for health monitoring, capacity planning, and system dashboards.
 * 
 * @interface SessionMetrics
 * @property {number} totalSessions - Total number of sessions (active + inactive)
 * @property {number} activeSessions - Number of currently active sessions
 * @property {number} busySessions - Number of sessions actively processing commands
 * @property {number} errorSessions - Number of sessions in error state
 * @property {Record<AgentType, number>} sessionsByType - Breakdown of sessions by agent type
 */
export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  busySessions: number;
  errorSessions: number;
  sessionsByType: Record<AgentType, number>;
}

/**
 * Event payload for session-related events in the event system.
 * Used for pub/sub notifications about session lifecycle changes.
 * Subscribe to these events to react to session creation, updates, or termination.
 * 
 * @interface SessionEvent
 * @property {string} sessionId - The ID of the session that triggered the event
 * @property {AgentType} [type] - Optional agent type for additional context
 */
export interface SessionEvent {
  sessionId: string;
  type?: AgentType;
}

/**
 * Event payload for task progress updates.
 * Emitted when significant progress occurs during task execution.
 * Use this to track task progress, update UIs, or trigger dependent workflows.
 * 
 * @interface TaskProgressEvent
 * @property {string} taskId - The ID of the task making progress
 * @property {string} event - Event type (e.g., 'started', 'progress', 'completed', 'failed')
 * @property {any} data - Event-specific data payload (structure depends on event type)
 */
export interface TaskProgressEvent {
  taskId: string;
  event: string;
  data: any;
}