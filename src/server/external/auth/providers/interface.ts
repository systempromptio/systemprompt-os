/**
 * OAuth2 provider interface.
 */

export interface OAuth2Provider {
  id: string;
  name: string;
  getAuthorizationUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<OAuth2TokenResponse>;
  getUserInfo(accessToken: string): Promise<OAuth2UserInfo>;
  refreshToken?(refreshToken: string): Promise<OAuth2TokenResponse>;
}

export interface OAuth2Config {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  scope?: string;
}

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuth2UserInfo {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  [key: string]: unknown;
}

export interface GenericOAuth2Config extends OAuth2Config {
  id: string;
  name: string;
  issuer?: string;
  jwks_uri?: string;
  userinfo_mapping?: Record<string, string>;
}

export interface GoogleConfig extends OAuth2Config {
  id: string;
  name: string;
}

export interface GitHubConfig extends OAuth2Config {
  id: string;
  name: string;
}

// Legacy aliases for backward compatibility
export type IDPConfig = OAuth2Config;
export type IDPTokens = OAuth2TokenResponse;
export type IDPUserInfo = OAuth2UserInfo;
export type IdentityProvider = OAuth2Provider;
