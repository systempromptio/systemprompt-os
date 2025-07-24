/**
 * Logger directory error class.
 * @file Logger directory error class.
 * @module modules/core/logger/utils/errors/directory
 */

import { LoggerErrorCodeEnum } from '@/modules/core/logger/types/index.js';
import { LoggerError } from '@/modules/core/logger/utils/errors/base.js';

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
