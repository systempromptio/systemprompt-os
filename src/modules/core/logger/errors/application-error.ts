import {
  type ErrorCategory,
  ErrorCategoryMapping
} from '@/modules/core/logger/types/error-handling.types';
import type { LogCategory } from '@/modules/core/logger/types';

/**
 * Base class for all application errors
 * Provides consistent error structure and metadata.
 */
export abstract class ApplicationError extends Error {
  public readonly code?: string | undefined;
  public readonly statusCode?: number | undefined;
  public readonly category: ErrorCategory;
  public readonly logCategory: LogCategory;
  public readonly timestamp: Date;
  public readonly metadata?: Record<string, unknown> | undefined;

  /**
   * Constructor for ApplicationError.
   * @param message - Error message.
   * @param category - Error category.
   * @param options - Optional configuration.
   * @param options.code - Error code.
   * @param options.statusCode - HTTP status code.
   * @param options.cause - Original error cause.
   * @param options.metadata - Additional error metadata.
   */
  constructor(
    message: string,
    category: ErrorCategory,
    options?: {
      code?: string;
      statusCode?: number;
      cause?: unknown;
      metadata?: Record<string, unknown>;
    }
  ) {
    super(message);
    const { constructor: errorConstructor } = this;
    const { name } = errorConstructor;
    const { ErrorCategoryMapping: categoryMapping } = { ErrorCategoryMapping };
    const { [category]: logCategory } = categoryMapping;

    this.name = name;
    this.category = category;
    this.logCategory = logCategory;
    this.code = options?.code;
    this.statusCode = options?.statusCode;
    this.timestamp = new Date();
    this.metadata = options?.metadata;

    this.setupStackTrace();
    this.assignCause(options?.cause);
  }

  /**
   * Convert error to JSON representation.
   * @returns JSON representation of the error.
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      category: this.category,
      logCategory: this.logCategory,
      timestamp: this.timestamp,
      metadata: this.metadata,
      stack: this.stack
    };
  }

  /**
   * Setup stack trace if available.
   */
  private setupStackTrace(): void {
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Assign error cause if provided.
   * @param cause - Error cause.
   */
  private assignCause(cause?: unknown): void {
    if (cause !== null && cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        value: cause,
        writable: false,
        enumerable: false,
        configurable: true
      });
    }
  }
}
