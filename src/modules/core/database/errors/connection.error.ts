/**
 * Connection error class.
 * @file Connection error class.
 * @module database/errors/connection.error
 */

import { DatabaseError } from '@/modules/core/database/errors/base.error';

/**
 * Error thrown when database connection fails.
 */
export class ConnectionError extends DatabaseError {
  public readonly config?: { type: string; host?: string };

  /**
   * Creates a new connection error.
   * @param message - Error message.
   * @param config - Database configuration.
   * @param config.type
   * @param cause - Original error cause.
   * @param config.host
   */
  public constructor(
    message: string,
    config?: { type: string; host?: string },
    cause?: Error,
  ) {
    super(message, 'CONNECTION_ERROR', 503, cause);
    Object.defineProperty(this, 'name', {
 value: 'ConnectionError',
configurable: true
});
    if (config !== undefined) {
      this.config = config;
    }
  }
}
