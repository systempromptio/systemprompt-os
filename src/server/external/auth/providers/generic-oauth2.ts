/**
 * Generic OAuth2/OIDC Provider.
 * Provides a generic OAuth2/OIDC implementation for authentication providers.
 * @file Generic OAuth2/OIDC Provider.
 * @module server/external/auth/providers/generic-oauth2
 */

import type {
  IDPTokens, IdentityProvider, OAuth2UserInfo
} from '@/server/external/auth/providers/interface';
import type { GenericOAuth2Config } from '@/server/external/auth/providers/types/generic-oauth2';

/**
 * Generic OAuth2/OIDC Provider implementation.
 * @class GenericOAuth2Provider
 * @implements IdentityProvider
 */
export class GenericOAuth2Provider implements IdentityProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type: 'oauth2' | 'oidc';
  private readonly config: GenericOAuth2Config;

  /**
   * Constructs a new GenericOAuth2Provider instance.
   * @param config - The OAuth2 configuration.
   */
  constructor(config: GenericOAuth2Config) {
    const {
 id, name, issuer, scope, userinfoMapping
} = config;
    this.id = id;
    this.name = name;
    this.type = issuer !== null && issuer !== '' ? 'oidc' : 'oauth2';
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
 client_id: clientId, redirect_uri: redirectUri, scope, authorizationEndpoint
} = this.config;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope ?? 'openid email profile',
      state,
    });

    if (nonce && nonce !== '' && this.type === 'oidc') {
      params.append('nonce', nonce);
    }

    const additionalParams = (this.config as any).authorizationParams;
    if (additionalParams && typeof additionalParams === 'object') {
      Object.entries(additionalParams).forEach(([key, value]) => {
        if (typeof value === 'string') {
          params.append(key, value);
        }
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
    return await this.exchangeCodeForTokens(code);
  }

  /**
   * Exchanges authorization code for tokens (internal implementation).
   * @param code - The authorization code.
   * @returns Promise resolving to tokens.
   */
  private async exchangeCodeForTokens(code: string): Promise<IDPTokens> {
    const {
 client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, tokenEndpoint
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
        "Accept": 'application/json',
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
  public async getUserInfo(accessToken: string): Promise<OAuth2UserInfo> {
    const { userinfoEndpoint } = this.config;
    if (!userinfoEndpoint || userinfoEndpoint === '') {
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
    const mapping = this.config.userinfoMapping ?? {};

    const getStringValue = (value: unknown): string | undefined => {
      return typeof value === 'string' ? value : undefined;
    };

    const idValue = this.getNestedValue(data, mapping.id ?? 'sub')
      ?? this.getNestedValue(data, 'sub')
      ?? this.getNestedValue(data, 'id');

    const id = getStringValue(idValue) ?? '';
    if (!id) {
      throw new Error('Unable to extract user ID from userinfo response');
    }

    const userInfo: OAuth2UserInfo = {
      id,
    };

    const email = getStringValue(this.getNestedValue(data, mapping.email ?? 'email'));
    if (email !== undefined) {
      userInfo.email = email;
    }

    const name = getStringValue(this.getNestedValue(data, mapping.name ?? 'name'));
    if (name !== undefined) {
      userInfo.name = name;
    }

    const picture = getStringValue(this.getNestedValue(data, mapping.picture ?? 'picture'));
    if (picture !== undefined) {
      userInfo.avatar = picture;
    }

    Object.entries(data).forEach(([key, value]) => {
      if (!['id', 'email', 'name', 'avatar'].includes(key)) {
        userInfo[key] = value;
      }
    });

    return userInfo;
  }

  /**
   * Refreshes access tokens using refresh token.
   * @param refreshToken - The refresh token.
   * @returns Promise resolving to new tokens.
   */
  public async refreshToken(refreshToken: string): Promise<IDPTokens> {
    return await this.refreshTokens(refreshToken);
  }

  /**
   * Internal implementation for refreshing tokens.
   * @param refreshToken - The refresh token.
   * @returns Promise resolving to new tokens.
   */
  private async refreshTokens(refreshToken: string): Promise<IDPTokens> {
    const {
 client_id: clientId, client_secret: clientSecret, tokenEndpoint
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
        "Accept": 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh tokens: ${response.statusText}`);
    }

    const data = await response.json() as IDPTokens;
    return data;
  }

  /**
   * Gets a nested value from an object using dot notation.
   * @param obj - The object to search in.
   * @param path - The dot-separated path to the value.
   * @returns The value at the path, or undefined if not found.
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current != null && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
