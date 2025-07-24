import type {
  IDPConfig, IDPTokens, IDPUserInfo, IdentityProvider
} from '@/modules/core/auth/types/provider-interface.js';

/**
 *
 * GenericOAuth2Config interface.
 *
 */

export interface GenericOAuth2Config extends IDPConfig {
  id: string;
  name: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfo_endpoint?: string;
  issuer?: string;
  jwks_uri?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods?: string[];
  userinfo_mapping?: {
    id?: string;
    email?: string;
    email_verified?: string;
    name?: string;
    picture?: string;
  };
}

/**
 *
 * GenericOAuth2Provider class.
 *
 */

export class GenericOAuth2Provider implements IdentityProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc';
  private readonly config: GenericOAuth2Config;

  constructor(config: GenericOAuth2Config) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.issuer ? 'oidc' : 'oauth2';
    this.config = {
      ...config,
      scope: config.scope || 'openid email profile',
      userinfoMapping: config.userinfo_mapping || {},
    };
  }

  getAuthorizationUrl(state: string, nonce?: string): string {
    const params = new URLSearchParams({
      clientId: this.config.clientId,
      redirectUri: this.config.redirect_uri,
      responseType: 'code',
      scope: this.config.scope!,
      state,
    });

    if (nonce && this.type === 'oidc') {
      params.append('nonce', nonce);
    }

    /**
     * Add any additional parameters from config.
     */
    if ('authorization_params' in this.config && this.config.authorization_params) {
      Object.entries(this.config.authorization_params).forEach(([key, value]) : void => {
        params.append(key, value as string);
      });
    }

    return `${this.config.authorization_endpoint}?${params}`;
  }

  async exchangeCodeForTokens(code: string): Promise<IDPTokens> {
    const params = new URLSearchParams({
      grantType: 'authorization_code',
      code,
      redirectUri: this.config.redirect_uri,
      clientId: this.config.clientId,
      clientSecret: this.config.client_secret || '',
    });

    const response = await fetch(this.config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        "Accept": 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const data = await response.json();
    return data as IDPTokens;
  }

  async getUserInfo(_accessToken: string): Promise<IDPUserInfo> {
    if (!this.config.userinfo_endpoint) {
      throw new Error('UserInfo endpoint not configured');
    }

    const response = await fetch(this.config.userinfo_endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const mapping = this.config.userinfo_mapping!;

    /**
     * Map the response to our standard format.
     */
    return {
      id: this.getNestedValue(data, mapping.id || 'sub') || data.sub || data.id,
      email: this.getNestedValue(data, mapping.email || 'email'),
      emailVerified: this.getNestedValue(data, mapping.email_verified || 'email_verified'),
      name: this.getNestedValue(data, mapping.name || 'name'),
      picture: this.getNestedValue(data, mapping.picture || 'picture'),
      raw: data as Record<string, unknown>,
    };
  }

  async refreshTokens(refreshToken: string): Promise<IDPTokens> {
    const params = new URLSearchParams({
      grantType: 'refresh_token',
      refreshToken,
      clientId: this.config.clientId,
      clientSecret: this.config.client_secret || '',
    });

    const response = await fetch(this.config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        "Accept": 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh tokens: ${response.statusText}`);
    }

    const data = await response.json();
    return data as IDPTokens;
  }

  private getNestedValue(_obj: unknown, path: string): unknown {
    return path.split('.').reduce((curr, prop) : void => { return curr?.[prop] }, obj);
  }
}

export async function discoverOIDCConfiguration(issuer: string): Promise<Partial<GenericOAuth2Config>> {
  const discoveryUrl = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;

  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw new Error(`Failed to discover OIDC configuration: ${response.statusText}`);
  }

  const config = await response.json() as any;

  return {
    issuer: config.issuer,
    authorizationEndpoint: config.authorization_endpoint,
    tokenEndpoint: config.token_endpoint,
    userinfoEndpoint: config.userinfo_endpoint,
    jwksUri: config.jwks_uri,
    scopesSupported: config.scopes_supported,
    responsetypesSupported: config.response_types_supported,
    granttypesSupported: config.grant_types_supported,
    tokenendpoint_authMethods: config.token_endpoint_auth_methods_supported,
  };
}
