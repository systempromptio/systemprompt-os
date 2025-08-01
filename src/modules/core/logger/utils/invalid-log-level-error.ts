/**
 * Invalid log level error class.
 * @file Invalid log level error class.
 * @module modules/core/logger/utils/invalid-log-level-error
 */

import { LoggerErrorCodeEnum } from '../types/manual';
import { LoggerError } from './logger-error-base';

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
