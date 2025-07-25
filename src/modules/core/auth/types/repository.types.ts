/**
 * Session metadata interface for authentication sessions.
 * Contains optional client metadata for tracking session context.
 */
export interface SessionMetadata {
    ipAddress?: string;
    userAgent?: string;
}

/**
 * OAuth profile interface for user authentication.
 * Contains user profile data retrieved from OAuth providers.
 */
export interface OAuthProfile {
    email: string;
    name?: string;
    avatar?: string;
}
