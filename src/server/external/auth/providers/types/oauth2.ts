/**
 * OAuth2 provider interface.
 * @interface IOAuth2Provider
 */
export interface IOAuth2Provider {
    id: string;
    name: string;
    getAuthorizationUrl(state: string): string;
    exchangeCodeForToken(code: string): Promise<IOAuth2TokenResponse>;
    getUserInfo(accessToken: string): Promise<IOAuth2UserInfo>;
    refreshToken?(refreshToken: string): Promise<IOAuth2TokenResponse>;
}

/**
 * OAuth2 configuration interface.
 * @interface IOAuth2Config
 */
export interface IOAuth2Config {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userinfoEndpoint?: string;
    scope?: string;
}

/**
 * OAuth2 token response interface.
 * @interface IOAuth2TokenResponse
 */
export interface IOAuth2TokenResponse {
    accessToken: string;
    tokenType: string;
    expiresIn?: number;
    refreshToken?: string;
    scope?: string;
}

/**
 * OAuth2 user information interface.
 * @interface IOAuth2UserInfo
 */
export interface IOAuth2UserInfo {
    id: string;
    email?: string;
    name?: string;
    avatar?: string;
    [key: string]: unknown;
}

/**
 * Generic OAuth2 provider configuration interface.
 * @interface IGenericOAuth2Config
 * @augments IOAuth2Config
 */
export interface IGenericOAuth2Config extends IOAuth2Config {
    id: string;
    name: string;
    issuer?: string;
    jwksUri?: string;
    userinfoMapping?: Record<string, string>;
}

/**
 * Google OAuth2 provider configuration interface.
 * @interface IGoogleConfig
 * @augments IOAuth2Config
 */
export interface IGoogleConfig extends IOAuth2Config {
    id: string;
    name: string;
}

/**
 * GitHub OAuth2 provider configuration interface.
 * @interface IGitHubConfig
 * @augments IOAuth2Config
 */
export interface IGitHubConfig extends IOAuth2Config {
    id: string;
    name: string;
}

/**
 * Legacy type alias for OAuth2 configuration.
 * @deprecated Use IOAuth2Config instead.
 * @type {IOAuth2Config}
 */
export type IDPConfig = IOAuth2Config;

/**
 * Legacy type alias for OAuth2 token response.
 * @deprecated Use IOAuth2TokenResponse instead.
 * @type {IOAuth2TokenResponse}
 */
export type IDPTokens = IOAuth2TokenResponse;

/**
 * Legacy type alias for OAuth2 user info.
 * @deprecated Use IOAuth2UserInfo instead.
 * @type {IOAuth2UserInfo}
 */
export type IDPUserInfo = IOAuth2UserInfo;

/**
 * Legacy type alias for OAuth2 provider.
 * @deprecated Use IOAuth2Provider instead.
 * @type {IOAuth2Provider}
 */
export type IdentityProvider = IOAuth2Provider;
