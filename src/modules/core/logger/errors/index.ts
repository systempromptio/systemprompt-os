/**
 * Export all error classes for centralized error handling.
 */
export { ApplicationError } from '@/modules/core/logger/errors/application-error';
export { ValidationError } from '@/modules/core/logger/errors/validation-error';
export { AuthenticationError } from '@/modules/core/logger/errors/authentication-error';
export { AuthorizationError } from '@/modules/core/logger/errors/authorization-error';
export { DatabaseError } from '@/modules/core/logger/errors/database-error';
export { ExternalServiceError } from '@/modules/core/logger/errors/external-service-error';
export { BusinessLogicError } from '@/modules/core/logger/errors/business-logic-error';
export { ConfigurationError } from '@/modules/core/logger/errors/configuration-error';
