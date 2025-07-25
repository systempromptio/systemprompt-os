/**
 *
 * AuthError class.
 *
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
 *
 * AuthenticationError class.
 *
 */

export class AuthenticationError extends AuthError {
  constructor(message: string = 'Authentication failed', cause?: Error) {
    super(message, 'AUTH_FAILED', 401, cause);
  }
}

/**
 *
 * AuthorizationError class.
 *
 */

export class AuthorizationError extends AuthError {
  constructor(message: string = 'Access denied', cause?: Error) {
    super(message, 'ACCESS_DENIED', 403, cause);
  }
}

/**
 *
 * ValidationError class.
 *
 */

export class ValidationError extends AuthError {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
    cause?: Error,
  ) {
    super(message, 'VALIDATION_ERROR', 400, cause);
  }
}

/**
 *
 * NotFoundError class.
 *
 */

export class NotFoundError extends AuthError {
  constructor(resource: string, identifier?: string, cause?: Error) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, cause);
  }
}

/**
 *
 * ConflictError class.
 *
 */

export class ConflictError extends AuthError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFLICT', 409, cause);
  }
}

/**
 *
 * RateLimitError class.
 *
 */

export class RateLimitError extends AuthError {
  constructor(
    public readonly retryAfter?: number,
    override message: string = 'Rate limit exceeded',
    override cause?: Error,
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, cause);
  }
}

/**
 *
 * TokenError class.
 *
 */

export class TokenError extends AuthError {
  constructor(message: string, code: string = 'INVALID_TOKEN', cause?: Error) {
    super(message, code, 401, cause);
  }
}

/**
 *
 * TokenExpiredError class.
 *
 */

export class TokenExpiredError extends TokenError {
  constructor(message: string = 'Token has expired', cause?: Error) {
    super(message, 'TOKEN_EXPIRED', cause);
  }
}

/**
 *
 * InvalidTokenError class.
 *
 */

export class InvalidTokenError extends TokenError {
  constructor(message: string = 'Invalid token', cause?: Error) {
    super(message, 'INVALID_TOKEN', cause);
  }
}

/**
 *
 * MFAError class.
 *
 */

export class MFAError extends AuthError {
  constructor(message: string, code: string = 'MFA_ERROR', cause?: Error) {
    super(message, code, 400, cause);
  }
}

/**
 *
 * MFARequiredError class.
 *
 */

export class MFARequiredError extends MFAError {
  constructor(
    public readonly sessionId: string,
    message: string = 'MFA verification required',
    cause?: Error,
  ) {
    super(message, 'MFA_REQUIRED', cause);
  }
}

/**
 *
 * InvalidMFACodeError class.
 *
 */

export class InvalidMFACodeError extends MFAError {
  constructor(message: string = 'Invalid MFA code', cause?: Error) {
    super(message, 'INVALID_MFA_CODE', cause);
  }
}

/**
 *
 * ProviderError class.
 *
 */

export class ProviderError extends AuthError {
  constructor(
    public readonly provider: string,
    message: string,
    code: string = 'PROVIDER_ERROR',
    cause?: Error,
  ) {
    super(message, code, 500, cause);
  }
}

/**
 *
 * ProviderNotConfiguredError class.
 *
 */

export class ProviderNotConfiguredError extends ProviderError {
  constructor(provider: string, cause?: Error) {
    super(provider, `Provider '${provider}' is not configured`, 'PROVIDER_NOT_CONFIGURED', cause);
  }
}

/**
 *
 * SessionError class.
 *
 */

export class SessionError extends AuthError {
  constructor(message: string, code: string = 'SESSION_ERROR', cause?: Error) {
    super(message, code, 401, cause);
  }
}

/**
 *
 * InvalidSessionError class.
 *
 */

export class InvalidSessionError extends SessionError {
  constructor(message: string = 'Invalid session', cause?: Error) {
    super(message, 'INVALID_SESSION', cause);
  }
}

/**
 *
 * SessionExpiredError class.
 *
 */

export class SessionExpiredError extends SessionError {
  constructor(message: string = 'Session has expired', cause?: Error) {
    super(message, 'SESSION_EXPIRED', cause);
  }
}

/**
 *
 * AccountLockedError class.
 *
 */

export class AccountLockedError extends AuthError {
  constructor(
    public readonly lockoutEndTime?: Date,
    message: string = 'Account is locked due to too many failed login attempts',
    cause?: Error,
  ) {
    super(message, 'ACCOUNT_LOCKED', 423, cause);
  }
}

/**
 *
 * ConfigurationError class.
 *
 */

export class ConfigurationError extends AuthError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', 500, cause);
  }
}
