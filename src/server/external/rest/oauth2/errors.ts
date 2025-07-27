import type { IOAuth2ErrorResponse } from '@/server/external/rest/oauth2/types';
import { OAuth2ErrorTypeEnum } from '@/server/external/rest/oauth2/types';

/**
 * OAuth2 error class.
 */
export class OAuth2Error extends Error {
  public readonly code: number;
  public readonly errorType: OAuth2ErrorTypeEnum;
  public readonly errorDescription?: string;
  public readonly errorUri?: string;

  /**
   * Creates an OAuth2 error.
   * @param errorType - The OAuth2 error type.
   * @param errorDescription - Optional error description.
   * @param code - HTTP status code (default: 400).
   */
  constructor(
    errorType: OAuth2ErrorTypeEnum,
    errorDescription?: string,
    code: number = 400,
  ) {
    super(errorDescription ?? errorType);
    this.name = 'OAuth2Error';
    this.code = code;
    this.errorType = errorType;
    if (errorDescription !== undefined) {
      this.errorDescription = errorDescription;
    }
  }

  /**
   * Converts the error to a JSON representation.
   * @returns The OAuth2 error response.
   */
  toJSON(): IOAuth2ErrorResponse {
    const response: IOAuth2ErrorResponse = {
      error: this.errorType,
    };

    if (this.errorDescription !== undefined) {
      response.error_description = this.errorDescription;
    }

    if (this.errorUri !== undefined) {
      response.error_uri = this.errorUri;
    }

    return response;
  }

  /**
   * Creates an invalid request error.
   * @param description - Optional error description.
   * @returns OAuth2Error instance.
   */
  static invalidRequest(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_REQUEST, description);
  }

  /**
   * Creates an invalid client error.
   * @param description - Optional error description.
   * @returns OAuth2Error instance.
   */
  static invalidClient(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_CLIENT, description, 401);
  }

  /**
   * Creates an invalid grant error.
   * @param description - Optional error description.
   * @returns OAuth2Error instance.
   */
  static invalidGrant(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_GRANT, description);
  }

  /**
   * Creates an unauthorized client error.
   * @param description - Optional error description.
   * @returns OAuth2Error instance.
   */
  static unauthorizedClient(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorTypeEnum.UNAUTHORIZED_CLIENT, description);
  }

  /**
   * Creates an unsupported grant type error.
   * @param description - Optional error description.
   * @returns OAuth2Error instance.
   */
  static unsupportedGrantType(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorTypeEnum.UNSUPPORTED_GRANT_TYPE, description);
  }

  /**
   * Creates an unsupported response type error.
   * @param description - Optional error description.
   * @returns OAuth2Error instance.
   */
  static unsupportedResponseType(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorTypeEnum.UNSUPPORTED_RESPONSE_TYPE, description);
  }

  /**
   * Creates an invalid scope error.
   * @param description - Optional error description.
   * @returns OAuth2Error instance.
   */
  static invalidScope(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorTypeEnum.INVALID_SCOPE, description);
  }

  /**
   * Creates an access denied error.
   * @param description - Optional error description.
   * @returns OAuth2Error instance.
   */
  static accessDenied(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorTypeEnum.ACCESS_DENIED, description);
  }

  /**
   * Creates a server error.
   * @param description - Optional error description.
   * @returns OAuth2Error instance.
   */
  static serverError(description?: string): OAuth2Error {
    return new OAuth2Error(OAuth2ErrorTypeEnum.SERVER_ERROR, description, 500);
  }
}
