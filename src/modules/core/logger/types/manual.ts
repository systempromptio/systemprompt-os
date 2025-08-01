/*
 * =================================
 * Core Logger Types
 * =================================
 */

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
  CONFIG = 'config',
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
  USERS = 'users',
  TASKS = 'tasks',
  TEST = 'test'
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
 * Log entry structure for in-memory processing.
 */
export interface ILogEntryStructure {
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

/**
 * Options for clearing logs command.
 */
export interface IClearLogsOptions {
  level?: string;
  olderThan?: string;
  confirm?: boolean;
  dryRun?: boolean;
}

/*
 * =================================
 * Log Entry Types
 * =================================
 */

/**
 * Represents a log entry from the database.
 */
export interface ILogEntry {
  id: number;
  level: string;
  message: string;
  args: string | null;
  module: string | null;
  timestamp: string;
  session_id: string | null;
  user_id: string | null;
}

/**
 * Options for showing logs command.
 */
export interface IShowLogsOptions {
  limit?: number;
  level?: string;
  module?: string;
  since?: string;
  pager?: boolean;
  format?: string;
}

/*
 * =================================
 * Error Handling Types
 * =================================
 */

/**
 * Error severity levels mapped to LogLevelName
 * Using existing logger levels instead of creating new enum.
 */
export type ErrorSeverity = Extract<LogLevelName, 'debug' | 'info' | 'warn' | 'error'>;

/**
 * Error categories mapped to existing LogCategory enum values
 * These map business errors to appropriate log categories.
 */
export const ErrorCategoryMapping = {
  VALIDATION: LogCategory.API,
  AUTHENTICATION: LogCategory.AUTHENTICATION,
  AUTHORIZATION: LogCategory.SECURITY,
  DATABASE: LogCategory.DATABASE,
  EXTERNAL_SERVICE: LogCategory.API,
  BUSINESS_LOGIC: LogCategory.USER_ACTION,
  SYSTEM: LogCategory.SYSTEM,
  CONFIGURATION: LogCategory.CONFIGURATION,
  UNKNOWN: LogCategory.ERROR
} as const;

export type ErrorCategory = keyof typeof ErrorCategoryMapping;

/**
 * Context information about where and when the error occurred.
 */
export interface IErrorContext {
  source: string;
  timestamp: Date;
  requestId?: string | undefined;
  userId?: string | undefined;
  sessionId?: string | undefined;
  correlationId?: string | undefined;
  environment?: string | undefined;
  hostname?: string | undefined;
  pid?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Standardized error structure after processing.
 */
export interface IProcessedError {
  id: string;
  message: string;
  code?: string | undefined;
  type: string;
  category: ErrorCategory;
  logCategory: LogCategory;
  severity: ErrorSeverity;
  stack?: string | undefined;
  context: IErrorContext;
  originalError: unknown;
  sanitized: boolean;
  fingerprint: string;
  occurrences?: number | undefined;
}

/**
 * Options for error handling behavior.
 */
export interface IErrorHandlingOptions {
    rethrow?: boolean | undefined;
    severity?: ErrorSeverity | undefined;
    category?: ErrorCategory | undefined;
    metadata?: Record<string, unknown> | undefined;
    logToDatabase?: boolean | undefined;
    logToConsole?: boolean | undefined;
    logToFile?: boolean | undefined;
    message?: string | undefined;
    notify?: boolean | undefined;
    logSource?: LogSource | undefined;
    logCategory?: LogCategory | undefined;
}

/**
 * Error handler function type.
 */
export type ErrorHandler = (
  source: string,
  error: unknown,
  options?: Partial<IErrorHandlingOptions>
) => void;

/**
 * Async error handler function type.
 */
export type AsyncErrorHandler = (
  source: string,
  error: unknown,
  options?: Partial<IErrorHandlingOptions>
) => Promise<void>;

/**
 * Error filter for determining if an error should be processed.
 */
export interface IErrorFilter {
    types?: string[] | undefined;
    patterns?: RegExp[] | undefined;
    severities?: ErrorSeverity[] | undefined;
    categories?: ErrorCategory[] | undefined;
    logCategories?: LogCategory[] | undefined;
}

/**
 * Configuration for the error handling service.
 */
export interface IErrorHandlingConfig {
    defaultOptions: IErrorHandlingOptions;
    ignoreFilters?: IErrorFilter[] | undefined;
    captureAsyncErrors?: boolean | undefined;
    captureUnhandledRejections?: boolean | undefined;
    maxMessageLength?: number | undefined;
    maxStackLength?: number | undefined;
    sanitizePatterns?: RegExp[] | undefined;
}

/*
 * =================================
 * Module Export Types
 * =================================
 */

/**
 * Strongly typed exports interface for Logger module.
 */
export interface ILoggerModuleExports {
  readonly service: () => ILogger;
  readonly getInstance: () => ILogger;
}
