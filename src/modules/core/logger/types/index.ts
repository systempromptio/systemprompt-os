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
 * Log sources for structured logging.
 */
export enum LogSource {
  AGENT = 'agent',
  BOOTSTRAP = 'bootstrap',
  CLI = 'cli',
  DATABASE = 'database',
  LOGGER = 'logger',
  AUTH = 'auth',
  MCP = 'mcp',
  SERVER = 'server',
  MODULES = 'modules',
  API = 'api',
  ACCESS = 'access',
  SCHEDULER = 'scheduler',
  SYSTEM = 'system',
  WEBHOOK = 'webhook',
  WORKFLOW = 'workflow',
  DEV = 'dev',
  EXECUTORS = 'executors',
  MONITOR = 'monitor',
  PERMISSIONS = 'permissions',
  USERS = 'users'
}

/**
 * Log output types.
 */
export enum LogOutput {
  CONSOLE = 'console',
  FILE = 'file',
  DATABASE = 'database'
}

/**
 * Logger modes for different contexts.
 */
export enum LoggerMode {
  CONSOLE = 'console',
  CLI = 'cli',
  SERVER = 'server'
}

/**
 * Configuration for log files.
 */
export interface ILogFiles {
    system: string;

  error: string;
    access: string;
}

/**
 * Database configuration for logging.
 */
export interface ILogDatabaseConfig {
    enabled: boolean;
    tableName?: string;
}

/**
 * Logger configuration.
 */
export interface ILoggerConfig {
    stateDir: string;
    logLevel: LogLevelName;
    mode?: LoggerMode;
    maxSize: string;
    maxFiles: number;
    outputs: LogOutput[];
    files: ILogFiles;
    database?: ILogDatabaseConfig;
}

/**
 * Log categories for better organization.
 */
export enum LogCategory {
    INITIALIZATION = 'init',
    AUTHENTICATION = 'auth',
    DATABASE = 'db',
    API = 'api',
    SECURITY = 'security',
    PERFORMANCE = 'perf',
    ERROR = 'error',
    SYSTEM = 'system',
    USER_ACTION = 'user',
    MODULE_LOAD = 'module',
    CONFIGURATION = 'config',
    HEALTH_CHECK = 'health'
}

export interface LogArgs {
    category?: LogCategory | string;
    persistToDb?: boolean;
    sessionId?: string | undefined;
    userId?: string | undefined;
    requestId?: string | undefined;
    module?: string | undefined;
    action?: string | undefined;
    error?: Error | string | undefined;
    duration?: number | undefined;
    status?: string | number | undefined;
    data?: Record<string, unknown> | undefined;
    [key: string]: unknown;
}

/**
 * Logger service interface with structured logging.
 */
export interface ILogger {
    debug(source: LogSource, message: string, args?: LogArgs): void;
    info(source: LogSource, message: string, args?: LogArgs): void;
    warn(source: LogSource, message: string, args?: LogArgs): void;
    error(source: LogSource, message: string, args?: LogArgs): void;
    log(level: LogLevelName, source: LogSource, message: string, args?: LogArgs): void;
    access(message: string): void;
    clearLogs(logFile?: string): Promise<void>;
    getLogs(logFile?: string): Promise<string[]>;
    setDatabaseService?(databaseService: any): void;
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
