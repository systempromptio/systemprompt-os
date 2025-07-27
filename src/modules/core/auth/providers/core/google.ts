import type {
  IGoogleConfig, IGoogleUserInfo, IIdentityProvider, IIdpUserInfo, IdpTokens
} from '@/modules/core/auth/types/provider-interface';

/**
 *
 * GoogleProvider class implementing Google OAuth2 authentication.
 * Provides methods for authorization, token exchange, user info retrieval,
 * token refresh, and token revocation.
 *
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
   *
   *Creates a new GoogleProvider instance.
   * @param config - The Google OAuth2 configuration.
   */
  constructor(config: IGoogleConfig) {
    this.config = {
      ...config,
      scope: config.scope ?? "email profile",
    };
  }

  /**
   *
   *Generates the Google OAuth2 authorization URL.
   * @param state - The state parameter for CSRF protection.
   * @param nonce - Optional nonce for OAuth2.
   * @returns The authorization URL.
   */
  getAuthorizationUrl(state: string, nonce?: string): string {
    const scope = this.config.scope ?? "email profile";
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope,
      state,
      access_type: "offline",
      prompt: "consent",
    });

    if (nonce && nonce.length > 0) {
      params.append("nonce", nonce);
    }

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   *
   *Exchanges an authorization code for access and refresh tokens.
   * @param code - The authorization code from Google.
   * @returns Promise resolving to token response.
   */
  async exchangeCodeForTokens(code: string): Promise<IdpTokens> {
    const {clientSecret} = this.config;
    if (!clientSecret || clientSecret.length === 0) {
      throw new Error("Client secret is required for token exchange");
    }

    const params = new URLSearchParams({
      code,
      client_id: this.config.clientId,
      client_secret: clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: "authorization_code",
    });

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code: ${errorText}`);
    }

    const tokenResponse: IdpTokens = await response.json() as IdpTokens;
    return tokenResponse;
  }

  /**
   *
   *Retrieves user information from Google using an access token.
   * @param accessToken - The access token from Google.
   * @returns Promise resolving to user information.
   */
  async getUserInfo(accessToken: string): Promise<IIdpUserInfo> {
    const response = await fetch(this.userInfoEndpoint, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const googleUserInfo: IGoogleUserInfo = await response.json() as IGoogleUserInfo;

    const result: IIdpUserInfo = {
      id: googleUserInfo.sub,
      raw: googleUserInfo as Record<string, unknown>,
    };

    if (googleUserInfo.email !== undefined) {
      result.email = googleUserInfo.email;
    }
    if (googleUserInfo.emailVerified !== undefined) {
      result.emailVerified = googleUserInfo.emailVerified;
    }
    if (googleUserInfo.name !== undefined) {
      result.name = googleUserInfo.name;
    }
    if (googleUserInfo.picture !== undefined) {
      result.picture = googleUserInfo.picture;
    }
    if (googleUserInfo.locale !== undefined) {
      result.locale = googleUserInfo.locale;
    }

    return result;
  }

  /**
   *
   *Refreshes access tokens using a refresh token.
   * @param refreshToken - The refresh token from Google.
   * @returns Promise resolving to new token response.
   */
  async refreshTokens(refreshToken: string): Promise<IdpTokens> {
    const {clientSecret} = this.config;
    if (!clientSecret || clientSecret.length === 0) {
      throw new Error("Client secret is required for token refresh");
    }

    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh tokens: ${response.statusText}`);
    }

    const tokenResponse: IdpTokens = await response.json() as IdpTokens;
    return tokenResponse;
  }

  /**
   *
   *Revokes an access or refresh token.
   * @param token - The token to revoke (access or refresh token).
   * @returns Promise that resolves when token is revoked.
   */
  async revokeTokens(token: string): Promise<void> {
    const params = new URLSearchParams({ token });

    const response = await fetch(this.revocationEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to revoke token: ${response.statusText}`);
    }
  }
}
