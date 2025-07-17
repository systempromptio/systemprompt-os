/**
 * @fileoverview API error type definitions and error classes
 * @module types/api/errors
 */

import { z } from 'zod';

/**
 * Base application error class with structured error information
 * @class
 * @extends {Error}
 */
export class AppError extends Error {
  /**
   * Error code for programmatic handling
   */
  public readonly code: string;
  
  /**
   * HTTP status code
   */
  public readonly statusCode: number;
  
  /**
   * Additional error details
   */
  public readonly details?: unknown;
  
  /**
   * Whether this error is operational (expected) vs programming error
   */
  public readonly isOperational: boolean;

  /**
   * Creates a new application error
   * @param {string} message - Human-readable error message
   * @param {string} code - Error code for programmatic handling
   * @param {number} [statusCode=500] - HTTP status code
   * @param {unknown} [details] - Additional error details
   * @param {boolean} [isOperational=true] - Whether error is operational
   */
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serializes error to JSON format
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      stack: this.stack
    };
  }
}

/**
 * Validation error with field-level error details
 * @class
 * @extends {AppError}
 */
export class ValidationError extends AppError {
  /**
   * Field-level validation errors
   */
  public readonly errors: FieldValidationError[];

  /**
   * Creates a validation error
   * @param {FieldValidationError[]} errors - Field validation errors
   * @param {string} [message='Validation failed'] - Error message
   */
  constructor(errors: FieldValidationError[], message: string = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', 400, { errors }, true);
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Field-level validation error details
 * @interface
 */
export interface FieldValidationError {
  /**
   * Field path that failed validation
   */
  readonly field: string;
  
  /**
   * Validation error message
   */
  readonly message: string;
  
  /**
   * The invalid value that was provided
   */
  readonly value?: unknown;
  
  /**
   * Validation constraint that failed
   */
  readonly constraint?: string;
}

/**
 * Authentication error for unauthenticated requests
 * @class
 * @extends {AppError}
 */
export class AuthenticationError extends AppError {
  /**
   * Creates an authentication error
   * @param {string} [message='Authentication required'] - Error message
   * @param {unknown} [details] - Additional error details
   */
  constructor(message: string = 'Authentication required', details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', 401, details, true);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization error for insufficient permissions
 * @class
 * @extends {AppError}
 */
export class AuthorizationError extends AppError {
  /**
   * Creates an authorization error
   * @param {string} [message='Insufficient permissions'] - Error message
   * @param {unknown} [details] - Additional error details
   */
  constructor(message: string = 'Insufficient permissions', details?: unknown) {
    super(message, 'AUTHORIZATION_ERROR', 403, details, true);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Not found error for missing resources
 * @class
 * @extends {AppError}
 */
export class NotFoundError extends AppError {
  /**
   * Creates a not found error
   * @param {string} resource - Resource type that was not found
   * @param {string} [identifier] - Resource identifier
   */
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, identifier }, true);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict error for resource conflicts
 * @class
 * @extends {AppError}
 */
export class ConflictError extends AppError {
  /**
   * Creates a conflict error
   * @param {string} message - Error message describing the conflict
   * @param {unknown} [details] - Additional error details
   */
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, details, true);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Rate limit error for throttled requests
 * @class
 * @extends {AppError}
 */
export class RateLimitError extends AppError {
  /**
   * Seconds until the client can retry
   */
  public readonly retryAfter?: number;

  /**
   * Creates a rate limit error
   * @param {string} [message='Rate limit exceeded'] - Error message
   * @param {number} [retryAfter] - Seconds until retry is allowed
   */
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter }, true);
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * External service error for third-party service failures
 * @class
 * @extends {AppError}
 */
export class ExternalServiceError extends AppError {
  /**
   * Name of the external service that failed
   */
  public readonly service: string;
  
  /**
   * Original error from the external service
   */
  public readonly originalError?: unknown;

  /**
   * Creates an external service error
   * @param {string} service - Name of the external service
   * @param {string} message - Error message
   * @param {unknown} [originalError] - Original error object
   */
  constructor(service: string, message: string, originalError?: unknown) {
    super(
      `External service error (${service}): ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      { service, originalError },
      true
    );
    this.service = service;
    this.originalError = originalError;
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * Timeout error for operations that exceed time limits
 * @class
 * @extends {AppError}
 */
export class TimeoutError extends AppError {
  /**
   * Timeout duration in milliseconds
   */
  public readonly timeout: number;

  /**
   * Creates a timeout error
   * @param {string} operation - Name of the operation that timed out
   * @param {number} timeout - Timeout duration in milliseconds
   */
  constructor(operation: string, timeout: number) {
    super(
      `Operation '${operation}' timed out after ${timeout}ms`,
      'TIMEOUT',
      504,
      { operation, timeout },
      true
    );
    this.timeout = timeout;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Internal server error for unexpected failures
 * @class
 * @extends {AppError}
 */
export class InternalError extends AppError {
  /**
   * Creates an internal error
   * @param {string} [message='An internal error occurred'] - Error message
   * @param {unknown} [details] - Additional error details
   */
  constructor(message: string = 'An internal error occurred', details?: unknown) {
    super(message, 'INTERNAL_ERROR', 500, details, false);
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

/**
 * Zod schema for error codes
 */
export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMIT_EXCEEDED',
  'EXTERNAL_SERVICE_ERROR',
  'TIMEOUT',
  'INTERNAL_ERROR',
  'UNKNOWN_ERROR'
]);

/**
 * Valid error codes
 */
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * Zod schema for app error structure
 */
export const AppErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  statusCode: z.number(),
  details: z.unknown().optional(),
  isOperational: z.boolean()
});

/**
 * Type guard to check if error is an AppError
 * @param {unknown} error - Error to check
 * @returns {error is AppError} True if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is a ValidationError
 * @param {unknown} error - Error to check
 * @returns {error is ValidationError} True if error is ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if error is an AuthenticationError
 * @param {unknown} error - Error to check
 * @returns {error is AuthenticationError} True if error is AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Type guard to check if error is an AuthorizationError
 * @param {unknown} error - Error to check
 * @returns {error is AuthorizationError} True if error is AuthorizationError
 */
export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

/**
 * Type guard to check if error is a NotFoundError
 * @param {unknown} error - Error to check
 * @returns {error is NotFoundError} True if error is NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Type guard to check if error is a RateLimitError
 * @param {unknown} error - Error to check
 * @returns {error is RateLimitError} True if error is RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Converts any error to an AppError
 * @param {unknown} error - Error to convert
 * @returns {AppError} Converted AppError instance
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message, { originalError: error });
  }

  return new InternalError('An unknown error occurred', { originalError: error });
}

/**
 * Creates a ValidationError from a Zod validation error
 * @param {z.ZodError} zodError - Zod validation error
 * @returns {ValidationError} Converted validation error
 */
export function createErrorFromZodError(zodError: z.ZodError): ValidationError {
  const errors: FieldValidationError[] = zodError.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    value: undefined,
    constraint: err.code
  }));

  return new ValidationError(errors);
}