/**
 * Logger directory error class.
 * @file Logger directory error class.
 * @module modules/core/logger/utils/logger-directory-error
 */

import { LoggerErrorCodeEnum } from '@/modules/core/logger/types/index';
import { LoggerError } from '@/modules/core/logger/utils/logger-error-base';

/**
 * Error thrown when directory operations fail.
 * @class LoggerDirectoryError
 * @augments {LoggerError}
 */
export class LoggerDirectoryError extends LoggerError {
  /**
   * Create a new LoggerDirectoryError instance.
   * @param {string} directory - The directory path that failed.
   * @param {Error} [cause] - Original error cause.
   */
  constructor(directory: string, cause?: Error) {
    super('Failed to create or access log directory: '.concat(directory), {
      code: LoggerErrorCodeEnum.DIRECTORY_CREATE_FAILED,
      statusCode: 500,
      ...cause !== undefined && { cause },
    });
    this.name = 'LoggerDirectoryError';
  }
}
