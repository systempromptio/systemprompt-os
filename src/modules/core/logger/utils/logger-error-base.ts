/**
 * Base error class for the logger module.
 * @file Base error class for the logger module.
 * @module modules/core/logger/utils/logger-error-base
 */

import type { LoggerErrorCodeEnum } from '@/modules/core/logger/types/index.js';

/**
 * Base error class for logger-related errors.
 * @class LoggerError
 * @augments {Error}
 */
export class LoggerError extends Error {
  /**
   * Error code.
   */
  public readonly code: LoggerErrorCodeEnum;
  public readonly statusCode?: number;
  public override readonly cause?: Error;

  /**
   * Create a new LoggerError instance.
   * @param {string} message - Error message.
   * @param {Object} options - Error options.
   * @param {LoggerErrorCodeEnum} options.code - Error code.
   * @param {number} [options.statusCode] - HTTP status code.
   * @param {Error} [options.cause] - Original error cause.
   */
  constructor(
    override message: string,
    options: {
            code: LoggerErrorCodeEnum;
            statusCode?: number;
            cause?: Error;
    },
  ) {
    super(message);
    this.name = 'LoggerError';
    const {
 code, statusCode, cause
} = options;
    this.code = code;
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
    if (cause !== undefined) {
      this.cause = cause;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}
