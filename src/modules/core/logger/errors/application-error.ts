import type { ErrorCategory } from '@/modules/core/logger/types/error-handling.types';
import { ErrorCategoryMapping } from '@/modules/core/logger/types/error-handling.types';
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
    this.name = this.constructor.name;
    this.category = category;
    this.logCategory = ErrorCategoryMapping[category];
    this.code = options?.code;
    this.statusCode = options?.statusCode;
    this.timestamp = new Date();
    this.metadata = options?.metadata;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    if (options?.cause) {
      (this as any).cause = options.cause;
    }
  }

  /**
   * Convert error to JSON representation.
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
}
