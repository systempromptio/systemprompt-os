/* eslint-disable max-classes-per-file */
/**
 * Base authentication error class for all auth-related errors.
 * Extends the standard Error class with additional properties for error codes and HTTP status.
 */
export class AuthError extends Error {
  /**
   * Creates a new AuthError instance.
   * @param message - The error message.
   * @param code - The error code identifier.
   * @param statusCode - The HTTP status code (defaults to 500).
   * @param cause - The underlying error that caused this error (optional).
   */
  /* eslint-disable-next-line max-params */
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
 * Typically used when credentials are invalid or missing.
 */
export class AuthenticationError extends AuthError {
  /**
   * Creates a new AuthenticationError instance.
   * @param message - The error message (defaults to 'Authentication failed').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string = 'Authentication failed', cause?: Error) {
    super(message, 'AUTH_FAILED', 401, cause);
  }
}

/**
 * Error thrown when authorization fails.
 * Used when a user is authenticated but lacks permission for the requested resource.
 */
export class AuthorizationError extends AuthError {
  /**
   * Creates a new AuthorizationError instance.
   * @param message - The error message (defaults to 'Access denied').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string = 'Access denied', cause?: Error) {
    super(message, 'ACCESS_DENIED', 403, cause);
  }
}

/**
 * Error thrown when input validation fails.
 * Can include specific field-level validation errors.
 */
export class ValidationError extends AuthError {
  /**
   * Creates a new ValidationError instance.
   * @param message - The error message.
   * @param fields - Optional record of field-specific validation errors.
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
    cause?: Error,
  ) {
    super(message, 'VALIDATION_ERROR', 400, cause);
  }
}

/**
 * Error thrown when a requested resource is not found.
 * Used for 404-type scenarios in authentication contexts.
 */
export class NotFoundError extends AuthError {
  /**
   * Creates a new NotFoundError instance.
   * @param resource - The type of resource that was not found.
   * @param identifier - Optional identifier of the specific resource.
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(resource: string, identifier?: string, cause?: Error) {
    const message = identifier !== undefined && identifier !== null && identifier !== ''
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, cause);
  }
}

/**
 * Error thrown when a resource conflict occurs.
 * Used for scenarios like duplicate users or conflicting operations.
 */
export class ConflictError extends AuthError {
  /**
   * Creates a new ConflictError instance.
   * @param message - The error message.
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string, cause?: Error) {
    super(message, 'CONFLICT', 409, cause);
  }
}

/**
 * Error thrown when rate limits are exceeded.
 * Includes optional retry-after information.
 */
export class RateLimitError extends AuthError {
  /**
   * Creates a new RateLimitError instance.
   * @param retryAfter - Optional number of seconds until retry is allowed.
   * @param message - The error message (defaults to 'Rate limit exceeded').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(
    public readonly retryAfter?: number,
    override message: string = 'Rate limit exceeded',
    override cause?: Error,
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, cause);
  }
}

/**
 * Base error class for token-related errors.
 * Parent class for specific token error types.
 */
export class TokenError extends AuthError {
  /**
   * Creates a new TokenError instance.
   * @param message - The error message.
   * @param code - The error code (defaults to 'INVALID_TOKEN').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string, code: string = 'INVALID_TOKEN', cause?: Error) {
    super(message, code, 401, cause);
  }
}

/**
 * Error thrown when a token has expired.
 * Used for JWT tokens and other time-sensitive authentication tokens.
 */
export class TokenExpiredError extends TokenError {
  /**
   * Creates a new TokenExpiredError instance.
   * @param message - The error message (defaults to 'Token has expired').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string = 'Token has expired', cause?: Error) {
    super(message, 'TOKEN_EXPIRED', cause);
  }
}

/**
 * Error thrown when a token is malformed or invalid.
 * Used for tokens that cannot be parsed or verified.
 */
export class InvalidTokenError extends TokenError {
  /**
   * Creates a new InvalidTokenError instance.
   * @param message - The error message (defaults to 'Invalid token').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string = 'Invalid token', cause?: Error) {
    super(message, 'INVALID_TOKEN', cause);
  }
}

/**
 * Base error class for Multi-Factor Authentication related errors.
 * Parent class for specific MFA error types.
 */
export class MultiFactorAuthError extends AuthError {
  /**
   * Creates a new MultiFactorAuthError instance.
   * @param message - The error message.
   * @param code - The error code (defaults to 'MFA_ERROR').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string, code: string = 'MFA_ERROR', cause?: Error) {
    super(message, code, 400, cause);
  }
}

/**
 * Error thrown when Multi-Factor Authentication is required but not provided.
 * Includes session information for continued authentication flow.
 */
export class MultiFactorAuthRequiredError extends MultiFactorAuthError {
  /**
   * Creates a new MultiFactorAuthRequiredError instance.
   * @param sessionId - The session ID for continued authentication.
   * @param message - The error message (defaults to 'MFA verification required').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(
    public readonly sessionId: string,
    message: string = 'MFA verification required',
    cause?: Error,
  ) {
    super(message, 'MFA_REQUIRED', cause);
  }
}

/**
 * Error thrown when an invalid Multi-Factor Authentication code is provided.
 * Used for TOTP codes, SMS codes, or other MFA verification methods.
 */
export class InvalidMultiFactorAuthCodeError extends MultiFactorAuthError {
  /**
   * Creates a new InvalidMultiFactorAuthCodeError instance.
   * @param message - The error message (defaults to 'Invalid MFA code').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string = 'Invalid MFA code', cause?: Error) {
    super(message, 'INVALID_MFA_CODE', cause);
  }
}

/**
 * Base error class for authentication provider-related errors.
 * Used for OAuth providers, LDAP, and other external authentication systems.
 */
export class ProviderError extends AuthError {
  /**
   * Creates a new ProviderError instance.
   * @param provider - The name of the authentication provider.
   * @param message - The error message.
   * @param code - The error code (defaults to 'PROVIDER_ERROR').
   * @param cause - The underlying error that caused this error (optional).
   */
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
 * Error thrown when an authentication provider is not properly configured.
 * Used when trying to use a provider that hasn't been set up or enabled.
 */
export class ProviderNotConfiguredError extends ProviderError {
  /**
   * Creates a new ProviderNotConfiguredError instance.
   * @param provider - The name of the unconfigured provider.
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(provider: string, cause?: Error) {
    super(provider, `Provider '${provider}' is not configured`, 'PROVIDER_NOT_CONFIGURED', cause);
  }
}

/**
 * Base error class for session-related errors.
 * Parent class for specific session error types.
 */
export class SessionError extends AuthError {
  /**
   * Creates a new SessionError instance.
   * @param message - The error message.
   * @param code - The error code (defaults to 'SESSION_ERROR').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string, code: string = 'SESSION_ERROR', cause?: Error) {
    super(message, code, 401, cause);
  }
}

/**
 * Error thrown when a session is invalid or corrupted.
 * Used for sessions that cannot be validated or verified.
 */
export class InvalidSessionError extends SessionError {
  /**
   * Creates a new InvalidSessionError instance.
   * @param message - The error message (defaults to 'Invalid session').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string = 'Invalid session', cause?: Error) {
    super(message, 'INVALID_SESSION', cause);
  }
}

/**
 * Error thrown when a session has expired.
 * Used for time-based session expiration scenarios.
 */
export class SessionExpiredError extends SessionError {
  /**
   * Creates a new SessionExpiredError instance.
   * @param message - The error message (defaults to 'Session has expired').
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string = 'Session has expired', cause?: Error) {
    super(message, 'SESSION_EXPIRED', cause);
  }
}

/**
 * Error thrown when an account is locked due to security policies.
 * Typically used after too many failed login attempts.
 */
export class AccountLockedError extends AuthError {
  /**
   * Creates a new AccountLockedError instance.
   * @param lockoutEndTime - Optional date when the lockout expires.
   * @param message - The error message (defaults to account locked message).
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(
    public readonly lockoutEndTime?: Date,
    message: string = 'Account is locked due to too many failed login attempts',
    cause?: Error,
  ) {
    super(message, 'ACCOUNT_LOCKED', 423, cause);
  }
}

/**
 * Error thrown when there are authentication configuration issues.
 * Used for missing or invalid authentication system configuration.
 */
export class ConfigurationError extends AuthError {
  /**
   * Creates a new ConfigurationError instance.
   * @param message - The error message.
   * @param cause - The underlying error that caused this error (optional).
   */
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', 500, cause);
  }
}
