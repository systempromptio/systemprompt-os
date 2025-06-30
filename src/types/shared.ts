/**
 * Shared type definitions used across multiple services
 */

/**
 * Session metrics tracking resource usage and performance
 */
export interface SessionMetrics {
  messageCount?: number;
  totalTokens?: number;
  toolCallCount?: number;
  averageResponseTime?: number;
  lastActivity?: number;
  totalSessions?: number;
  activeSessions?: number;
  errorSessions?: number;
  busySessions?: number;
  averageSessionDuration?: number;
  sessionsByType?: Record<string, number>;
}

/**
 * Base error class for service layer errors
 */
export class ServiceError extends Error {
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
 */
export interface PersistenceOptions {
  type: 'filesystem' | 'redis' | 'postgres';
  config?: Record<string, unknown>;
}

/**
 * Standard async result type
 */
export type AsyncResult<T, E = Error> = Promise<
  { success: true; data: T } | { success: false; error: E }
>;