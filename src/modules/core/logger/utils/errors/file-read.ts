/**
 * Logger file read error class.
 * @file Logger file read error class.
 * @module modules/core/logger/utils/errors/file-read
 */

import { LoggerErrorCodeEnum } from '@/modules/core/logger/types/index.js';
import { LoggerError } from '@/modules/core/logger/utils/errors/base.js';

/**
 * Error thrown when file read operations fail.
 * @class LoggerFileReadError
 * @augments {LoggerError}
 */
export class LoggerFileReadError extends LoggerError {
  /**
   * Create a new LoggerFileReadError instance.
   * @param {string} filename - Name of the file that failed to read.
   * @param {Error} [cause] - Original error cause.
   */
  constructor(filename: string, cause?: Error) {
    super('Failed to read log file: '.concat(filename), {
      code: LoggerErrorCodeEnum.FILE_READ_FAILED,
      statusCode: 500,
      ...cause !== undefined && { cause },
    });
    this.name = 'LoggerFileReadError';
  }
}
