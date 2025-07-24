/**
 * OAuth2 error types following RFC 6749.
 * @see https://tools.ietf.org/html/rfc6749#section-5.2
 */
export enum OAuth2ErrorType {
  InvalidRequest = 'invalid_request',
  InvalidClient = 'invalid_client',
  InvalidGrant = 'invalid_grant',
  UnauthorizedClient = 'unauthorized_client',
  UnsupportedGrantType = 'unsupported_grant_type',
  UnsupportedResponseType = 'unsupported_response_type',
  InvalidScope = 'invalid_scope',
  AccessDenied = 'access_denied',
  ServerError = 'servererror',
}

/**
 * OAuth2 error response interface.
 */
export interface OAuth2ErrorResponse {
  error: OAuth2ErrorType;
  error_description?: string;
  error_uri?: string;
}

/**
 * OAuth2 error class.
 */
export class OAuth2Error extends Error {
  public readonly code: number;
  public readonly errorType: OAuth2ErrorType;
  public readonly errorDescription?: string;
  public readonly errorUri?: string;

  constructor(
    errorType: OAuth2ErrorType,
    errorDescription?: string,
    code: number = 400,
    errorUri?: string,
  ) {
    super(errorDescription || errorType);
    this.name = 'OAuth2Error';
    this.code = code;
    this.errorType = errorType;
    if (errorDescription !== undefined) {
      this.errorDescription = errorDescription;
    }
    if (errorUri !== undefined) {
      this.errorUri = errorUri;
    }
  }

  toJSON(): OAuth2ErrorResponse {
    return {
      error: this.errorType,
      ...this.errorDescription && { error_description: this.errorDescription },
      ...this.errorUri && { error_uri: this.errorUri },
    };
  }

  // Static factory methods for common errors
  static invalidRequest(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorType.InvalidRequest, description);
  }

  static invalidClient(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorType.InvalidClient, description, 401);
  }

  static invalidGrant(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorType.InvalidGrant, description);
  }

  static unauthorizedClient(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorType.UnauthorizedClient, description);
  }

  static unsupportedGrantType(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorType.UnsupportedGrantType, description);
  }

  static unsupportedResponseType(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorType.UnsupportedResponseType, description);
  }

  static invalidScope(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorType.InvalidScope, description);
  }

  static accessDenied(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorType.AccessDenied, description);
  }

  static serverError(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorType.ServerError, description, 500);
  }
}
