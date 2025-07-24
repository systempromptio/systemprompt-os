/**
 * Log levels supported by the logger.
 */
export interface ILogLevel {
    debug: number;
    info: number;
    warn: number;

  error: number;
}

/**
 * Valid log level names.
 */
export type LogLevelName = keyof ILogLevel;

/**
 * Log output types.
 */
export type LogOutput = 'console' | 'file';

/**
 * Configuration for log files.
 */
export interface ILogFiles {
    system: string;

  error: string;
    access: string;
}

/**
 * Logger configuration.
 */
export interface ILoggerConfig {
    stateDir: string;
    logLevel: LogLevelName;
    maxSize: string;
    maxFiles: number;
    outputs: LogOutput[];
    files: ILogFiles;
}

/**
 * Logger service interface.
 */
export interface ILogger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    addLog(level: string, message: string, ...args: unknown[]): void;
    clearLogs(logFile?: string): Promise<void>;
    getLogs(logFile?: string): Promise<string[]>;
}

/**
 * Logger context for structured logging.
 */
export interface ILogContext {
    module?: string;
    action?: string;
    userId?: string;
    requestId?: string;
    timestamp?: string;
    [key: string]: unknown;
}

/**
 * Log entry structure.
 */
export interface ILogEntry {
    timestamp: string;
    level: string;

  message: string;
    context?: ILogContext;
    args?: unknown[];
}

/**
 * Cache entry for log operations.
 */
export interface ICacheEntry {
    logData: string[];
    timestamp: number;
}

/**
 * Logger error types.
 */
export const enum LoggerErrorCodeEnum {
  /**
   * Initialization failed.
   */
  INITIALIZATION_FAILED = 'LOGGER_INIT_FAILED',
  /**
   * File write failed.
   */
  FILE_WRITE_FAILED = 'LOGGER_FILE_WRITE_FAILED',
  /**
   * File read failed.
   */
  FILE_READ_FAILED = 'LOGGER_FILE_READ_FAILED',
  /**
   * Invalid log level.
   */
  INVALID_LOG_LEVEL = 'LOGGER_INVALID_LOG_LEVEL',
  /**
   * Directory creation failed.
   */
  DIRECTORY_CREATE_FAILED = 'LOGGER_DIR_CREATE_FAILED',
}
