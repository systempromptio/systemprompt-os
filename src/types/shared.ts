/**
 * @fileoverview Shared type definitions used across multiple services
 * @module types/shared
 * @since 1.0.0
 */

/**
 * Session metrics tracking resource usage and performance
 * @interface
 * @since 1.0.0
 */
export interface SessionMetrics {
  /**
   * Total number of messages exchanged
   * @since 1.0.0
   */
  messageCount?: number;
  
  /**
   * Total tokens consumed
   * @since 1.0.0
   */
  totalTokens?: number;
  
  /**
   * Number of tool calls made
   * @since 1.0.0
   */
  toolCallCount?: number;
  
  /**
   * Average response time in milliseconds
   * @since 1.0.0
   */
  averageResponseTime?: number;
  
  /**
   * Unix timestamp of last activity
   * @since 1.0.0
   */
  lastActivity?: number;
  
  /**
   * Total number of sessions created
   * @since 1.0.0
   */
  totalSessions?: number;
  
  /**
   * Number of currently active sessions
   * @since 1.0.0
   */
  activeSessions?: number;
  
  /**
   * Number of sessions in error state
   * @since 1.0.0
   */
  errorSessions?: number;
  
  /**
   * Number of sessions currently busy
   * @since 1.0.0
   */
  busySessions?: number;
  
  /**
   * Average session duration in milliseconds
   * @since 1.0.0
   */
  averageSessionDuration?: number;
  
  /**
   * Session count by type (e.g., 'claude', 'gemini')
   * @since 1.0.0
   */
  sessionsByType?: Record<string, number>;
}

/**
 * Base error class for service layer errors
 * @class
 * @extends {Error}
 * @since 1.0.0
 */
export class ServiceError extends Error {
  /**
   * Creates a new service error
   * @param {string} message - Error message
   * @param {string} code - Error code for programmatic handling
   * @param {number} [statusCode] - HTTP status code
   * @param {unknown} [details] - Additional error details
   * @since 1.0.0
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
 * @since 1.0.0
 */
export interface PersistenceOptions {
  /**
   * Type of persistence backend
   * @since 1.0.0
   */
  type: 'filesystem' | 'redis' | 'postgres';
  
  /**
   * Backend-specific configuration
   * @since 1.0.0
   */
  config?: Record<string, unknown>;
}

/**
 * Standard async result type for error handling
 * @template T - Success data type
 * @template E - Error type (defaults to Error)
 * @since 1.0.0
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