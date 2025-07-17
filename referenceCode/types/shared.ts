/**
 * @fileoverview Shared type definitions used across multiple services
 * @module types/shared
 */

/**
 * Session metrics tracking resource usage and performance
 * @interface
 */
export interface SessionMetrics {
  /**
   * Total number of messages exchanged
   */
  messageCount?: number;
  
  /**
   * Total tokens consumed
   */
  totalTokens?: number;
  
  /**
   * Number of tool calls made
   */
  toolCallCount?: number;
  
  /**
   * Average response time in milliseconds
   */
  averageResponseTime?: number;
  
  /**
   * Unix timestamp of last activity
   */
  lastActivity?: number;
  
  /**
   * Total number of sessions created
   */
  totalSessions?: number;
  
  /**
   * Number of currently active sessions
   */
  activeSessions?: number;
  
  /**
   * Number of sessions in error state
   */
  errorSessions?: number;
  
  /**
   * Number of sessions currently busy
   */
  busySessions?: number;
  
  /**
   * Average session duration in milliseconds
   */
  averageSessionDuration?: number;
  
  /**
   * Session count by type (e.g., 'claude', 'gemini')
   */
  sessionsByType?: Record<string, number>;
}

/**
 * Base error class for service layer errors
 * @class
 * @extends {Error}
 */
export class ServiceError extends Error {
  /**
   * Creates a new service error
   * @param {string} message - Error message
   * @param {string} code - Error code for programmatic handling
   * @param {number} [statusCode] - HTTP status code
   * @param {unknown} [details] - Additional error details
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Common persistence options
 * @interface
 */
export interface PersistenceOptions {
  /**
   * Type of persistence backend
   */
  type: 'filesystem' | 'redis' | 'postgres';
  
  /**
   * Backend-specific configuration
   */
  config?: Record<string, unknown>;
}

/**
 * Standard async result type for error handling
 * @template T - Success data type
 * @template E - Error type (defaults to Error)
 * @example
 * ```typescript
 * async function fetchData(): AsyncResult<Data> {
 *   try {
 *     const data = await api.get();
 *     return { success: true, data };
 *   } catch (error) {
 *     return { success: false, error };
 *   }
 * }
 * ```
 */
export type AsyncResult<T, E = Error> = Promise<
  { success: true; data: T } | { success: false; error: E }
>;