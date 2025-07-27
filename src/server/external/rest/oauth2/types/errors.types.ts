/**
 * OAuth2 error types following RFC 6749.
 * @see https://tools.ietf.org/html/rfc6749#section-5.2
 */
export const enum OAuth2ErrorTypeEnum {
  INVALID_REQUEST = 'invalid_request',
  INVALID_CLIENT = 'invalid_client',
  INVALID_GRANT = 'invalid_grant',
  UNAUTHORIZED_CLIENT = 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE = 'unsupported_grant_type',
  UNSUPPORTED_RESPONSE_TYPE = 'unsupported_response_type',
  INVALID_SCOPE = 'invalid_scope',
  ACCESS_DENIED = 'access_denied',
  SERVER_ERROR = 'servererror',
}

/**
 * OAuth2 error response interface.
 */
export interface IOAuth2ErrorResponse {
  error: OAuth2ErrorTypeEnum;
  error_description?: string;
  error_uri?: string;
}
