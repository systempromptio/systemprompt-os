/**
 * Logger file write error class.
 * @file Logger file write error class.
 * @module modules/core/logger/utils/errors/file-write
 */

import { LoggerErrorCodeEnum } from '@/modules/core/logger/types/index.js';
import { LoggerError } from '@/modules/core/logger/utils/errors/base.js';

/**
 * Error thrown when file write operations fail.
 * @class LoggerFileWriteError
 * @augments {LoggerError}
 */
export class LoggerFileWriteError extends LoggerError {
  /**
   * Create a new LoggerFileWriteError instance.
   * @param {string} filename - Name of the file that failed to write.
   * @param {Error} [cause] - Original error cause.
   */
  constructor(filename: string, cause?: Error) {
    super('Failed to write to log file: '.concat(filename), {
      code: LoggerErrorCodeEnum.FILE_WRITE_FAILED,
      statusCode: 500,
      ...cause !== undefined && { cause },
    });
    this.name = 'LoggerFileWriteError';
  }
}
