/**
 * Base error class for all auth-related errors.
 */
export class AuthError extends Error {
  constructor(
    override message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = 'AuthError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when authentication fails.
 */
export class AuthenticationError extends AuthError {
  constructor(message: string = 'Authentication failed', cause?: Error) {
    super(message, 'AUTH_FAILED', 401, cause);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when user is not authorized.
 */
export class AuthorizationError extends AuthError {
  constructor(message: string = 'Access denied', cause?: Error) {
    super(message, 'ACCESS_DENIED', 403, cause);
    this.name = 'AuthorizationError';
  }
}

/**
 * Error thrown when validation fails.
 */
export class ValidationError extends AuthError {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
    cause?: Error,
  ) {
    super(message, 'VALIDATION_ERROR', 400, cause);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when a resource is not found.
 */
export class NotFoundError extends AuthError {
  constructor(resource: string, identifier?: string, cause?: Error) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, cause);
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when a conflict occurs (e.g., duplicate resource).
 */
export class ConflictError extends AuthError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFLICT', 409, cause);
    this.name = 'ConflictError';
  }
}

/**
 * Error thrown when rate limit is exceeded.
 */
export class RateLimitError extends AuthError {
  constructor(
    public readonly retryAfter?: number,
    override message: string = 'Rate limit exceeded',
    override cause?: Error,
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, cause);
    this.name = 'RateLimitError';
  }
}

/**
 * Error thrown for invalid token operations.
 */
export class TokenError extends AuthError {
  constructor(message: string, code: string = 'INVALID_TOKEN', cause?: Error) {
    super(message, code, 401, cause);
    this.name = 'TokenError';
  }
}

/**
 * Error thrown when token has expired.
 */
export class TokenExpiredError extends TokenError {
  constructor(message: string = 'Token has expired', cause?: Error) {
    super(message, 'TOKEN_EXPIRED', cause);
    this.name = 'TokenExpiredError';
  }
}

/**
 * Error thrown when token is invalid.
 */
export class InvalidTokenError extends TokenError {
  constructor(message: string = 'Invalid token', cause?: Error) {
    super(message, 'INVALID_TOKEN', cause);
    this.name = 'InvalidTokenError';
  }
}

/**
 * Error thrown for MFA-related issues.
 */
export class MFAError extends AuthError {
  constructor(message: string, code: string = 'MFA_ERROR', cause?: Error) {
    super(message, code, 400, cause);
    this.name = 'MFAError';
  }
}

/**
 * Error thrown when MFA is required.
 */
export class MFARequiredError extends MFAError {
  constructor(
    public readonly sessionId: string,
    override message: string = 'MFA verification required',
    override cause?: Error,
  ) {
    super(message, 'MFA_REQUIRED', cause);
    this.name = 'MFARequiredError';
  }
}

/**
 * Error thrown when MFA code is invalid.
 */
export class InvalidMFACodeError extends MFAError {
  constructor(message: string = 'Invalid MFA code', cause?: Error) {
    super(message, 'INVALID_MFA_CODE', cause);
    this.name = 'InvalidMFACodeError';
  }
}

/**
 * Error thrown for provider-related issues.
 */
export class ProviderError extends AuthError {
  constructor(
    public readonly provider: string,
    override message: string,
    override code: string = 'PROVIDER_ERROR',
    override cause?: Error,
  ) {
    super(message, code, 500, cause);
    this.name = 'ProviderError';
  }
}

/**
 * Error thrown when provider is not configured.
 */
export class ProviderNotConfiguredError extends ProviderError {
  constructor(provider: string, cause?: Error) {
    super(provider, `Provider '${provider}' is not configured`, 'PROVIDER_NOT_CONFIGURED', cause);
    this.name = 'ProviderNotConfiguredError';
  }
}

/**
 * Error thrown for session-related issues.
 */
export class SessionError extends AuthError {
  constructor(message: string, code: string = 'SESSION_ERROR', cause?: Error) {
    super(message, code, 401, cause);
    this.name = 'SessionError';
  }
}

/**
 * Error thrown when session is invalid.
 */
export class InvalidSessionError extends SessionError {
  constructor(message: string = 'Invalid session', cause?: Error) {
    super(message, 'INVALID_SESSION', cause);
    this.name = 'InvalidSessionError';
  }
}

/**
 * Error thrown when session has expired.
 */
export class SessionExpiredError extends SessionError {
  constructor(message: string = 'Session has expired', cause?: Error) {
    super(message, 'SESSION_EXPIRED', cause);
    this.name = 'SessionExpiredError';
  }
}

/**
 * Error thrown when account is locked.
 */
export class AccountLockedError extends AuthError {
  constructor(
    public readonly lockoutEndTime?: Date,
    override message: string = 'Account is locked due to too many failed login attempts',
    override cause?: Error,
  ) {
    super(message, 'ACCOUNT_LOCKED', 423, cause);
    this.name = 'AccountLockedError';
  }
}

/**
 * Error thrown for configuration issues.
 */
export class ConfigurationError extends AuthError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', 500, cause);
    this.name = 'ConfigurationError';
  }
}
