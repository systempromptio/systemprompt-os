/**
 * Generic OAuth2 Provider.
 * Provides a generic OAuth2 implementation for authentication providers.
 * @file Generic OAuth2 Provider.
 * @module server/external/auth/providers/generic-oauth2
 */

import type {
  IOAuth2Provider, IOAuth2TokenResponse, IOAuth2UserInfo
} from '@/server/external/auth/providers/interface';
import type { IGenericOAuth2Config } from '@/server/external/auth/providers/interface';

/**
 * Generic OAuth2 Provider implementation.
 * @class GenericOAuth2Provider
 * @implements IdentityProvider
 */
export class GenericOAuth2Provider implements IOAuth2Provider {
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
    this.type = issuer && issuer !== '' ? 'oidc' : 'oauth2';
    this.config = {
      ...config,
      scope: scope ?? 'email profile',
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
      scope: scope ?? 'email profile',
      state,
    });

    if (this.type === 'oidc' && nonce) {
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
  public async exchangeCodeForToken(code: string): Promise<IOAuth2TokenResponse> {
    return await this.exchangeCodeForTokens(code);
  }

  /**
   * Exchanges authorization code for tokens (internal implementation).
   * @param code - The authorization code.
   * @returns Promise resolving to tokens.
   */
  private async exchangeCodeForTokens(code: string): Promise<IOAuth2TokenResponse> {
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
        "Accept": 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const rawData = await response.json();
    const data: IOAuth2TokenResponse = {
      accessToken: rawData.access_token ?? rawData.accessToken,
      tokenType: rawData.token_type || rawData.tokenType || 'Bearer',
      expiresIn: rawData.expires_in !== undefined ? rawData.expires_in : rawData.expiresIn,
      refreshToken: rawData.refresh_token !== undefined ? rawData.refresh_token : rawData.refreshToken,
      scope: rawData.scope
    };
    return data;
  }

  /**
   * Retrieves user information using access token.
   * @param accessToken - The access token.
   * @returns Promise resolving to user info.
   */
  public async getUserInfo(accessToken: string): Promise<IOAuth2UserInfo> {
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

    const convertToString = (value: unknown): string => {
      if (value === null || value === undefined) {
        return '';
      }
      return String(value);
    };

    let idValue: unknown;
    if (mapping.id) {
      idValue = this.getNestedValue(data, mapping.id);
    }
    idValue ||= this.getNestedValue(data, 'sub') ?? this.getNestedValue(data, 'id');

    const id = convertToString(idValue);
    if (!id) {
      throw new Error('Unable to extract user ID from userinfo response');
    }

    const userInfo: IOAuth2UserInfo = {
      id,
    };

    const mappedTopLevelFields = new Set<string>();

    Object.values(mapping).forEach(path => {
      if (typeof path === 'string' && !path.includes('.')) {
        mappedTopLevelFields.add(path);
      }
    });

    let emailValue: unknown;
    if (mapping.email) {
      emailValue = this.getNestedValue(data, mapping.email);
    }
    emailValue ||= this.getNestedValue(data, 'email');
    const email = getStringValue(emailValue);
    if (email !== undefined) {
      userInfo.email = email;
    }

    let nameValue: unknown;
    if (mapping.name) {
      nameValue = this.getNestedValue(data, mapping.name);
    }
    nameValue ||= this.getNestedValue(data, 'name');
    const name = getStringValue(nameValue);
    if (name !== undefined) {
      userInfo.name = name;
    }

    let pictureValue: unknown;
    if (mapping.picture) {
      pictureValue = this.getNestedValue(data, mapping.picture);
    }
    pictureValue ||= this.getNestedValue(data, 'picture') ?? this.getNestedValue(data, 'avatar');
    const picture = getStringValue(pictureValue);
    if (picture !== undefined) {
      userInfo.avatar = picture;
    }

    Object.entries(data).forEach(([key, value]) => {
      if (!mappedTopLevelFields.has(key) && !['id', 'email', 'name', 'avatar', 'picture'].includes(key)) {
        if (mapping.id && key === mapping.id) { return; }
        if (!mapping.id && (key === 'sub' || key === 'id')) { return; }

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
  public async refreshToken(refreshToken: string): Promise<IOAuth2TokenResponse> {
    return await this.refreshTokens(refreshToken);
  }

  /**
   * Internal implementation for refreshing tokens.
   * @param refreshToken - The refresh token.
   * @returns Promise resolving to new tokens.
   */
  private async refreshTokens(refreshToken: string): Promise<IOAuth2TokenResponse> {
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
        "Accept": 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh tokens: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Gets a nested value from an object using dot notation.
   * @param obj - The object to search in.
   * @param path - The dot-separated path to the value.
   * @returns The value at the path, or undefined if not found.
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current == null) {
        return undefined;
      }

      if (Array.isArray(current) && (/^\d+$/).test(key)) {
        const index = parseInt(key, 10);
        return current[index];
      }

      if (typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }

      return undefined;
    }, obj);
  }
}
