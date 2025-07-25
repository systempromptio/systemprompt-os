import { ApplicationError } from '@/modules/core/logger/errors/application-error';

/**
 * Error thrown when database operations fail.
 */
export class DatabaseError extends ApplicationError {
  constructor(
    message: string,
    options?: {
      code?: string;
      operation?: string;
      table?: string;
      query?: string;
      cause?: unknown;
      metadata?: Record<string, unknown>;
    }
  ) {
    super(message, 'DATABASE', {
      code: options?.code || 'DATABASE_ERROR',
      statusCode: 500,
      cause: options?.cause,
      metadata: {
        operation: options?.operation,
        table: options?.table,
        query: options?.query,
        ...options?.metadata
      }
    });
  }
}
