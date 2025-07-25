/**
 * @file Generic OAuth2/OIDC Provider.
 * @description Provides a generic OAuth2/OIDC implementation for authentication providers.
 * @module server/external/auth/providers/generic-oauth2
 */

import type {
 IDPConfig, IDPTokens, IDPUserInfo, IdentityProvider
} from '@/server/external/auth/providers/interface';

/**
 * Configuration interface for Generic OAuth2 provider.
 * @interface IGenericOAuth2Config
 * @augments IDPConfig
 */
export interface IGenericOAuth2Config extends IDPConfig {
  id: string;
  name: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  issuer?: string;
  jwksUri?: string;
  scopesSupported?: string[];
  responseTypesSupported?: string[];
  grantTypesSupported?: string[];
  tokenEndpointAuthMethods?: string[];
  userinfoMapping?: {
    id?: string;
    email?: string;
    emailVerified?: string;
    name?: string;
    picture?: string;
  };
}

/**
 * Generic OAuth2/OIDC Provider implementation.
 * @class GenericOAuth2Provider
 * @implements IdentityProvider
 */
export class GenericOAuth2Provider implements IdentityProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type: 'oauth2' | 'oidc';
  private readonly config: IGenericOAuth2Config;

  /**
   * Constructs a new GenericOAuth2Provider instance.
   * @param config - The OAuth2 configuration.
   */
  constructor(config: IGenericOAuth2Config) {
    const {
 id, name, issuer, scope, userinfoMapping
} = config;
    this.id = id;
    this.name = name;
    this.type = issuer != null && issuer !== '' ? 'oidc' : 'oauth2';
    this.config = {
      ...config,
      scope: scope ?? 'openid email profile',
      userinfoMapping: userinfoMapping ?? {},
    };
  }

  /**
   * Generates the authorization URL for OAuth2 flow.
   * @param state - The state parameter for CSRF protection.
   * @param nonce - Optional nonce for OIDC.
   * @returns The authorization URL.
   */
  public getAuthorizationUrl(state: string, nonce?: string): string {
    const {
 clientId, redirectUri, scope, authorizationEndpoint
} = this.config;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope as string,
      state,
    });

    if (nonce != null && nonce !== '' && this.type === 'oidc') {
      params.append('nonce', nonce);
    }

    if ('authorizationParams' in this.config && this.config.authorizationParams != null) {
      Object.entries(this.config.authorizationParams).forEach(([key, value]) => {
        params.append(key, value as string);
      });
    }

    return `${authorizationEndpoint}?${params}`;
  }

  /**
   * Exchanges authorization code for tokens.
   * @param code - The authorization code.
   * @returns Promise resolving to tokens.
   */
  public async exchangeCodeForToken(code: string): Promise<IDPTokens> {
    return this.exchangeCodeForTokens(code);
  }

  /**
   * Exchanges authorization code for tokens (internal implementation).
   * @param code - The authorization code.
   * @returns Promise resolving to tokens.
   */
  private async exchangeCodeForTokens(code: string): Promise<IDPTokens> {
    const {
 clientId, clientSecret, redirectUri, tokenEndpoint
} = this.config;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret ?? '',
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const data = await response.json() as IDPTokens;
    return data;
  }

  /**
   * Retrieves user information using access token.
   * @param accessToken - The access token.
   * @returns Promise resolving to user info.
   */
  public async getUserInfo(accessToken: string): Promise<IDPUserInfo> {
    const { userinfoEndpoint } = this.config;
    if (userinfoEndpoint == null || userinfoEndpoint === '') {
      throw new Error('UserInfo endpoint not configured');
    }

    const response = await fetch(userinfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const mapping = this.config.userinfoMapping as NonNullable<IGenericOAuth2Config['userinfoMapping']>;

    return {
      id: this.getNestedValue(data, mapping.id ?? 'sub')
          ?? this.getNestedValue(data, 'sub')
          ?? this.getNestedValue(data, 'id') ?? '',
      email: this.getNestedValue(data, mapping.email ?? 'email'),
      email_verified: this.getNestedValue(data, mapping.emailVerified ?? 'email_verified'),
      name: this.getNestedValue(data, mapping.name ?? 'name'),
      picture: this.getNestedValue(data, mapping.picture ?? 'picture'),
      raw: data,
    };
  }

  /**
   * Refreshes access tokens using refresh token.
   * @param refreshToken - The refresh token.
   * @returns Promise resolving to new tokens.
   */
  public async refreshTokens(refreshToken: string): Promise<IDPTokens> {
    const {
 clientId, clientSecret, tokenEndpoint
} = this.config;
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret ?? '',
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh tokens: ${response.statusText}`);
    }

    const data = await response.json() as IDPTokens;
    return data;
  }

}


  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw new Error(`Failed to discover OIDC configuration: ${response.statusText}`);
  }

  const config = await response.json() as Record<string, unknown>;

  return {
    issuer: config.issuer as string,
    authorizationEndpoint: config.authorization_endpoint as string,
    tokenEndpoint: config.token_endpoint as string,
    userinfoEndpoint: config.userinfo_endpoint as string,
    jwksUri: config.jwks_uri as string,
    scopesSupported: config.scopes_supported as string[],
    responseTypesSupported: config.response_types_supported as string[],
    grantTypesSupported: config.grant_types_supported as string[],
    tokenEndpointAuthMethods: config.token_endpoint_auth_methods_supported as string[],
  };
}
