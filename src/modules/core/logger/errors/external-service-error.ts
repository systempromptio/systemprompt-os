import { ApplicationError } from '@/modules/core/logger/errors/application-error';

/**
 * Error thrown when external service calls fail.
 */
export class ExternalServiceError extends ApplicationError {
  constructor(
    message: string,
    options?: {
      code?: string;
      service?: string;
      endpoint?: string;
      statusCode?: number;
      responseBody?: unknown;
      cause?: unknown;
      metadata?: Record<string, unknown>;
    }
  ) {
    super(message, 'EXTERNAL_SERVICE', {
      code: options?.code || 'EXTERNAL_SERVICE_ERROR',
      statusCode: options?.statusCode || 502,
      cause: options?.cause,
      metadata: {
        service: options?.service,
        endpoint: options?.endpoint,
        responseStatusCode: options?.statusCode,
        responseBody: options?.responseBody,
        ...options?.metadata
      }
    });
  }
}
