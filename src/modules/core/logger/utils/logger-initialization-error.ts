/**
 * Logger initialization error class.
 * @file Logger initialization error class.
 * @module modules/core/logger/utils/logger-initialization-error
 */

import { LoggerErrorCodeEnum } from '@/modules/core/logger/types/index';
import { LoggerError } from '@/modules/core/logger/utils/logger-error-base';

/**
 * Error thrown when logger initialization fails.
 * @class LoggerInitializationError
 * @augments {LoggerError}
 */
export class LoggerInitializationError extends LoggerError {
  /**
   * Create a new LoggerInitializationError instance.
   * @param {string} message - Error message.
   * @param {Error} [cause] - Original error cause.
   */
  constructor(message: string, cause?: Error) {
    super('Logger initialization failed: '.concat(message), {
      code: LoggerErrorCodeEnum.INITIALIZATION_FAILED,
      statusCode: 500,
      ...cause !== undefined && { cause },
    });
    this.name = 'LoggerInitializationError';
  }
}
