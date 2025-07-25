/**
 * Session metadata interface for authentication sessions.
 * Contains optional client metadata for tracking session context.
 */
export interface SessionMetadata {
  /**
   * IP address of the client creating the session.
   */
  ipAddress?: string;
  /**
   * User agent string of the client creating the session.
   */
  userAgent?: string;
}

/**
 * OAuth profile interface for user authentication.
 * Contains user profile data retrieved from OAuth providers.
 */
export interface OAuthProfile {
  /**
   * User's email address from OAuth provider.
   */
  email: string;
  /**
   * User's display name from OAuth provider.
   */
  name?: string;
  /**
   * User's avatar URL from OAuth provider.
   */
  avatar?: string;
}