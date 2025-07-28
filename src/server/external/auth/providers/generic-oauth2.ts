/**
 * Generic OAuth2 Provider.
 * Provides a generic OAuth2 implementation for authentication providers.
 * @file Generic OAuth2 Provider.
 * @module server/external/auth/providers/generic-oauth2
 */

import type {
  IGenericOAuth2Config, IOAuth2Provider, IOAuth2TokenResponse,
  IOAuth2UserInfo
} from '@/server/external/auth/providers/interface';

/**
 * Extended OAuth2 Config with additional parameters.
 * @interface IExtendedGenericOAuth2Config
 */
interface IExtendedGenericOAuth2Config extends IGenericOAuth2Config {
  authorizationParams?: Record<string, string>;
}

/**
 * Generic OAuth2 Provider implementation.
 * @class GenericOAuth2Provider
 * @implements IdentityProvider
 */
export class GenericOAuth2Provider implements IOAuth2Provider {
  public readonly id: string;
  public readonly name: string;
  public readonly type: 'oauth2' | 'oidc';
  private readonly config: IExtendedGenericOAuth2Config;

  /**
   * Constructs a new GenericOAuth2Provider instance.
   * @param config - The OAuth2 configuration.
   */
  constructor(config: IExtendedGenericOAuth2Config) {
    const {
 id, name, issuer, scope, userinfoMapping
} = config;
    this.id = id;
    this.name = name;
    this.type = issuer !== null && issuer !== undefined && issuer !== '' ? 'oidc' : 'oauth2';
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

    if (this.type === 'oidc' && nonce !== null && nonce !== undefined) {
      params.append('nonce', nonce);
    }

    const { authorizationParams } = this.config;
    if (authorizationParams !== null && authorizationParams !== undefined && typeof authorizationParams === 'object') {
      Object.entries(authorizationParams).forEach(([key, value]): void => {
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
   * Retrieves user information using access token.
   * @param accessToken - The access token.
   * @returns Promise resolving to user info.
   */
  public async getUserInfo(accessToken: string): Promise<IOAuth2UserInfo> {
    const { userinfoEndpoint } = this.config;
    if (userinfoEndpoint === null || userinfoEndpoint === undefined || userinfoEndpoint === '') {
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
    return this.parseUserInfo(data);
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
   * Parses user info from API response data.
   * @param data - The raw API response data.
   * @returns The parsed user info.
   */
  private parseUserInfo(data: Record<string, unknown>): IOAuth2UserInfo {
    const mapping = this.config.userinfoMapping ?? {};

    const id = this.extractUserId(data, mapping);
    if (id === '') {
      throw new Error('Unable to extract user ID from userinfo response');
    }

    const userInfo: IOAuth2UserInfo = { id };

    this.extractOptionalFields(data, mapping, userInfo);
    this.addUnmappedFields(data, mapping, userInfo);

    return userInfo;
  }

  /**
   * Extracts user ID from data.
   * @param data - The raw data.
   * @param mapping - The field mapping.
   * @returns The user ID string.
   */
  private extractUserId(data: Record<string, unknown>, mapping: Record<string, string>): string {
    let idValue: unknown;
    if (mapping.id !== null && mapping.id !== undefined) {
      idValue = this.getNestedValue(data, mapping.id);
    }
    idValue ??= this.getNestedValue(data, 'sub') ?? this.getNestedValue(data, 'id');
    return this.convertToString(idValue);
  }

  /**
   * Extracts optional user fields.
   * @param data - The raw data.
   * @param mapping - The field mapping.
   * @param userInfo - The user info object to populate.
   */
  private extractOptionalFields(
    data: Record<string, unknown>,
    mapping: Record<string, string>,
    userInfo: IOAuth2UserInfo
  ): void {
    const emailValue = this.extractFieldValue(data, mapping, 'email');
    const email = this.getStringValue(emailValue);
    if (email !== undefined) {
      userInfo.email = email;
    }

    const nameValue = this.extractFieldValue(data, mapping, 'name');
    const name = this.getStringValue(nameValue);
    if (name !== undefined) {
      userInfo.name = name;
    }

    const pictureValue = this.extractPictureValue(data, mapping);
    const picture = this.getStringValue(pictureValue);
    if (picture !== undefined) {
      userInfo.avatar = picture;
    }
  }

  /**
   * Extracts a field value from data using mapping or default field name.
   * @param data - The raw data.
   * @param mapping - The field mapping.
   * @param fieldName - The field name.
   * @returns The extracted value.
   */
  private extractFieldValue(
    data: Record<string, unknown>,
    mapping: Record<string, string>,
    fieldName: string
  ): unknown {
    let value: unknown;
    const mappingKey = mapping[fieldName];
    if (mappingKey !== null && mappingKey !== undefined) {
      value = this.getNestedValue(data, mappingKey);
    }
    value ??= this.getNestedValue(data, fieldName);
    return value;
  }

  /**
   * Extracts picture value from data.
   * @param data - The raw data.
   * @param mapping - The field mapping.
   * @returns The picture value.
   */
  private extractPictureValue(data: Record<string, unknown>, mapping: Record<string, string>): unknown {
    let value: unknown;
    if (mapping.picture !== null && mapping.picture !== undefined) {
      value = this.getNestedValue(data, mapping.picture);
    }
    value ??= this.getNestedValue(data, 'picture') ?? this.getNestedValue(data, 'avatar');
    return value;
  }

  /**
   * Adds unmapped fields to user info.
   * @param data - The raw data.
   * @param mapping - The field mapping.
   * @param userInfo - The user info object to populate.
   */
  private addUnmappedFields(
    data: Record<string, unknown>,
    mapping: Record<string, string>,
    userInfo: IOAuth2UserInfo
  ): void {
    const mappedTopLevelFields = new Set<string>();
    const reservedFields = ['id', 'email', 'name', 'avatar', 'picture'];

    Object.values(mapping).forEach((path): void => {
      if (typeof path === 'string' && !path.includes('.')) {
        mappedTopLevelFields.add(path);
      }
    });

    Object.entries(data).forEach(([key, value]): void => {
      if (!mappedTopLevelFields.has(key) && !reservedFields.includes(key)) {
        const shouldSkip = this.shouldSkipField(key, mapping);
        if (!shouldSkip) {
          userInfo[key] = value;
        }
      }
    });
  }

  /**
   * Determines if a field should be skipped.
   * @param key - The field key.
   * @param mapping - The field mapping.
   * @returns True if the field should be skipped.
   */
  private shouldSkipField(key: string, mapping: Record<string, string>): boolean {
    if (mapping.id !== null && mapping.id !== undefined && key === mapping.id) {
      return true;
    }
    if ((mapping.id === null || mapping.id === undefined) && (key === 'sub' || key === 'id')) {
      return true;
    }
    return false;
  }

  /**
   * Gets string value from unknown type.
   * @param value - The unknown value.
   * @returns The string value or undefined.
   */
  private getStringValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Converts unknown value to string.
   * @param value - The unknown value.
   * @returns The string value.
   */
  private convertToString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
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
      client_secret: clientSecret,
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

    const rawData = await response.json() as Record<string, unknown>;
    return this.parseTokenResponse(rawData);
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
      client_secret: clientSecret,
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

    const rawData = await response.json() as Record<string, unknown>;
    return this.parseTokenResponse(rawData);
  }

  /**
   * Parses token response from raw data.
   * @param rawData - The raw token response data.
   * @returns The parsed token response.
   */
  private parseTokenResponse(rawData: Record<string, unknown>): IOAuth2TokenResponse {
    const accessToken = this.getTokenField(rawData, 'access_token', 'accessToken');
    if (!accessToken) {
      throw new Error('No access token in response');
    }

    const tokenType = this.getTokenField(rawData, 'token_type', 'tokenType') ?? 'Bearer';
    const expiresIn = this.getNumberField(rawData, 'expires_in', 'expiresIn');
    const refreshToken = this.getTokenField(rawData, 'refresh_token', 'refreshToken');
    const scope = this.getTokenField(rawData, 'scope');

    const response: IOAuth2TokenResponse = {
      accessToken,
      tokenType
    };

    if (expiresIn !== undefined) {
      response.expiresIn = expiresIn;
    }
    if (refreshToken !== undefined) {
      response.refreshToken = refreshToken;
    }
    if (scope !== undefined) {
      response.scope = scope;
    }

    return response;
  }

  /**
   * Gets a token field from raw data.
   * @param data - The raw data.
   * @param snakeCase - The snake_case field name.
   * @param camelCase - The camelCase field name.
   * @returns The field value.
   */
  private getTokenField(
    data: Record<string, unknown>,
    snakeCase: string,
    camelCase?: string
  ): string | undefined {
    const snakeValue = data[snakeCase];
    if (typeof snakeValue === 'string') {
      return snakeValue;
    }

    if (camelCase) {
      const camelValue = data[camelCase];
      if (typeof camelValue === 'string') {
        return camelValue;
      }
    }

    return undefined;
  }

  /**
   * Gets a number field from raw data.
   * @param data - The raw data.
   * @param snakeCase - The snake_case field name.
   * @param camelCase - The camelCase field name.
   * @returns The field value.
   */
  private getNumberField(
    data: Record<string, unknown>,
    snakeCase: string,
    camelCase?: string
  ): number | undefined {
    const snakeValue = data[snakeCase];
    if (typeof snakeValue === 'number') {
      return snakeValue;
    }

    if (camelCase) {
      const camelValue = data[camelCase];
      if (typeof camelValue === 'number') {
        return camelValue;
      }
    }

    return undefined;
  }

  /**
   * Gets a nested value from an object using dot notation.
   * @param obj - The object to search in.
   * @param path - The dot-separated path to the value.
   * @returns The value at the path, or undefined if not found.
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (Array.isArray(current) && (/^\d+$/u).test(key)) {
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
