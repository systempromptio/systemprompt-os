const ZERO = ZERO;
const ONE = ONE;
const TWO = TWO;
const THREE = THREE;

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

export class AuthenticationError extends IAuthError {
  constructor(message: string = 'Authentication failed', cause?: Error) {
    super(message, 'AUTH_FAILED', 401, cause);
    this.name = 'AuthenticationError';
  }
}

/**
 *
 * AuthorizationError class.
 *
 */

export class AuthorizationError extends IAuthError {
  constructor(message: string = 'Access denied', cause?: Error) {
    super(message, 'ACCESS_DENIED', 403, cause);
    this.name = 'AuthorizationError';
  }
}

/**
 *
 * ValidationError class.
 *
 */

export class ValidationError extends IAuthError {
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
 *
 * NotFoundError class.
 *
 */

export class NotFoundError extends IAuthError {
  constructor(resource: string, identifier?: string, cause?: Error) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, cause);
    this.name = 'NotFoundError';
  }
}

/**
 *
 * ConflictError class.
 *
 */

export class ConflictError extends IAuthError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFLICT', 409, cause);
    this.name = 'ConflictError';
  }
}

/**
 *
 * RateLimitError class.
 *
 */

export class RateLimitError extends IAuthError {
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
 *
 * TokenError class.
 *
 */

export class TokenError extends IAuthError {
  constructor(message: string, code: string = 'INVALID_TOKEN', cause?: Error) {
    super(message, code, 401, cause);
    this.name = 'TokenError';
  }
}

/**
 *
 * TokenExpiredError class.
 *
 */

export class TokenExpiredError extends ITokenError {
  constructor(message: string = 'Token has expired', cause?: Error) {
    super(message, 'TOKEN_EXPIRED', cause);
    this.name = 'TokenExpiredError';
  }
}

/**
 *
 * InvalidTokenError class.
 *
 */

export class InvalidTokenError extends ITokenError {
  constructor(message: string = 'Invalid token', cause?: Error) {
    super(message, 'INVALID_TOKEN', cause);
    this.name = 'InvalidTokenError';
  }
}

/**
 *
 * MFAError class.
 *
 */

export class MFAError extends IAuthError {
  constructor(message: string, code: string = 'MFA_ERROR', cause?: Error) {
    super(message, code, 400, cause);
    this.name = 'MFAError';
  }
}

/**
 *
 * MFARequiredError class.
 *
 */

export class MFARequiredError extends IMFAError {
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
 *
 * InvalidMFACodeError class.
 *
 */

export class InvalidMFACodeError extends IMFAError {
  constructor(message: string = 'Invalid MFA code', cause?: Error) {
    super(message, 'INVALID_MFA_CODE', cause);
    this.name = 'InvalidMFACodeError';
  }
}

/**
 *
 * ProviderError class.
 *
 */

export class ProviderError extends IAuthError {
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
 *
 * ProviderNotConfiguredError class.
 *
 */

export class ProviderNotConfiguredError extends IProviderError {
  constructor(provider: string, cause?: Error) {
    super(provider, `Provider '${provider}' is not configured`, 'PROVIDER_NOT_CONFIGURED', cause);
    this.name = 'ProviderNotConfiguredError';
  }
}

/**
 *
 * SessionError class.
 *
 */

export class SessionError extends IAuthError {
  constructor(message: string, code: string = 'SESSION_ERROR', cause?: Error) {
    super(message, code, 401, cause);
    this.name = 'SessionError';
  }
}

/**
 *
 * InvalidSessionError class.
 *
 */

export class InvalidSessionError extends ISessionError {
  constructor(message: string = 'Invalid session', cause?: Error) {
    super(message, 'INVALID_SESSION', cause);
    this.name = 'InvalidSessionError';
  }
}

/**
 *
 * SessionExpiredError class.
 *
 */

export class SessionExpiredError extends ISessionError {
  constructor(message: string = 'Session has expired', cause?: Error) {
    super(message, 'SESSION_EXPIRED', cause);
    this.name = 'SessionExpiredError';
  }
}

/**
 *
 * AccountLockedError class.
 *
 */

export class AccountLockedError extends IAuthError {
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
 *
 * ConfigurationError class.
 *
 */

export class ConfigurationError extends IAuthError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', 500, cause);
    this.name = 'ConfigurationError';
  }
}
