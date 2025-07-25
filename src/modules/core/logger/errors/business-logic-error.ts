import { ApplicationError } from '@/modules/core/logger/errors/application-error';

/**
 * Error thrown when business logic rules are violated.
 */
export class BusinessLogicError extends ApplicationError {
  constructor(
    message: string,
    options?: {
      code?: string;
      rule?: string;
      entity?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    super(message, 'BUSINESS_LOGIC', {
      code: options?.code || 'BUSINESS_LOGIC_ERROR',
      statusCode: 422,
      metadata: {
        rule: options?.rule,
        entity: options?.entity,
        ...options?.metadata
      }
    });
  }
}
