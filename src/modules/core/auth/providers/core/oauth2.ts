/**
 * OAuth2 provider implementation for generic OAuth2 flows.
 * Supports standard OAuth2 authentication flows.
 */

import type {
  IIdentityProvider, IIdpUserInfo, IdpTokens
} from '@/modules/core/auth/types/provider-interface';
import type { IGenericOAuth2Config, IOIDCDiscoveryConfig } from '@/modules/core/auth/types/oauth2.types';

/**
 * Generic OAuth2 Provider implementation.
 * Supports OAuth2 flows.
 */
export class GenericOAuth2Provider implements IIdentityProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type: 'oauth2' | 'oidc';
  private readonly config: IGenericOAuth2Config;

  /**
   * Creates a new GenericOAuth2Provider instance.
   * @param config - The OAuth2 configuration.
   */
  constructor(config: IGenericOAuth2Config) {
    const {
      id, name, issuer, scope, userinfoMapping
    } = config;
    this.id = id;
    this.name = name;
    this.type = issuer !== undefined && issuer !== null ? 'oidc' : 'oauth2';
    this.config = {
      ...config,
      scope: scope ?? 'email profile',
      userinfoMapping: userinfoMapping ?? {},
    };
  }

  /**
   * Generates the OAuth2 authorization URL.
   * @param state - The state parameter for CSRF protection.
   * @param nonce - Optional nonce parameter for OIDC.
   * @returns The complete authorization URL.
   */
  public getAuthorizationUrl(state: string, nonce?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope ?? 'email profile',
      state,
    });

    if (nonce !== undefined && nonce !== null && this.type === 'oidc') {
      params.append('nonce', nonce);
    }

    if ('authorizationParams' in this.config && this.config.authorizationParams !== undefined) {
      Object.entries(this.config.authorizationParams).forEach(
        ([key, value]): void => {
          params.append(key, String(value));
        }
      );
    }

    return `${this.config.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for access tokens.
   * @param authCode - The authorization code from the OAuth2 callback.
   * @returns Promise resolving to the token response.
   */
  public async exchangeCodeForTokens(authCode: string): Promise<IdpTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code: ${errorText}`);
    }

    const rawTokenData = await response.json() as {
      access_token: string;
      token_type: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
      id_token?: string;
    };

    const tokenData: IdpTokens = {
      accessToken: rawTokenData.access_token,
      tokenType: rawTokenData.token_type,
    };

    if (rawTokenData.expires_in !== undefined) {
      tokenData.expiresIn = rawTokenData.expires_in;
    }
    if (rawTokenData.refresh_token !== undefined) {
      tokenData.refreshToken = rawTokenData.refresh_token;
    }
    if (rawTokenData.scope !== undefined) {
      tokenData.scope = rawTokenData.scope;
    }
    if (rawTokenData.id_token !== undefined) {
      tokenData.idToken = rawTokenData.id_token;
    }

    return tokenData;
  }

  /**
   * Retrieves user information from the userinfo endpoint.
   * @param accessToken - The access token for authentication.
   * @returns Promise resolving to the user information.
   */
  public async getUserInfo(accessToken: string): Promise<IIdpUserInfo> {
    if (this.config.userinfoEndpoint === undefined || this.config.userinfoEndpoint === null) {
      throw new Error('UserInfo endpoint not configured');
    }

    const response = await fetch(this.config.userinfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const userData = await response.json() as Record<string, unknown>;
    const mapping = this.config.userinfoMapping ?? {};

    const getUserId = (userInfo: Record<string, unknown>): string => {
      const nestedValue = this.getNestedValue(userInfo, mapping.id ?? 'sub');
      const idValue = nestedValue ?? userInfo.sub ?? userInfo.id ?? '';
      return String(idValue);
    };

    const getUserEmail = (userInfo: Record<string, unknown>): string => {
      const emailValue = this.getNestedValue(userInfo, mapping.email ?? 'email') ?? '';
      return String(emailValue);
    };

    const getEmailVerified = (userInfo: Record<string, unknown>): boolean => {
      const verifiedValue = this.getNestedValue(
        userInfo,
        mapping.emailVerified ?? 'email_verified'
      );
      return Boolean(verifiedValue);
    };

    const getUserName = (userInfo: Record<string, unknown>): string => {
      const nameValue = this.getNestedValue(userInfo, mapping.name ?? 'name') ?? '';
      return String(nameValue);
    };

    const getUserPicture = (userInfo: Record<string, unknown>): string => {
      const pictureValue = this.getNestedValue(userInfo, mapping.picture ?? 'picture') ?? '';
      return String(pictureValue);
    };

    return {
      id: getUserId(userData),
      email: getUserEmail(userData),
      emailVerified: getEmailVerified(userData),
      name: getUserName(userData),
      picture: getUserPicture(userData),
      raw: userData,
    };
  }

  /**
   * Refreshes access tokens using a refresh token.
   * @param refreshToken - The refresh token.
   * @returns Promise resolving to new tokens.
   */
  public async refreshTokens(refreshToken: string): Promise<IdpTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh tokens: ${response.statusText}`);
    }

    const rawTokenData = await response.json() as {
      access_token: string;
      token_type: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
      id_token?: string;
    };

    const tokenData: IdpTokens = {
      accessToken: rawTokenData.access_token,
      tokenType: rawTokenData.token_type,
    };

    if (rawTokenData.expires_in !== undefined) {
      tokenData.expiresIn = rawTokenData.expires_in;
    }
    if (rawTokenData.refresh_token !== undefined) {
      tokenData.refreshToken = rawTokenData.refresh_token;
    }
    if (rawTokenData.scope !== undefined) {
      tokenData.scope = rawTokenData.scope;
    }
    if (rawTokenData.id_token !== undefined) {
      tokenData.idToken = rawTokenData.id_token;
    }

    return tokenData;
  }

  /**
   * Retrieves a nested value from an object using a dot-separated path.
   * @param object - The object to search in.
   * @param path - The dot-separated path to the value.
   * @returns The nested value or undefined if not found.
   */
  private getNestedValue(object: unknown, path: string): unknown {
    return path.split('.').reduce((current: unknown, property: string): unknown => {
      if (current !== null && current !== undefined && typeof current === 'object') {
        return (current as Record<string, unknown>)[property];
      }
      return undefined;
    }, object);
  }
}

/**
 * Discovers OIDC configuration from the issuer's well-known endpoint.
 * @param issuer - The OIDC issuer URL.
 * @returns Promise resolving to partial OAuth2 configuration.
 */
export const discoverOidcConfiguration = async (
  issuer: string
): Promise<Partial<IGenericOAuth2Config>> => {
  const discoveryUrl = `${issuer.replace(/\/$/u, '')}/.well-known/openid-configuration`;

  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw new Error(`Failed to discover OIDC configuration: ${response.statusText}`);
  }

  const configData = await response.json() as IOIDCDiscoveryConfig;

  return {
    issuer: configData.issuer,
    authorizationEndpoint: configData.authorization_endpoint,
    tokenEndpoint: configData.token_endpoint,
    userinfoEndpoint: configData.userinfo_endpoint,
    jwksUri: configData.jwks_uri,
    scopesSupported: configData.scopes_supported,
    responseTypesSupported: configData.response_types_supported,
    grantTypesSupported: configData.grant_types_supported,
    tokenEndpointAuthMethods: configData.token_endpoint_auth_methods_supported,
  };
};
