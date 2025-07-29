/**
 * Query error class.
 * @file Query error class.
 * @module database/errors/query.error
 */

import { DatabaseError } from '@/modules/core/database/errors/base.error';

/**
 * Error thrown when a query fails to execute.
 */
export class QueryError extends DatabaseError {
  public readonly query?: string;
  public readonly params?: unknown[];

  /**
   * Creates a new query error.
   * @param message - Error message.
   * @param query - SQL query that failed.
   * @param params - Query parameters.
   * @param cause - Original error cause.
   */
  public constructor(
    message: string,
    query?: string,
    params?: unknown[],
    cause?: Error,
  ) {
    super(message, 'QUERY_ERROR', 500, cause);
    Object.defineProperty(this, 'name', {
 value: 'QueryError',
configurable: true
});
    if (query !== undefined) {
      this.query = query;
    }
    if (params !== undefined) {
      this.params = params;
    }
  }
}
