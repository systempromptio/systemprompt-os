/**
 * OAuth2 provider implementation for generic OAuth2 flows.
 * Supports standard OAuth2 authentication flows.
 */

import type {
  IIdentityProvider,
  IIdpUserInfo,
  IdpTokens,
} from '@/modules/core/auth/types/provider-interface';
import type {
  IGenericOAuth2Config,
  IOIDCDiscoveryConfig,
  ITokenResponseData,
} from '@/modules/core/auth/types/oauth2.types';

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
    this.type = issuer ? 'oidc' : 'oauth2';
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
    const response = await this.fetchTokens(authCode);
    const rawTokenData = await this.parseTokenResponse(response);
    return this.buildTokenData(rawTokenData);
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

    const userData = await this.fetchUserData(accessToken);
    return this.mapUserData(userData);
  }

  /**
   * Refreshes access tokens using a refresh token.
   * @param refreshToken - The refresh token.
   * @returns Promise resolving to new tokens.
   */
  public async refreshTokens(refreshToken: string): Promise<IdpTokens> {
    const response = await this.fetchRefreshTokens(refreshToken);
    const rawTokenData = await this.parseTokenResponse(response);
    return this.buildTokenData(rawTokenData);
  }

  /**
   * Fetches tokens from the token endpoint.
   * @param authCode - The authorization code.
   * @returns Promise resolving to the fetch response.
   */
  private async fetchTokens(authCode: string): Promise<Response> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    return await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params,
    });
  }

  /**
   * Fetches refreshed tokens from the token endpoint.
   * @param refreshToken - The refresh token.
   * @returns Promise resolving to the fetch response.
   */
  private async fetchRefreshTokens(refreshToken: string): Promise<Response> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    return await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params,
    });
  }

  /**
   * Parses the token response and handles errors.
   * @param response - The fetch response.
   * @returns Promise resolving to parsed token data.
   */
  private async parseTokenResponse(response: Response): Promise<ITokenResponseData> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code: ${errorText}`);
    }

    const data = await response.json();
    return data as ITokenResponseData;
  }

  /**
   * Builds IdpTokens from raw token response data.
   * @param rawTokenData - The raw token data from the response.
   * @returns The structured token data.
   */
  private buildTokenData(rawTokenData: ITokenResponseData): IdpTokens {
    const {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope,
      id_token: idToken,
    } = rawTokenData;

    const tokenData: IdpTokens = {
      accessToken,
      tokenType,
    };

    if (expiresIn !== undefined) {
      tokenData.expiresIn = expiresIn;
    }
    if (refreshToken !== undefined) {
      tokenData.refreshToken = refreshToken;
    }
    if (scope !== undefined) {
      tokenData.scope = scope;
    }
    if (idToken !== undefined) {
      tokenData.idToken = idToken;
    }

    return tokenData;
  }

  /**
   * Fetches user data from the userinfo endpoint.
   * @param accessToken - The access token for authentication.
   * @returns Promise resolving to user data.
   */
  private async fetchUserData(accessToken: string): Promise<Record<string, unknown>> {
    const response = await fetch(this.config.userinfoEndpoint ?? '', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const data = await response.json();
    return data as Record<string, unknown>;
  }

  /**
   * Maps raw user data to IIdpUserInfo format.
   * @param userData - The raw user data from the provider.
   * @returns The mapped user information.
   */
  private mapUserData(userData: Record<string, unknown>): IIdpUserInfo {
    const mapping = this.config.userinfoMapping ?? {};

    return {
      id: this.getUserId(userData, mapping),
      email: this.getUserEmail(userData, mapping),
      emailVerified: this.getEmailVerified(userData, mapping),
      name: this.getUserName(userData, mapping),
      picture: this.getUserPicture(userData, mapping),
      raw: userData,
    };
  }

  /**
   * Extracts user ID from user data.
   * @param userInfo - The user information object.
   * @param mapping - The field mapping configuration.
   * @returns The user ID as a string.
   */
  private getUserId(
    userInfo: Record<string, unknown>,
    mapping: Record<string, string>
  ): string {
    const nestedValue = this.getNestedValue(userInfo, mapping.id ?? 'sub');
    const idValue = nestedValue ?? userInfo.sub ?? userInfo.id ?? '';
    return String(idValue);
  }

  /**
   * Extracts user email from user data.
   * @param userInfo - The user information object.
   * @param mapping - The field mapping configuration.
   * @returns The user email as a string.
   */
  private getUserEmail(
    userInfo: Record<string, unknown>,
    mapping: Record<string, string>
  ): string {
    const { email: customMappingPath } = mapping;
    const emailValue = customMappingPath
      ? this.getNestedValue(userInfo, customMappingPath) ?? userInfo.email
      : userInfo.email;

    return String(emailValue ?? '');
  }

  /**
   * Extracts email verification status from user data.
   * @param userInfo - The user information object.
   * @param mapping - The field mapping configuration.
   * @returns The email verification status.
   */
  private getEmailVerified(
    userInfo: Record<string, unknown>,
    mapping: Record<string, string>
  ): boolean {
    const verifiedValue = this.getNestedValue(
      userInfo,
      mapping.emailVerified ?? 'email_verified'
    );
    return Boolean(verifiedValue);
  }

  /**
   * Extracts user name from user data.
   * @param userInfo - The user information object.
   * @param mapping - The field mapping configuration.
   * @returns The user name as a string.
   */
  private getUserName(
    userInfo: Record<string, unknown>,
    mapping: Record<string, string>
  ): string {
    const { name: customMappingPath } = mapping;
    const nameValue = customMappingPath
      ? this.getNestedValue(userInfo, customMappingPath) ?? userInfo.name
      : userInfo.name;

    return String(nameValue ?? '');
  }

  /**
   * Extracts user picture URL from user data.
   * @param userInfo - The user information object.
   * @param mapping - The field mapping configuration.
   * @returns The user picture URL as a string.
   */
  private getUserPicture(
    userInfo: Record<string, unknown>,
    mapping: Record<string, string>
  ): string {
    const { picture: customMappingPath } = mapping;
    const pictureValue = customMappingPath
      ? this.getNestedValue(userInfo, customMappingPath) ?? userInfo.picture
      : userInfo.picture;

    return String(pictureValue ?? '');
  }

  /**
   * Retrieves a nested value from an object using a dot-separated path.
   * @param object - The object to search in.
   * @param path - The dot-separated path to the value.
   * @returns The nested value or undefined if not found.
   */
  private getNestedValue(object: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = object;

    for (const property of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }

      const obj = current as Record<string, unknown>;
      if (!(property in obj)) {
        return undefined;
      }

      current = obj[property];
    }

    return current;
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
  const normalizedIssuer = issuer.replace(/\/$/u, '');
  const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`;

  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw new Error(`Failed to discover OIDC configuration: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  const configData = data as IOIDCDiscoveryConfig;

  const {
    issuer: configIssuer,
    authorization_endpoint,
    token_endpoint,
    userinfo_endpoint,
    jwks_uri,
    scopes_supported,
    response_types_supported,
    grant_types_supported,
    token_endpoint_auth_methods_supported,
  } = configData;

  return {
    issuer: configIssuer,
    authorizationEndpoint: authorization_endpoint,
    tokenEndpoint: token_endpoint,
    userinfoEndpoint: userinfo_endpoint,
    jwksUri: jwks_uri,
    scopesSupported: scopes_supported,
    responseTypesSupported: response_types_supported,
    grantTypesSupported: grant_types_supported,
    tokenEndpointAuthMethods: token_endpoint_auth_methods_supported,
  };
};
