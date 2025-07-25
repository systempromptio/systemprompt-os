import { ApplicationError } from '@/modules/core/logger/errors/application-error';

/**
 * Error thrown when authentication fails.
 */
export class AuthenticationError extends ApplicationError {
  constructor(
    message: string,
    options?: {
      code?: string;
      method?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    super(message, 'AUTHENTICATION', {
      code: options?.code || 'AUTHENTICATION_ERROR',
      statusCode: 401,
      metadata: {
        method: options?.method,
        ...options?.metadata
      }
    });
  }
}
