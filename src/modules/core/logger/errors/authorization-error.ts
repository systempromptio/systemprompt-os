import { ApplicationError } from '@/modules/core/logger/errors/application-error';

/**
 * Error thrown when authorization/permission check fails.
 */
export class AuthorizationError extends ApplicationError {
  constructor(
    message: string,
    options?: {
      code?: string;
      resource?: string;
      action?: string;
      requiredPermissions?: string[];
      metadata?: Record<string, unknown>;
    }
  ) {
    super(message, 'AUTHORIZATION', {
      code: options?.code || 'AUTHORIZATION_ERROR',
      statusCode: 403,
      metadata: {
        resource: options?.resource,
        action: options?.action,
        requiredPermissions: options?.requiredPermissions,
        ...options?.metadata
      }
    });
  }
}
