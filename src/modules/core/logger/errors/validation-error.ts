import { ApplicationError } from '@/modules/core/logger/errors/application-error';

/**
 * Error thrown when input validation fails.
 */
export class ValidationError extends ApplicationError {
  constructor(
    message: string,
    options?: {
      code?: string;
      field?: string;
      value?: unknown;
      constraints?: string[];
      metadata?: Record<string, unknown>;
    }
  ) {
    super(message, 'VALIDATION', {
      code: options?.code || 'VALIDATION_ERROR',
      statusCode: 400,
      metadata: {
        field: options?.field,
        value: options?.value,
        constraints: options?.constraints,
        ...options?.metadata
      }
    });
  }
}
