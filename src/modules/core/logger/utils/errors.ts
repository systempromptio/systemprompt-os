/**
 * Re-export all error classes for backward compatibility.
 * @file Re-export all error classes for backward compatibility.
 * @module modules/core/logger/utils/errors
 */

export { LoggerError } from '@/modules/core/logger/utils/logger-error-base.js';
export {
  LoggerInitializationError,
} from '@/modules/core/logger/utils/logger-initialization-error.js';
export { LoggerFileWriteError } from '@/modules/core/logger/utils/logger-file-write-error.js';
export { LoggerFileReadError } from '@/modules/core/logger/utils/logger-file-read-error.js';
export { InvalidLogLevelError } from '@/modules/core/logger/utils/invalid-log-level-error.js';
export { LoggerDirectoryError } from '@/modules/core/logger/utils/logger-directory-error.js';
