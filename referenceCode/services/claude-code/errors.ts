/**
 * @fileoverview Error definitions for Claude Code service
 * @module services/claude-code/errors
 * 
 * @remarks
 * This module provides a comprehensive error hierarchy for the Claude Code service.
 * All errors extend from ClaudeCodeError base class and include specific error codes
 * for easier debugging and error handling.
 * 
 * @example
 * ```typescript
 * import { SessionNotFoundError, QueryTimeoutError } from './errors';
 * 
 * try {
 *   const session = getSession(id);
 * } catch (error) {
 *   if (error instanceof SessionNotFoundError) {
 *     console.error('Session not found:', error.code);
 *   }
 * }
 * ```
 */

/**
 * Base error class for all Claude Code errors
 * 
 * @class ClaudeCodeError
 * @extends Error
 */
export class ClaudeCodeError extends Error {
  /**
   * Creates a new Claude Code error
   * 
   * @param message - Error message
   * @param code - Optional error code for categorization
   */
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ClaudeCodeError';
  }
}

/**
 * Error thrown when a session ID is not found
 * 
 * @class SessionNotFoundError
 * @extends ClaudeCodeError
 */
export class SessionNotFoundError extends ClaudeCodeError {
  /**
   * Creates a new session not found error
   * 
   * @param sessionId - The session ID that was not found
   */
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, 'SESSION_NOT_FOUND');
  }
}

/**
 * Error thrown when a session is not in a ready state
 * 
 * @class SessionNotReadyError
 * @extends ClaudeCodeError
 */
export class SessionNotReadyError extends ClaudeCodeError {
  /**
   * Creates a new session not ready error
   * 
   * @param sessionId - The session ID
   * @param status - Current status of the session
   */
  constructor(sessionId: string, status: string) {
    super(`Session ${sessionId} is ${status}`, 'SESSION_NOT_READY');
  }
}

/**
 * Base error for host proxy related issues
 * 
 * @class HostProxyError
 * @extends ClaudeCodeError
 */
export class HostProxyError extends ClaudeCodeError {
  /**
   * Creates a new host proxy error
   * 
   * @param message - Error message
   */
  constructor(message: string) {
    super(message, 'HOST_PROXY_ERROR');
  }
}

/**
 * Error thrown when connection to host proxy fails
 * 
 * @class HostProxyConnectionError
 * @extends HostProxyError
 */
export class HostProxyConnectionError extends HostProxyError {
  /**
   * Creates a new host proxy connection error
   * 
   * @param message - Connection failure details
   */
  constructor(message: string) {
    super(`Host proxy connection failed: ${message}`);
  }
}

/**
 * Error thrown when host proxy operation times out
 * 
 * @class HostProxyTimeoutError
 * @extends HostProxyError
 */
export class HostProxyTimeoutError extends HostProxyError {
  /**
   * Creates a new host proxy timeout error
   * 
   * @param timeout - Timeout duration in milliseconds
   */
  constructor(timeout: number) {
    super(`Host proxy timeout after ${timeout}ms`);
  }
}

/**
 * Error thrown when a Claude query times out
 * 
 * @class QueryTimeoutError
 * @extends ClaudeCodeError
 */
export class QueryTimeoutError extends ClaudeCodeError {
  /**
   * Creates a new query timeout error
   * 
   * @param timeout - Timeout duration in milliseconds
   */
  constructor(timeout: number) {
    super(`Query timeout after ${timeout}ms`, 'QUERY_TIMEOUT');
  }
}

/**
 * Error thrown when Anthropic account has insufficient credits
 * 
 * @class CreditBalanceError
 * @extends ClaudeCodeError
 */
export class CreditBalanceError extends ClaudeCodeError {
  /**
   * Creates a new credit balance error
   * 
   */
  constructor() {
    super('Credit balance is too low. Please check your Anthropic account.', 'CREDIT_BALANCE_LOW');
  }
}

/**
 * Error thrown when API key is invalid or missing
 * 
 * @class InvalidApiKeyError
 * @extends ClaudeCodeError
 */
export class InvalidApiKeyError extends ClaudeCodeError {
  /**
   * Creates a new invalid API key error
   * 
   */
  constructor() {
    super('Invalid API key. Please check your ANTHROPIC_API_KEY.', 'INVALID_API_KEY');
  }
}

/**
 * Error thrown when a query is aborted
 * 
 * @class QueryAbortedError
 * @extends ClaudeCodeError
 */
export class QueryAbortedError extends ClaudeCodeError {
  /**
   * Creates a new query aborted error
   * 
   * @param reason - Reason for query abortion
   */
  constructor(reason: string) {
    super(`Query aborted: ${reason}`, 'QUERY_ABORTED');
  }
}