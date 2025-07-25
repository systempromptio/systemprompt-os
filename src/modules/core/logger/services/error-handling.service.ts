import { randomUUID } from 'crypto';
import { hostname } from 'os';
import {
  ErrorCategoryMapping,
  type ErrorCategory,
  type ErrorSeverity,
  type IErrorContext,
  type IErrorHandlingConfig,
  type IErrorHandlingOptions,
  type IProcessedError,
} from '@/modules/core/logger/types/error-handling.types';
import { LogCategory, LogSource, type LogArgs } from '@/modules/core/logger/types';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Service for centralized error handling and processing.
 */
export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
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
   * @returns The singleton instance of ErrorHandlingService
   */
  public static getInstance(): ErrorHandlingService {
    ErrorHandlingService.instance ||= new ErrorHandlingService();
    return ErrorHandlingService.instance;
  }

  /**
   * Configure the error handling service.
   * @param config - The configuration options to merge with existing config
   */
  public configure(config: Partial<IErrorHandlingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Main error processing method.
   * @param source - The source identifier where the error originated
   * @param error - The error to be processed
   * @param options - Optional processing options
   * @returns Promise resolving to the processed error
   */
  public async processError(
    source: string,
    error: unknown,
    options?: Partial<IErrorHandlingOptions>,
  ): Promise<IProcessedError> {
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

    await this.logError(processedError, mergedOptions);

    if (mergedOptions.rethrow ?? false) {
      throw this.createRethrowError(processedError);
    }

    return processedError;
  }

  /**
   * Categorize error based on type and content.
   * @param error - The error to categorize
   * @returns The determined error category
   */
  public categorizeError(error: unknown): ErrorCategory {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const name = error.name.toLowerCase();

      if (
        message.includes('unauthorized')
        || message.includes('authentication')
        || name.includes('auth')
      ) {
        return 'AUTHENTICATION';
      }

      if (
        message.includes('forbidden')
        || message.includes('permission')
        || message.includes('access denied')
      ) {
        return 'AUTHORIZATION';
      }

      if (
        message.includes('validation')
        || message.includes('invalid')
        || name.includes('validation')
      ) {
        return 'VALIDATION';
      }

      if (
        message.includes('database')
        || message.includes('sql')
        || message.includes('connection')
        || name.includes('sequelize')
      ) {
        return 'DATABASE';
      }

      if (
        message.includes('api')
        || message.includes('service')
        || message.includes('timeout')
        || message.includes('network')
      ) {
        return 'EXTERNAL_SERVICE';
      }

      if (
        message.includes('system')
        || message.includes('memory')
        || message.includes('disk')
        || name.includes('system')
      ) {
        return 'SYSTEM';
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Determine error severity.
   * @param error - The error to analyze
   * @param category - The error category
   * @returns The determined error severity
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
   * Build error context.
   * @param source - The source identifier
   * @param options - The error handling options
   * @returns The built error context
   */
  private buildErrorContext(source: string, options: IErrorHandlingOptions): IErrorContext {
    return {
      source,
      timestamp: new Date(),
      environment: process.env.NODE_ENV ?? 'development',
      hostname: hostname(),
      pid: process.pid,
      requestId: options.metadata?.requestId as string,
      userId: options.metadata?.userId as string,
      sessionId: options.metadata?.sessionId as string,
      correlationId: (options.metadata?.correlationId as string) ?? randomUUID(),
      metadata: options.metadata,
    };
  }

  /**
   * Structure unknown error into IProcessedError.
   * @param error - The error to structure
   * @param context - The error context
   * @param options - The error handling options
   * @returns The structured processed error
   */
  private structureError(
    error: unknown,
    context: IErrorContext,
    options: IErrorHandlingOptions,
  ): IProcessedError {
    const category = options.category || this.categorizeError(error);
    const severity = options.severity || this.determineErrorSeverity(error, category);

    let message: string;
    let stack: string | undefined;
    let code: string | undefined;
    let type: string;

    if (error instanceof Error) {
      message = options.message || error.message;
      stack = error.stack;
      type = error.constructor.name;
      code = (error as any).code;
    } else if (typeof error === 'string') {
      message = error;
      type = 'StringError';
    } else if (error && typeof error === 'object') {
      message = options.message || JSON.stringify(error);
      type = 'ObjectError';
      code = (error as any).code;
    } else {
      message = options.message || String(error);
      type = 'UnknownError';
    }

    if ((this.config.maxMessageLength ?? 0) > 0 && message.length > this.config.maxMessageLength) {
      message = `${message.substring(0, this.config.maxMessageLength)}...`;
    }

    if ((this.config.maxStackLength ?? 0) > 0 && stack !== undefined && stack.length > this.config.maxStackLength) {
      stack = `${stack.substring(0, this.config.maxStackLength)}...`;
    }

    const fingerprint = this.generateFingerprint(message, type, context.source);

    return {
      id: randomUUID(),
      message,
      code,
      type,
      category,
      logCategory: ErrorCategoryMapping[category],
      severity,
      stack,
      context,
      originalError: error,
      sanitized: false,
      fingerprint,
      occurrences: this.errorFingerprints.get(fingerprint) ?? 0,
    };
  }

  /**
   * Sanitize sensitive information from error.
   * @param error - The processed error to sanitize
   */
  private sanitizeError(error: IProcessedError): void {
    const patterns = this.config.sanitizePatterns || [
      /password["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
      /token["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
      /api[_-]?key["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
      /secret["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
      /authorization["\s]*[:=]["\s]*["']?Bearer\s+[^"'\s,}]+/gi,
    ];

    patterns.forEach((pattern) => {
      error.message = error.message.replace(pattern, '[REDACTED]');
      error.stack &&= error.stack.replace(pattern, '[REDACTED]');
    });

    error.sanitized = true;
  }

  /**
   * Generate error fingerprint for deduplication.
   * @param message - The error message
   * @param type - The error type
   * @param source - The error source
   * @returns The generated fingerprint
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
   * @param error - The processed error to track
   */
  private trackErrorOccurrence(error: IProcessedError): void {
    const count = this.errorFingerprints.get(error.fingerprint) ?? 0;
    this.errorFingerprints.set(error.fingerprint, count + 1);
    error.occurrences = count + 1;
  }

  /**
   * Log the processed error.
   * @param error - The processed error to log
   * @param options - The error handling options
   */
  private async logError(error: IProcessedError, options: IErrorHandlingOptions): Promise<void> {
    const logSource = options.logSource ?? LogSource.SYSTEM;
    const logArgs: LogArgs = {
      category: options.logCategory ?? error.logCategory,
      persistToDb: options.logToDatabase ?? true,
      error: error.originalError as Error,
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
   * @param processedError - The processed error to create a throwable error from
   * @returns The created error for rethrowing
   */
  private createRethrowError(processedError: IProcessedError): Error {
    const error = new Error(processedError.message);
    error.name = processedError.type;
    if (processedError.stack !== undefined && processedError.stack.length > 0) {
      error.stack = processedError.stack;
    }
    (error as any).errorId = processedError.id;
    (error as any).code = processedError.code;
    return error;
  }

  /**
   * Get default configuration.
   * @returns The default error handling configuration
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
