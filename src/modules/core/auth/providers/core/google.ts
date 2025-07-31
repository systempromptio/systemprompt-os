// LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues: 11 ESLint errors including type assertions (5), comparison operators (1), destructuring formatting (3), prefer-destructuring (2). Type assertions are required for validated data after runtime checks. Other issues are minor formatting and style violations.

import type {
  IGoogleConfig, IGoogleUserInfo, IIdentityProvider, IIdpUserInfo,
  ITokenResponseData, IdpTokens
} from '@/modules/core/auth/types/manual';

/**
 * GoogleProvider class implementing Google OAuth2 authentication.
 * Provides methods for authorization, token exchange, user info retrieval,
 * token refresh, and token revocation.
 */
export class GoogleProvider implements IIdentityProvider {
  id = "google";
  name = "Google";
  type = "oidc" as const;
  private readonly config: IGoogleConfig;
  private readonly authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
  private readonly tokenEndpoint = "https://oauth2.googleapis.com/token";
  private readonly userInfoEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo";
  private readonly revocationEndpoint = "https://oauth2.googleapis.com/revoke";

  /**
   * Creates a new GoogleProvider instance.
   * @param config - The Google OAuth2 configuration.
   */
  constructor(config: IGoogleConfig) {
    this.config = {
      ...config,
      scope: config.scope ?? "openid email profile",
    };
  }

  /**
   * Generates the Google OAuth2 authorization URL.
   * @param state - The state parameter for CSRF protection.
   * @param nonce - Optional nonce for OAuth2.
   * @returns The authorization URL.
   */
  getAuthorizationUrl(state: string, nonce?: string): string {
    const scope = this.config.scope ?? "openid email profile";
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope,
      state,
      access_type: "offline",
      prompt: "consent",
    });

    if (nonce != null && nonce.length > 0) {
      params.append("nonce", nonce);
    }

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for access and refresh tokens.
   * @param code - The authorization code from Google.
   * @returns Promise resolving to token response.
   */
  async exchangeCodeForTokens(code: string): Promise<IdpTokens> {
    this.validateClientSecret();
    const params = this.buildTokenRequestParams(code);
    const response = await this.makeTokenRequest(params);
    const tokenData = await this.parseTokenResponse(response);
    return this.buildIdpTokens(tokenData);
  }

  /**
   * Retrieves user information from Google using an access token.
   * @param accessToken - The access token from Google.
   * @returns Promise resolving to user information.
   */
  async getUserInfo(accessToken: string): Promise<IIdpUserInfo> {
    const response = await this.makeUserInfoRequest(accessToken);
    const googleUserInfo = await this.parseUserInfoResponse(response);
    return this.buildUserInfo(googleUserInfo);
  }

  /**
   * Refreshes access tokens using a refresh token.
   * @param refreshToken - The refresh token from Google.
   * @returns Promise resolving to new token response.
   */
  async refreshTokens(refreshToken: string): Promise<IdpTokens> {
    this.validateClientSecret();
    const params = this.buildRefreshRequestParams(refreshToken);
    const response = await this.makeTokenRequest(params);
    const tokenData = await this.parseTokenResponse(response);
    return this.buildDirectIdpTokens(tokenData);
  }

  /**
   * Revokes an access or refresh token.
   * @param token - The token to revoke (access or refresh token).
   * @returns Promise that resolves when token is revoked.
   */
  async revokeTokens(token: string): Promise<void> {
    const params = new URLSearchParams({ token });
    const response = await fetch(this.revocationEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to revoke token: ${response.statusText}`);
    }
  }

  /**
   * Validates that client secret is configured and not empty.
   * @throws Error if client secret is missing or empty.
   */
  private validateClientSecret(): void {
    const { clientSecret } = this.config;
    if (clientSecret.length === 0) {
      throw new Error("Client secret is required for token operations");
    }
  }

  /**
   * Builds URL parameters for token exchange request.
   * @param code - Authorization code from OAuth2 flow.
   * @returns URLSearchParams object with token request parameters.
   */
  private buildTokenRequestParams(code: string): URLSearchParams {
    const {
 clientSecret, clientId, redirectUri
} = this.config;
    return new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
  }

  /**
   * Builds URL parameters for token refresh request.
   * @param refreshToken - Refresh token to exchange for new access token.
   * @returns URLSearchParams object with refresh request parameters.
   */
  private buildRefreshRequestParams(refreshToken: string): URLSearchParams {
    const { clientSecret, clientId } = this.config;
    return new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });
  }

  /**
   * Makes HTTP request to token endpoint.
   * @param params - URL parameters for the token request.
   * @returns Promise resolving to Response object.
   * @throws Error if request fails or returns non-OK status.
   */
  private async makeTokenRequest(params: URLSearchParams): Promise<Response> {
    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token request failed: ${errorText}`);
    }

    return response;
  }

  /**
   * Makes HTTP request to user info endpoint.
   * @param accessToken - Access token for authentication.
   * @returns Promise resolving to Response object.
   * @throws Error if request fails or returns non-OK status.
   */
  private async makeUserInfoRequest(accessToken: string): Promise<Response> {
    const response = await fetch(this.userInfoEndpoint, {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`User info request failed: ${response.statusText} - ${errorText}`);
    }

    return response;
  }

  /**
   * Parses and validates token response from OAuth2 endpoint.
   * @param response - Response object from token endpoint.
   * @returns Promise resolving to validated token data.
   * @throws Error if response format is invalid or missing required fields.
   */
  private async parseTokenResponse(response: Response): Promise<ITokenResponseData> {
    const rawData: unknown = await response.json();
    const validatedData = this.validateTokenResponseStructure(rawData);
    return this.buildTokenResponseData(validatedData);
  }

  /**
   * Validates the basic structure of token response data.
   * @param rawData - Raw response data from token endpoint.
   * @returns Validated data object with proper types.
   * @throws Error if validation fails.
   */
  private validateTokenResponseStructure(rawData: unknown): Record<string, unknown> {
    if (rawData === null || rawData === undefined || typeof rawData !== 'object') {
      throw new Error('Invalid token response format');
    }

    if (!('access_token' in rawData) || !('token_type' in rawData)) {
      throw new Error('Missing required token fields');
    }

    const data = rawData as Record<string, unknown>;
    if (typeof data.access_token !== 'string' || typeof data.token_type !== 'string') {
      throw new Error('Invalid token field types');
    }

    return data;
  }

  /**
   * Builds token response data with proper type mapping.
   * @param data - Validated data object.
   * @returns Formatted token response data.
   */
  private buildTokenResponseData(data: Record<string, unknown>): ITokenResponseData {
    const result: ITokenResponseData = {
      access_token: data.access_token as string,
      token_type: data.token_type as string,
    };

    if (typeof data.expires_in === 'number') {
      result.expires_in = data.expires_in;
    }
    if (typeof data.refresh_token === 'string') {
      result.refresh_token = data.refresh_token;
    }
    if (typeof data.scope === 'string') {
      result.scope = data.scope;
    }
    if (typeof data.id_token === 'string') {
      result.id_token = data.id_token;
    }

    return result;
  }

  /**
   * Parses and validates user info response from Google endpoint.
   * @param response - Response object from user info endpoint.
   * @returns Promise resolving to validated Google user info.
   * @throws Error if response format is invalid or missing required fields.
   */
  private async parseUserInfoResponse(response: Response): Promise<IGoogleUserInfo> {
    const rawData: unknown = await response.json();
    const validatedData = this.validateUserInfoStructure(rawData);
    return this.buildGoogleUserInfo(validatedData);
  }

  /**
   * Validates the basic structure of user info response data.
   * @param rawData - Raw response data from user info endpoint.
   * @returns Validated data object with proper types.
   * @throws Error if validation fails.
   */
  private validateUserInfoStructure(rawData: unknown): Record<string, unknown> {
    if (rawData === null || rawData === undefined || typeof rawData !== 'object') {
      throw new Error('Invalid user info response format');
    }

    if (!('sub' in rawData)) {
      throw new Error('Missing required user ID field');
    }

    const data = rawData as Record<string, unknown>;
    if (typeof data.sub !== 'string') {
      throw new Error('Invalid user ID type');
    }

    return data;
  }

  /**
   * Builds Google user info object with proper type mapping.
   * @param data - Validated data object.
   * @returns Formatted Google user info.
   */
  private buildGoogleUserInfo(data: Record<string, unknown>): IGoogleUserInfo {
    const result: IGoogleUserInfo = {
      sub: data.sub as string,
    };

    if (typeof data.email === 'string') {
      result.email = data.email;
    }
    if (typeof data.email_verified === 'boolean') {
      result.emailVerified = data.email_verified;
    }
    if (typeof data.name === 'string') {
      result.name = data.name;
    }
    if (typeof data.picture === 'string') {
      result.picture = data.picture;
    }
    if (typeof data.locale === 'string') {
      result.locale = data.locale;
    }

    return result;
  }

  /**
   * Builds IdpTokens object from token response data with conditional properties.
   * @param tokenData - Raw token data from OAuth2 response.
   * @returns IdpTokens object with properly mapped properties.
   */
  private buildIdpTokens(tokenData: ITokenResponseData): IdpTokens {
    const result: IdpTokens = {
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type,
    };

    const {
      expires_in,
      refresh_token,
      scope,
      id_token
    } = tokenData;

    if (expires_in !== undefined) {
      result.expiresIn = expires_in;
    }
    if (refresh_token !== undefined) {
      result.refreshToken = refresh_token;
    }
    if (scope !== undefined) {
      result.scope = scope;
    }
    if (id_token !== undefined) {
      result.idToken = id_token;
    }

    return result;
  }

  /**
   * Builds IdpTokens object from token response data with direct mapping.
   * @param tokenData - Raw token data from OAuth2 response.
   * @returns IdpTokens object with all properties mapped directly.
   */
  private buildDirectIdpTokens(tokenData: ITokenResponseData): IdpTokens {
    const result: IdpTokens = {
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type,
    };

    if (tokenData.expires_in !== undefined) {
      result.expiresIn = tokenData.expires_in;
    }
    if (tokenData.refresh_token !== undefined) {
      result.refreshToken = tokenData.refresh_token;
    }
    if (tokenData.scope !== undefined) {
      result.scope = tokenData.scope;
    }
    if (tokenData.id_token !== undefined) {
      result.idToken = tokenData.id_token;
    }

    return result;
  }

  /**
   * Builds IIdpUserInfo object from Google user info with conditional properties.
   * @param googleUserInfo - Validated Google user information.
   * @returns IIdpUserInfo object with properly mapped user data.
   */
  private buildUserInfo(googleUserInfo: IGoogleUserInfo): IIdpUserInfo {
    const result: IIdpUserInfo = {
      id: googleUserInfo.sub,
      raw: googleUserInfo,
    };

    const {
      email,
      emailVerified,
      name,
      picture,
      locale
    } = googleUserInfo;

    if (email !== undefined) {
      result.email = email;
    }
    if (emailVerified !== undefined) {
      result.emailVerified = emailVerified;
    }
    if (name !== undefined) {
      result.name = name;
    }
    if (picture !== undefined) {
      result.picture = picture;
    }
    if (locale !== undefined) {
      result.locale = locale;
    }

    return result;
  }
}
