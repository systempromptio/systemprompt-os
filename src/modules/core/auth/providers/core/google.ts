import type {
  IDPConfig, IDPTokens, IDPUserInfo, IIdentityProvider
} from '@/modules/core/auth/types/provider-interface.js';
// Removed unused imports

/**
 *
 * GoogleConfig interface.
 *
 */

export interface IGoogleConfig extends IDPConfig {
  discoveryurl?: string;
}

/**
 *
 * GoogleProvider class.
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

  constructor(config: IGoogleConfig) {
    this.config = {
      ...config,
      scope: config.scope || "openid email profile",
    };
  }

  getAuthorizationUrl(state: string, nonce?: string): string {
    const params = new URLSearchParams({
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      responseType: "code",
      scope: this.config.scope!,
      state,
      accessType: "offline",
      prompt: "consent",
    });

    if (nonce) {
      params.append("nonce", nonce);
    }

    return `${this.authorizationEndpoint}?${params}`;
  }

  async exchangeCodeForTokens(code: string): Promise<IDPTokens> {
    const params = new URLSearchParams({
      code,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret || '',
      redirectUri: this.config.redirectUri,
      grantType: "authorization_code",
    });

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
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

  async getUserInfo(accessToken: string): Promise<IDPUserInfo> {
    const response = await fetch(this.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    /**
     *  * Description.
     * Data function.
     */
    const data = (await response.json()) as any;

    return {
      id: data.sub,
      email: data.email,
      email_verified: data.email_verified,
      name: data.name,
      picture: data.picture,
      locale: data.locale,
      raw: data as Record<string, unknown>,
    };
  }

  async refreshTokens(refreshToken: string): Promise<IDPTokens> {
    const params = new URLSearchParams({
      refreshToken,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret || '',
      grantType: "refresh_token",
    });

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh tokens: ${response.statusText}`);
    }

    const data = await response.json();
    return data as IDPTokens;
  }

  async revokeTokens(token: string): Promise<void> {
    const params = new URLSearchParams({ token });

    const response = await fetch(this.revocationEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to revoke token: ${response.statusText}`);
    }
  }
}
