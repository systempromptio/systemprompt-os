import type { LogLevelName, LogSource } from '@/modules/core/logger/types/index';
import { LogCategory} from '@/modules/core/logger/types/index';

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
