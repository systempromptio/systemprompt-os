/**
 * @fileoverview Type definitions for the logger module
 * @module modules/core/logger/types
 */

/**
 * Log levels supported by the logger
 */
export interface LogLevel {
  debug: number;
  info: number;
  warn: number;
  error: number;
}

/**
 * Valid log level names
 */
export type LogLevelName = keyof LogLevel;

/**
 * Log output types
 */
export type LogOutput = 'console' | 'file';

/**
 * Configuration for log files
 */
export interface LogFiles {
  system: string;
  error: string;
  access: string;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  stateDir: string;
  logLevel: LogLevelName;
  maxSize: string;
  maxFiles: number;
  outputs: LogOutput[];
  files: LogFiles;
}

/**
 * Logger service interface
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  addLog(level: string, message: string, ...args: unknown[]): void;
  clearLogs(logFile?: string): Promise<void>;
  getLogs(logFile?: string): Promise<string[]>;
}

/**
 * Logger context for structured logging
 */
export interface LogContext {
  module?: string;
  action?: string;
  userId?: string;
  requestId?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  args?: unknown[];
}

/**
 * Cache entry for log operations
 */
export interface CacheEntry {
  data: string[];
  timestamp: number;
}

/**
 * Logger error types
 */
export enum LoggerErrorCode {
  INITIALIZATION_FAILED = 'LOGGER_INIT_FAILED',
  FILE_WRITE_FAILED = 'LOGGER_FILE_WRITE_FAILED',
  FILE_READ_FAILED = 'LOGGER_FILE_READ_FAILED',
  INVALID_LOG_LEVEL = 'LOGGER_INVALID_LOG_LEVEL',
  DIRECTORY_CREATE_FAILED = 'LOGGER_DIR_CREATE_FAILED',
}

/**
 * Re-export Logger interface for backward compatibility
 */
export type ILogger = Logger;

/**
 * Dependency injection token for logger
 */
import { Token } from 'typedi';
export const LOGGER_TOKEN = new Token<ILogger>('core.logger');