// Temporary interface until auth module is fully resolved
export interface IAuthorizationCodeData {
  code: string;
  provider: string;
  user_id: string;
  redirect_uri: string;
  scopes: string[];
  expires_at: Date;
  clientId?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt?: Date;
}

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
    createAuthorizationCode: (params: IAuthorizationCodeData) => Promise<string>;
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
 * Type for validated authorization request parameters (database-aligned snake_case).
 */
export interface IAuthorizeRequestParams {
    response_type: 'code' | 'code id_token';
    client_id: string;
    redirect_uri: string;
    scope: string;
    state?: string;
    nonce?: string;
    code_challenge?: string;
    code_challenge_method?: 'S256' | 'plain';
    provider?: string;
    provider_code?: string;
}
