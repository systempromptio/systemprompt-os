/* eslint-disable require-unicode-regexp */
import { randomUUID } from 'crypto';
import { hostname } from 'os';
import {
  type ErrorCategory,
  ErrorCategoryMapping,
  type ErrorSeverity,
  type IErrorContext,
  type IErrorHandlingConfig,
  type IErrorHandlingOptions,
  type IProcessedError,
} from '@/modules/core/logger/types/manual';
import {
 type LogArgs, LogCategory, LogSource
} from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Service for centralized error handling and processing.
 */
export class ErrorHandlingService {
  private static instance: ErrorHandlingService | undefined;
  private readonly errorFingerprints: Map<string, number> = new Map();
  private readonly logger: LoggerService;
  private config: IErrorHandlingConfig;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.logger = LoggerService.getInstance();
    this.config = this.getDefaultConfig();
  }

  /**
   * Get the singleton instance.
   * @returns The singleton instance of ErrorHandlingService.
   */
  public static getInstance(): ErrorHandlingService {
    ErrorHandlingService.instance ??= new ErrorHandlingService();
    return ErrorHandlingService.instance;
  }

  /**
   * Configure the error handling service.
   * @param config - The configuration options to merge with existing config.
   */
  public configure(config: Partial<IErrorHandlingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Main error processing method.
   * @param source - The source identifier where the error originated.
   * @param error - The error to be processed.
   * @param options - Optional processing options.
   * @returns The processed error.
   * @throws {Error} When rethrow option is enabled and processed error is rethrown.
   */
  public processError(
    source: string,
    error: unknown,
    options?: Partial<IErrorHandlingOptions>,
  ): IProcessedError {
    const mergedOptions = {
      ...this.config.defaultOptions,
      ...options,
    };
    const context = this.buildErrorContext(source, mergedOptions);

    const processedError = this.structureError(error, context, mergedOptions);

    if ((mergedOptions.logToDatabase ?? false) || (mergedOptions.logToFile ?? false)) {
      this.sanitizeError(processedError);
    }

    this.trackErrorOccurrence(processedError);

    this.logError(processedError, mergedOptions);

    if (mergedOptions.rethrow ?? false) {
      throw this.createRethrowError(processedError);
    }

    return processedError;
  }

  /**
   * Categorize error based on type and content.
   * @param error - The error to categorize.
   * @returns The determined error category.
   */
  public categorizeError(error: unknown): ErrorCategory {
    if (!(error instanceof Error)) {
      return 'UNKNOWN';
    }

    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    return this.determineErrorCategory(message, name);
  }

  /**
   * Determine error severity.
   * @param error - The error to analyze (unused but kept for interface compatibility).
   * @param _error
   * @param category - The error category.
   * @returns The determined error severity.
   */
  public determineErrorSeverity(_error: unknown, category: ErrorCategory): ErrorSeverity {
    if (category === 'SYSTEM' || category === 'DATABASE') {
      return 'error';
    }

    if (category === 'AUTHENTICATION' || category === 'AUTHORIZATION') {
      return 'warn';
    }

    if (category === 'VALIDATION' || category === 'BUSINESS_LOGIC') {
      return 'info';
    }

    return 'warn';
  }

  /**
   * Determine error category based on message and name patterns.
   * @param message - The lowercase error message.
   * @param name - The lowercase error name.
   * @returns The determined error category.
   */
  private determineErrorCategory(message: string, name: string): ErrorCategory {
    if (this.isAuthenticationError(message, name)) {
      return 'AUTHENTICATION';
    }

    if (this.isAuthorizationError(message)) {
      return 'AUTHORIZATION';
    }

    if (this.isValidationError(message, name)) {
      return 'VALIDATION';
    }

    if (this.isDatabaseError(message, name)) {
      return 'DATABASE';
    }

    if (this.isExternalServiceError(message)) {
      return 'EXTERNAL_SERVICE';
    }

    if (this.isSystemError(message, name)) {
      return 'SYSTEM';
    }

    return 'UNKNOWN';
  }

  private isAuthenticationError(message: string, name: string): boolean {
    return message.includes('unauthorized') || message.includes('authentication') || name.includes('auth');
  }

  private isAuthorizationError(message: string): boolean {
    return message.includes('forbidden') || message.includes('permission') || message.includes('access denied');
  }

  private isValidationError(message: string, name: string): boolean {
    return message.includes('validation') || message.includes('invalid') || name.includes('validation');
  }

  private isDatabaseError(message: string, name: string): boolean {
    return message.includes('database') || message.includes('sql') || message.includes('connection') || name.includes('sequelize');
  }

  private isExternalServiceError(message: string): boolean {
    return message.includes('api') || message.includes('service') || message.includes('timeout') || message.includes('network');
  }

  private isSystemError(message: string, name: string): boolean {
    return message.includes('system') || message.includes('memory') || message.includes('disk') || name.includes('system');
  }

  /**
   * Build error context.
   * @param source - The source identifier.
   * @param options - The error handling options.
   * @returns The built error context.
   */
  private buildErrorContext(source: string, options: IErrorHandlingOptions): IErrorContext {
    return {
      source,
      timestamp: new Date(),
      environment: process.env.NODE_ENV ?? 'development',
      hostname: hostname(),
      pid: process.pid,
      requestId: this.extractStringFromMetadata(options.metadata?.requestId),
      userId: this.extractStringFromMetadata(options.metadata?.userId),
      sessionId: this.extractStringFromMetadata(options.metadata?.sessionId),
      correlationId:
        this.extractStringFromMetadata(options.metadata?.correlationId) ?? randomUUID(),
      metadata: options.metadata,
    };
  }

  /**
   * Extract string value from metadata field safely.
   * @param value - The metadata value to extract.
   * @returns String representation or undefined.
   */
  private extractStringFromMetadata(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return JSON.stringify(value);
  }

  /**
   * Structure unknown error into IProcessedError.
   * @param error - The error to structure.
   * @param context - The error context.
   * @param options - The error handling options.
   * @returns The structured processed error.
   */
  private structureError(
    error: unknown,
    context: IErrorContext,
    options: IErrorHandlingOptions,
  ): IProcessedError {
    const category = options.category ?? this.categorizeError(error);
    const severity = options.severity ?? this.determineErrorSeverity(error, category);

    const errorDetails = this.extractErrorDetails(error, options);
    const truncatedDetails = this.truncateErrorDetails(errorDetails);
    const fingerprint = this.generateFingerprint(
      truncatedDetails.message,
      truncatedDetails.type,
      context.source,
    );

    return {
      id: randomUUID(),
      message: truncatedDetails.message,
      code: truncatedDetails.code,
      type: truncatedDetails.type,
      category,
      logCategory: ErrorCategoryMapping[category],
      severity,
      stack: truncatedDetails.stack,
      context,
      originalError: error,
      sanitized: false,
      fingerprint,
      occurrences: this.errorFingerprints.get(fingerprint) ?? 0,
    };
  }

  /**
   * Extract error details from unknown error.
   * @param error - The error to extract details from.
   * @param options - The error handling options.
   * @returns Extracted error details.
   */
  private extractErrorDetails(error: unknown, options: IErrorHandlingOptions): {
    message: string;
    stack?: string;
    code?: string;
    type: string;
  } {
    if (error instanceof Error) {
      return this.extractErrorInstanceDetails(error, options);
    }

    if (typeof error === 'string') {
      return {
        message: error,
        type: 'StringError',
      };
    }

    if (error !== null && typeof error === 'object') {
      return this.extractObjectErrorDetails(error, options);
    }

    return {
      message: options.message ?? String(error),
      type: 'UnknownError',
    };
  }

  /**
   * Extract details from Error instance.
   * @param error - The Error instance.
   * @param options - The error handling options.
   * @returns Extracted error details.
   */
  private extractErrorInstanceDetails(error: Error, options: IErrorHandlingOptions): {
    message: string;
    stack?: string;
    code?: string;
    type: string;
  } {
    const result: {
      message: string;
      stack?: string;
      code?: string;
      type: string;
    } = {
      message: options.message ?? error.message,
      type: error.constructor.name,
    };

    if (error.stack !== undefined) {
      result.stack = error.stack;
    }

    if ('code' in error && typeof error.code === 'string') {
      result.code = error.code;
    }

    return result;
  }

  /**
   * Extract details from object error.
   * @param error - The object error.
   * @param options - The error handling options.
   * @returns Extracted error details.
   */
  private extractObjectErrorDetails(error: object, options: IErrorHandlingOptions): {
    message: string;
    type: string;
    code?: string;
  } {
    const result: {
      message: string;
      type: string;
      code?: string;
    } = {
      message: options.message ?? JSON.stringify(error),
      type: 'ObjectError',
    };

    if ('code' in error && typeof error.code === 'string') {
      result.code = error.code;
    }

    return result;
  }

  /**
   * Truncate error details if they exceed configured limits.
   * @param details - The error details to truncate.
   * @param details.message - The error message.
   * @param details.stack - The error stack trace.
   * @param details.code - The error code.
   * @param details.type - The error type.
   * @returns Truncated error details.
   */
  private truncateErrorDetails(details: {
    message: string;
    stack?: string;
    code?: string;
    type: string;
  }): {
    message: string;
    stack?: string;
    code?: string;
    type: string;
  } {
    const maxMessageLength = this.config.maxMessageLength ?? 0;
    const maxStackLength = this.config.maxStackLength ?? 0;

    let { message, stack } = details;

    if (maxMessageLength > 0 && message.length > maxMessageLength) {
      message = `${message.substring(0, maxMessageLength)}...`;
    }

    if (maxStackLength > 0 && stack !== undefined && stack.length > maxStackLength) {
      stack = `${stack.substring(0, maxStackLength)}...`;
    }

    const result = {
      ...details,
      message,
    } as typeof details & { message: string; stack?: string };

    if (stack !== undefined) {
      result.stack = stack;
    }

    return result;
  }

  /**
   * Sanitize sensitive information from error.
   * @param error - The processed error to sanitize.
   */
  private sanitizeError(error: IProcessedError): void {
    const patterns = this.config.sanitizePatterns ?? [
      /password["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
      /token["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
      /api[_-]?key["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
      /secret["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
      /authorization["\s]*[:=]["\s]*["']?Bearer\s+[^"'\s,}]+/gi,
    ];

    patterns.forEach((pattern: RegExp): void => {
      error.message = error.message.replace(pattern, '[REDACTED]');
      if (error.stack !== undefined) {
        error.stack = error.stack.replace(pattern, '[REDACTED]');
      }
    });

    error.sanitized = true;
  }

  /**
   * Generate error fingerprint for deduplication.
   * @param message - The error message.
   * @param type - The error type.
   * @param source - The error source.
   * @returns The generated fingerprint.
   */
  private generateFingerprint(message: string, type: string, source: string): string {
    const normalized = message
      .replace(/\d+/g, 'N')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
      .replace(/\S+@\S+/g, 'EMAIL')
      .substring(0, 100);

    return `${type}:${source}:${normalized}`;
  }

  /**
   * Track error occurrences.
   * @param error - The processed error to track.
   */
  private trackErrorOccurrence(error: IProcessedError): void {
    const count = this.errorFingerprints.get(error.fingerprint) ?? 0;
    this.errorFingerprints.set(error.fingerprint, count + 1);
    error.occurrences = count + 1;
  }

  /**
   * Log the processed error.
   * @param error - The processed error to log.
   * @param options - The error handling options.
   */
  private logError(error: IProcessedError, options: IErrorHandlingOptions): void {
    const logSource = options.logSource ?? LogSource.SYSTEM;
    const logArgs: LogArgs = {
      category: options.logCategory ?? error.logCategory,
      persistToDb: options.logToDatabase ?? true,
      error: error.originalError instanceof Error ? error.originalError : undefined,
      requestId: error.context.requestId,
      userId: error.context.userId,
      sessionId: error.context.sessionId,
      data: {
        errorId: error.id,
        errorType: error.type,
        errorCode: error.code,
        errorCategory: error.category,
        source: error.context.source,
        fingerprint: error.fingerprint,
        occurrences: error.occurrences,
        ...error.context.metadata,
      },
    };

    switch (error.severity) {
      case 'error':
        this.logger.error(logSource, error.message, logArgs);
        break;
      case 'warn':
        this.logger.warn(logSource, error.message, logArgs);
        break;
      case 'info':
        this.logger.info(logSource, error.message, logArgs);
        break;
      case 'debug':
        this.logger.debug(logSource, error.message, logArgs);
        break;
    }
  }

  /**
   * Create error for rethrowing.
   * @param processedError - The processed error to create a throwable error from.
   * @returns The created error for rethrowing.
   */
  private createRethrowError(processedError: IProcessedError): Error {
    const {
 message, type, stack
} = processedError;
    const error = new Error(message);
    error.name = type;
    if (stack !== undefined && stack.length > 0) {
      error.stack = stack;
    }
    Object.assign(error, {
      errorId: processedError.id,
      code: processedError.code,
    });
    return error;
  }

  /**
   * Get default configuration.
   * @returns The default error handling configuration.
   */
  private getDefaultConfig(): IErrorHandlingConfig {
    return {
      defaultOptions: {
        rethrow: true,
        severity: 'error',
        logToDatabase: true,
        logToConsole: true,
        logToFile: true,
        notify: false,
        logSource: LogSource.SYSTEM,
        logCategory: LogCategory.ERROR,
      },
      captureAsyncErrors: true,
      captureUnhandledRejections: true,
      maxMessageLength: 1000,
      maxStackLength: 5000,
      sanitizePatterns: [
        /password["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
        /token["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
        /api[_-]?key["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
        /secret["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
        /authorization["\s]*[:=]["\s]*["']?Bearer\s+[^"'\s,}]+/gi,
      ],
    };
  }
}
