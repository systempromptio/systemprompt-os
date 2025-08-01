/**
 * Re-export all error classes for backward compatibility.
 * @file Re-export all error classes for backward compatibility.
 * @module modules/core/logger/utils/errors
 */

export { LoggerError } from './logger-error-base';
export {
  LoggerInitializationError,
} from './logger-initialization-error';
export { LoggerFileWriteError } from './logger-file-write-error';
export { LoggerFileReadError } from './logger-file-read-error';
export { InvalidLogLevelError } from './invalid-log-level-error';
export { LoggerDirectoryError } from './logger-directory-error';
