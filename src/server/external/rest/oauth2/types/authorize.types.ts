/**
 * Interface for identity provider implementations.
 */
export interface IIdentityProvider {
    name: string;

    getAuthorizationUrl: (state: string) => string;

    exchangeCodeForTokens: (code: string) => Promise<{ accessToken: string }>;

    getUserInfo: (token: string) => Promise<{
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    raw?: Record<string, unknown>;
  }>;
}

/**
 * OAuth2 error response structure.
 */
export interface IOAuth2Error {
    code: number;

    toJSON: () => {
    error: string;
    error_description: string;
  };
}

/**
 * User data for OAuth upsert operations.
 */
export interface IOAuthUserData {
    email: string;
    name?: string;
    avatar?: string;
}

/**
 * Authorization code creation parameters.
 */
export interface IAuthCodeParams {
    clientId: string;
    redirectUri: string;
    scope: string;
    userId: string;
    userEmail: string;
    provider?: string;
    providerTokens?: Record<string, unknown>;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    expiresAt: Date;
}

/**
 * State data encoded in OAuth flow.
 */
export interface IStateData {
    clientId: string;
    redirectUri: string;
    scope: string;
    originalState?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
}

/**
 * User object from authentication.
 */
export interface IAuthenticatedUser {
    sub?: string;
    id?: string;
    email?: string;
}

/**
 * Database user record.
 */
export interface IDatabaseUser {
    id: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Auth code service interface.
 */
export interface IAuthCodeService {
    createAuthorizationCode: (params: IAuthCodeParams) => Promise<string>;
    cleanupExpiredCodes: () => Promise<void>;
}

/**
 * Provider registry interface.
 */
export interface IProviderRegistry {
    getProvider: (name: string) => IIdentityProvider | undefined;
    getAllProviders: () => IIdentityProvider[];
}

/**
 * Auth repository interface.
 */
export interface IAuthRepository {
    upsertIUserFromOAuth: (
    provider: string,
    providerId: string,
    userData: IOAuthUserData
  ) => Promise<IDatabaseUser>;
}

/**
 * Type for validated authorization request parameters.
 */
export interface IAuthorizeRequestParams {
    responseType: 'code' | 'code id_token';
    clientId: string;
    redirectUri: string;
    scope: string;
    state?: string;
    nonce?: string;
    codeChallenge?: string;
    codeChallengeMethod?: 'S256' | 'plain';
        provider?: string;
        providerCode?: string;
}
