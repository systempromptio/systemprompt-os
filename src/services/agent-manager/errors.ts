/**
 * @file Error definitions for Agent Manager service
 * @module services/agent-manager/errors
 */

/**
 * Base error class for Agent Manager operations
 */
export class AgentManagerError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'AgentManagerError';
  }
}

/**
 * Thrown when attempting to access a session that doesn't exist
 */
export class SessionNotFoundError extends AgentManagerError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, 'SESSION_NOT_FOUND');
  }
}

/**
 * Thrown when attempting to send messages to an inactive session
 */
export class SessionNotActiveError extends AgentManagerError {
  constructor(sessionId: string, status: string) {
    super(`Session ${sessionId} is ${status}`, 'SESSION_NOT_ACTIVE');
  }
}

/**
 * Thrown when an unknown session type is requested
 */
export class UnknownSessionTypeError extends AgentManagerError {
  constructor(type: string) {
    super(`Unknown session type: ${type}`, 'UNKNOWN_SESSION_TYPE');
  }
}

/**
 * Thrown when a command execution fails
 */
export class CommandExecutionError extends AgentManagerError {
  constructor(message: string, public readonly retryable: boolean = false) {
    super(message, 'COMMAND_FAILED');
  }
}