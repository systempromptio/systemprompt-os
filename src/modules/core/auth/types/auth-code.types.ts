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

/**
 * Database row representation for authorization codes.
 */
export interface IAuthCodeRow {
    code: string;
    clientid: string;
    redirecturi: string;
    scope: string;
    userId: string | null;
    useremail: string | null;
    provider: string | null;
    providertokens: string | null;
    codechallenge: string | null;
    codeChallengeMethod: string | null;
    expiresat: string;
    createdAt: string;
}
