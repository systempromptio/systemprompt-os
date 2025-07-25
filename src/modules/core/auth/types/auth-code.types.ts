/**
 * Authorization code types for auth code persistence service.
 * @module modules/core/auth/types/auth-code
 */

/**
 * Authorization code data interface.
 */
export interface IAuthorizationCodeData {
  /**
   * OAuth2 client identifier.
   */
  clientId: string;
  /**
   * OAuth2 redirect URI.
   */
  redirectUri: string;
  /**
   * OAuth2 requested scope.
   */
  scope: string;
  /**
   * User identifier (optional).
   */
  userId?: string;
  /**
   * User email address (optional).
   */
  userEmail?: string;
  /**
   * Authentication provider name (optional).
   */
  provider?: string;
  /**
   * Provider-specific tokens (optional).
   */
  providerTokens?: Record<string, unknown>;
  /**
   * PKCE code challenge (optional).
   */
  codeChallenge?: string;
  /**
   * PKCE code challenge method (optional).
   */
  codeChallengeMethod?: string;
  /**
   * Authorization code expiration timestamp.
   */
  expiresAt: Date;
}

/**
 * Database row representation for authorization codes.
 */
export interface IAuthCodeRow {
  /**
   * Authorization code value.
   */
  code: string;
  /**
   * OAuth2 client identifier.
   */
  clientid: string;
  /**
   * OAuth2 redirect URI.
   */
  redirecturi: string;
  /**
   * OAuth2 requested scope.
   */
  scope: string;
  /**
   * User identifier (nullable).
   */
  userId: string | null;
  /**
   * User email address (nullable).
   */
  useremail: string | null;
  /**
   * Authentication provider name (nullable).
   */
  provider: string | null;
  /**
   * Provider-specific tokens as JSON string (nullable).
   */
  providertokens: string | null;
  /**
   * PKCE code challenge (nullable).
   */
  codechallenge: string | null;
  /**
   * PKCE code challenge method (nullable).
   */
  codeChallengeMethod: string | null;
  /**
   * Authorization code expiration timestamp as ISO string.
   */
  expiresat: string;
  /**
   * Record creation timestamp as ISO string.
   */
  createdAt: string;
}