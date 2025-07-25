import { ApplicationError } from '@/modules/core/logger/errors/application-error';

/**
 * Error thrown when configuration is invalid or missing.
 */
export class ConfigurationError extends ApplicationError {
  constructor(
    message: string,
    options?: {
      code?: string;
      configKey?: string;
      configValue?: unknown;
      metadata?: Record<string, unknown>;
    }
  ) {
    super(message, 'CONFIGURATION', {
      code: options?.code || 'CONFIGURATION_ERROR',
      statusCode: 500,
      metadata: {
        configKey: options?.configKey,
        configValue: options?.configValue,
        ...options?.metadata
      }
    });
  }
}
