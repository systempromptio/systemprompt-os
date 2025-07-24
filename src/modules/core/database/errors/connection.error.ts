/**
 * Connection error class.
 * @file Connection error class.
 * @module database/errors/connection.error
 */

import { DatabaseError } from '@/modules/core/database/errors/base.error';
import { HTTP_503 } from '@/modules/core/database/constants/index.js';

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
    super(message, 'CONNECTION_ERROR', HTTP_503, cause);
    this.name = 'ConnectionError';
    this.config = config;
  }
}
