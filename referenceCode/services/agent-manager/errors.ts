/**
 * @fileoverview Error definitions for Agent Manager service
 * @module services/agent-manager/errors
 * 
 * @remarks
 * This module defines custom error classes for the agent manager service.
 * These errors provide specific context about failures in agent operations,
 * making error handling and debugging more precise.
 * 
 * @example
 * ```typescript
 * import { SessionNotFoundError } from './errors';
 * 
 * function getSession(id: string) {
 *   const session = sessions.get(id);
 *   if (!session) {
 *     throw new SessionNotFoundError(id);
 *   }
 *   return session;
 * }
 * ```
 */

/**
 * Base error class for Agent Manager operations
 * 
 * @class AgentManagerError
 * @extends Error
 */
export class AgentManagerError extends Error {
  /**
   * Creates a new AgentManagerError
   * 
   * @param message - Error message
   * @param code - Optional error code for programmatic handling
   */
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'AgentManagerError';
  }
}

/**
 * Thrown when attempting to access a session that doesn't exist
 * 
 * @class SessionNotFoundError
 * @extends AgentManagerError
 */
export class SessionNotFoundError extends AgentManagerError {
  /**
   * Creates a new SessionNotFoundError
   * 
   * @param sessionId - The ID of the session that was not found
   */
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, 'SESSION_NOT_FOUND');
  }
}

/**
 * Thrown when attempting to send messages to an inactive session
 * 
 * @class SessionNotActiveError
 * @extends AgentManagerError
 */
export class SessionNotActiveError extends AgentManagerError {
  /**
   * Creates a new SessionNotActiveError
   * 
   * @param sessionId - The ID of the inactive session
   * @param status - The current status of the session
   */
  constructor(sessionId: string, status: string) {
    super(`Session ${sessionId} is ${status}`, 'SESSION_NOT_ACTIVE');
  }
}

/**
 * Thrown when an unknown session type is requested
 * 
 * @class UnknownSessionTypeError
 * @extends AgentManagerError
 */
export class UnknownSessionTypeError extends AgentManagerError {
  /**
   * Creates a new UnknownSessionTypeError
   * 
   * @param type - The unknown session type that was requested
   */
  constructor(type: string) {
    super(`Unknown session type: ${type}`, 'UNKNOWN_SESSION_TYPE');
  }
}

/**
 * Thrown when a command execution fails
 * 
 * @class CommandExecutionError
 * @extends AgentManagerError
 */
export class CommandExecutionError extends AgentManagerError {
  /**
   * Creates a new CommandExecutionError
   * 
   * @param message - Error message describing the failure
   * @param retryable - Whether the command can be retried
   */
  constructor(message: string, public readonly retryable: boolean = false) {
    super(message, 'COMMAND_FAILED');
  }
}