/**
 * Authorization code data interface.
 */
export interface IAuthorizationCodeData {
    clientId: string;
    redirectUri: string;
    scope: string;
    userId?: string;
    userEmail?: string;
    provider?: string;
    providerTokens?: Record<string, unknown>;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    expiresAt: Date;
}

// Database row types are now auto-generated in database.generated.ts
