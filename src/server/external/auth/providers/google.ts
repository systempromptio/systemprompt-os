/**
 * Google OAuth2 Identity Provider implementation.
 * @file Google Identity Provider.
 * @module server/external/auth/providers/google
 */

import type { IGoogleConfig } from '@/server/external/auth/providers/types/google';
import type { IIdentityProvider } from '@/server/external/rest/oauth2/types/authorize.types';

/**
 * Type guard to check if value has access_token property.
 * @param {unknown} value - Value to check.
 * @returns {boolean} True if value has access_token property.
 */
const hasAccessToken = (value: unknown): value is {

  'access_token': unknown;
  [key: string]: unknown
} => {
  return typeof value === 'object'
    && value !== null
    && 'access_token' in value;
};

/**
 * Type guard to check if value has sub property.
 * @param {unknown} value - Value to check.
 * @returns {boolean} True if value has sub property.
 */
const hasSubProperty = (value: unknown): value is {
  sub: unknown;
  email?: unknown;
  name?: unknown;
  picture?: unknown;
  [key: string]: unknown;
} => {
  return typeof value === 'object'
    && value !== null
    && 'sub' in value;
};

/**
 * Google OAuth2 provider implementation.
 * @class GoogleProvider
 * @implements {IdentityProvider}
 */
export class GoogleProvider implements IIdentityProvider {
  name = "google";
  private readonly config: IGoogleConfig;
  private readonly authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
  private readonly tokenEndpoint = "https://oauth2.googleapis.com/token";
  private readonly userInfoEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo";

  /**
   * Creates a new Google provider instance.
   * @param {IGoogleConfig} config - Google OAuth2 configuration.
   */
  constructor(config: IGoogleConfig) {
    this.config = {
      ...config,
      scope: config.scope ?? "email profile",
    };
  }

  /**
   * Generates the Google OAuth2 authorization URL.
   * @param {string} state - OAuth2 state parameter.
   * @returns {string} The authorization URL.
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: this.config.scope ?? "email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    });

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for access tokens.
   * @param {string} code - Authorization code from Google.
   * @returns {Promise<{ accessToken: string }>} Promise resolving to token response.
   * @throws {Error} When token exchange fails.
   */
  async exchangeCodeForTokens(code: string): Promise<{ accessToken: string }> {
    const params = new URLSearchParams({
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: "authorization_code",
    });

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        'Content-Type': "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const tokenResponse: unknown = await response.json();
    if (!hasAccessToken(tokenResponse)) {
      throw new Error('Invalid token response from Google');
    }

    const { 'access_token': accessTokenValue } = tokenResponse;
    if (typeof accessTokenValue !== 'string') {
      throw new Error('Invalid access token in response');
    }
    return { accessToken: accessTokenValue };
  }

  /**
   * Retrieves user information from Google using access token.
   * @param {string} token - Valid access token.
   * @returns {Promise<{ id: string; email?: string; name?: string; picture?: string;
   * raw?: Record<string, unknown> }>} Promise resolving to user information.
   * @throws {Error} When user info retrieval fails.
   */
  async getUserInfo(token: string): Promise<{
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    raw?: Record<string, unknown>;
  }> {
    const response = await fetch(this.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const googleUserInfo: unknown = await response.json();
    if (!hasSubProperty(googleUserInfo)) {
      throw new Error('Invalid user info response from Google');
    }

    return this.buildUserInfoResponse(googleUserInfo);
  }

  /**
   * Builds the user info response from Google user data.
   * @param {object} userInfo - Google user info.
   * @param {unknown} userInfo.sub - User ID.
   * @param {unknown} userInfo.email - User email.
   * @param {unknown} userInfo.name - User name.
   * @param {unknown} userInfo.picture - User picture.
   * @returns {object} User info response.
   * @private
   */
  private buildUserInfoResponse(userInfo: {
    sub: unknown;
    email?: unknown;
    name?: unknown;
    picture?: unknown;
    [key: string]: unknown;
  }): {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    raw?: Record<string, unknown>;
  } {
    if (typeof userInfo.sub !== 'string') {
      throw new Error('Invalid user ID in Google response');
    }

    const result: {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
      raw?: Record<string, unknown>;
    } = {
      id: userInfo.sub,
      raw: { ...userInfo },
    };

    const {
      email, name, picture
    } = userInfo;
    if (typeof email === 'string') {
      result.email = email;
    }
    if (typeof name === 'string') {
      result.name = name;
    }
    if (typeof picture === 'string') {
      result.picture = picture;
    }

    return result;
  }
}
