/**
 * @fileoverview Custom error classes for the logger module
 * @module modules/core/logger/utils/errors
 */

import { LoggerErrorCode } from '@/modules/core/logger/types';

/**
 * Base error class for logger-related errors
 */
export class LoggerError extends Error {
  constructor(
    message: string,
    public readonly code: LoggerErrorCode,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'LoggerError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when logger initialization fails
 */
export class LoggerInitializationError extends LoggerError {
  constructor(message: string, cause?: Error) {
    super(
      `Logger initialization failed: ${message}`,
      LoggerErrorCode.INITIALIZATION_FAILED,
      500,
      cause
    );
    this.name = 'LoggerInitializationError';
  }
}

/**
 * Error thrown when file write operations fail
 */
export class LoggerFileWriteError extends LoggerError {
  constructor(filename: string, cause?: Error) {
    super(
      `Failed to write to log file: ${filename}`,
      LoggerErrorCode.FILE_WRITE_FAILED,
      500,
      cause
    );
    this.name = 'LoggerFileWriteError';
  }
}

/**
 * Error thrown when file read operations fail
 */
export class LoggerFileReadError extends LoggerError {
  constructor(filename: string, cause?: Error) {
    super(
      `Failed to read log file: ${filename}`,
      LoggerErrorCode.FILE_READ_FAILED,
      500,
      cause
    );
    this.name = 'LoggerFileReadError';
  }
}

/**
 * Error thrown when an invalid log level is provided
 */
export class InvalidLogLevelError extends LoggerError {
  constructor(level: string) {
    super(
      `Invalid log level: ${level}. Valid levels are: debug, info, warn, error`,
      LoggerErrorCode.INVALID_LOG_LEVEL,
      400
    );
    this.name = 'InvalidLogLevelError';
  }
}

/**
 * Error thrown when directory operations fail
 */
export class LoggerDirectoryError extends LoggerError {
  constructor(directory: string, cause?: Error) {
    super(
      `Failed to create or access log directory: ${directory}`,
      LoggerErrorCode.DIRECTORY_CREATE_FAILED,
      500,
      cause
    );
    this.name = 'LoggerDirectoryError';
  }
}