/**
 * Invalid log level error class.
 * @file Invalid log level error class.
 * @module modules/core/logger/utils/invalid-log-level-error
 */

import { LoggerErrorCodeEnum } from '@/modules/core/logger/types/index.js';
import { LoggerError } from '@/modules/core/logger/utils/logger-error-base.js';

/**
 * Error thrown when an invalid log level is provided.
 * @class InvalidLogLevelError
 * @augments {LoggerError}
 */
export class InvalidLogLevelError extends LoggerError {
  /**
   * Create a new InvalidLogLevelError instance.
   * @param {string} level - The invalid log level provided.
   */
  constructor(level: string) {
    super('Invalid log level: '.concat(level, '. Valid levels are: debug, info, warn, error'), {
      code: LoggerErrorCodeEnum.INVALID_LOG_LEVEL,
      statusCode: 400,
    });
    this.name = 'InvalidLogLevelError';
  }
}
