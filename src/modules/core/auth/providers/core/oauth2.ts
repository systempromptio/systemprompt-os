/**
 * @file OAuth2 provider implementation for generic OAuth2/OIDC flows.
 * @eslint-disable @typescript-eslint/naming-convention - OAuth2 spec uses snake_case
 * @eslint-disable camelcase - OAuth2 spec requires snake_case for parameters
 * @eslint-disable systemprompt-os/enforce-type-exports - Legacy compatibility
 */

import type {
  IIdentityProvider, IIdpUserInfo, IdpConfig, IdpTokens
} from '@/modules/core/auth/types/provider-interface';

/**
 * Configuration interface for Generic OAuth2 providers.
 * Extends the base IDPConfig with OAuth2-specific settings.
 */
export interface IGenericOAuth2Config extends IdpConfig {
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
 * Type alias for Generic OAuth2 configuration.
 */
export type GenericOAuth2Config = IGenericOAuth2Config;

/**
 * Interface for OIDC Discovery Configuration (preserves OAuth2 spec naming).
 */
interface OIDCDiscoveryConfig {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    jwks_uri: string;
    scopes_supported: string[];
    response_types_supported: string[];
    grant_types_supported: string[];
    token_endpoint_auth_methods_supported: string[];
}

/**
 * Generic OAuth2 Provider implementation.
 * Supports both OAuth2 and OIDC (OpenID Connect) flows.
 */
export class GenericOAuth2Provider implements IIdentityProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type: 'oauth2' | 'oidc';
  private readonly config: GenericOAuth2Config;

  /**
   * Creates a new GenericOAuth2Provider instance.
   * @param config - The OAuth2 configuration.
   */
  constructor(config: GenericOAuth2Config) {
    const {
 id, name, issuer, scope, userinfoMapping
} = config;
    this.id = id;
    this.name = name;
    this.type = issuer ? 'oidc' : 'oauth2';
    this.config = {
      ...config,
      scope: scope ?? 'openid email profile',
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
      scope: this.config.scope ?? 'openid email profile',
      state,
    });

    if (nonce && this.type === 'oidc') {
      params.append('nonce', nonce);
    }

    if ('authorizationParams' in this.config && this.config.authorizationParams) {
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
      client_secret: this.config.clientSecret ?? '',
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

    const tokenData = await response.json() as IdpTokens;
    return tokenData;
  }

  /**
   * Retrieves user information from the userinfo endpoint.
   * @param accessToken - The access token for authentication.
   * @returns Promise resolving to the user information.
   */
  public async getUserInfo(accessToken: string): Promise<IIdpUserInfo> {
    if (!this.config.userinfoEndpoint) {
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
      return String(this.getNestedValue(userInfo, mapping.id ?? 'sub') ?? userInfo.sub ?? userInfo.id ?? '');
    };

    const getUserEmail = (userInfo: Record<string, unknown>): string => {
      return String(this.getNestedValue(userInfo, mapping.email ?? 'email') ?? '');
    };

    const getEmailVerified = (userInfo: Record<string, unknown>): boolean => {
      return Boolean(this.getNestedValue(userInfo, mapping.emailVerified ?? 'email_verified'));
    };

    const getUserName = (userInfo: Record<string, unknown>): string => {
      return String(this.getNestedValue(userInfo, mapping.name ?? 'name') ?? '');
    };

    const getUserPicture = (userInfo: Record<string, unknown>): string => {
      return String(this.getNestedValue(userInfo, mapping.picture ?? 'picture') ?? '');
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
      client_secret: this.config.clientSecret ?? '',
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

    const tokenData = await response.json() as IdpTokens;
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
      return (current as Record<string, unknown>)?.[property];
    }, object);
  }
}

/**
 * Discovers OIDC configuration from the issuer's well-known endpoint.
 * @param issuer - The OIDC issuer URL.
 * @returns Promise resolving to partial OAuth2 configuration.
 */
export const discoverOidcConfiguration = async (issuer: string): Promise<Partial<GenericOAuth2Config>> => {
  const discoveryUrl = `${issuer.replace(/\/$/u, '')}/.well-known/openid-configuration`;

  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw new Error(`Failed to discover OIDC configuration: ${response.statusText}`);
  }

  const configData = await response.json() as OIDCDiscoveryConfig;

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
