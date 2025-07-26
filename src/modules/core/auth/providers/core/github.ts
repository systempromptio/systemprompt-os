import type {
  IIdentityProvider,
  IIdpUserInfo,
  IdpTokens,
} from '@/modules/core/auth/types/provider-interface';
import type {
  IGitHubConfig,
  IGitHubEmailData,
  IGitHubUserData,
} from '@/modules/core/auth/providers/types/github.types';

/**
 * GitHub OAuth2 provider implementation.
 * Handles GitHub OAuth2 authentication flow including authorization,
 * token exchange, and user information retrieval.
 */
export class GitHubProvider implements IIdentityProvider {
  readonly id = 'github';
  readonly name = 'GitHub';
  readonly type = 'oauth2' as const;
  private readonly config: IGitHubConfig;
  private readonly authorizationEndpoint = 'https://github.com/login/oauth/authorize';
  private readonly tokenEndpoint = 'https://github.com/login/oauth/access_token';
  private readonly userEndpoint = 'https://api.github.com/user';
  private readonly emailEndpoint = 'https://api.github.com/user/emails';

  /**
   * Creates a new GitHubProvider instance.
   * @param config - The GitHub OAuth2 configuration.
   */
  constructor(config: IGitHubConfig) {
    this.config = {
      ...config,
      scope: config.scope ?? 'read:user user:email',
    };
  }

  /**
   * Generates the GitHub OAuth2 authorization URL.
   * @param state - The state parameter for CSRF protection.
   * @returns The authorization URL.
   */
  getAuthorizationUrl(state: string): string {
    const scope = this.config.scope ?? 'read:user user:email';
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope,
      state,
    });

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for access tokens.
   * @param code - The authorization code from GitHub.
   * @returns Promise resolving to IDPTokens.
   */
  async exchangeCodeForTokens(code: string): Promise<IdpTokens> {
    const clientSecret = this.config.clientSecret ?? '';
    if (clientSecret.length === 0) {
      throw new Error('Client secret is required for token exchange');
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code: ${errorText}`);
    }

    const tokenResponse = await response.json() as IdpTokens;

    return tokenResponse;
  }

  /**
   * Retrieves user information from GitHub API.
   * @param accessToken - The access token for API authentication.
   * @returns Promise resolving to IDPUserInfo.
   */
  async getUserInfo(accessToken: string): Promise<IIdpUserInfo> {
    const userData = await this.fetchUserData(accessToken);
    const emailInfo = await this.resolveUserEmail(accessToken, userData.email);

    return this.buildUserInfo(userData, emailInfo);
  }

  /**
   * Fetches user data from GitHub API.
   * @param accessToken - The access token for API authentication.
   * @returns Promise resolving to GitHub user data.
   */
  private async fetchUserData(accessToken: string): Promise<IGitHubUserData> {
    const userResponse = await fetch(this.userEndpoint, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to get user info: ${userResponse.statusText}`);
    }

    return await userResponse.json() as IGitHubUserData;
  }

  /**
   * Resolves user email information from GitHub API.
   * @param accessToken - The access token for API authentication.
   * @param publicEmail - The user's public email from profile.
   * @returns Promise resolving to email information.
   */
  private async resolveUserEmail(
    accessToken: string,
    publicEmail: string | undefined
  ): Promise<{ email?: string; verified: boolean }> {
    if (publicEmail) {
      return {
 email: publicEmail,
verified: true
};
    }

    const emailResponse = await fetch(this.emailEndpoint, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    });

    if (!emailResponse.ok) {
      return { verified: true };
    }

    const emails = await emailResponse.json() as IGitHubEmailData[];
    const primaryEmail = emails.find((emailData: IGitHubEmailData): boolean => { return emailData.primary });

    if (!primaryEmail) {
      return { verified: true };
    }

    return {
      email: primaryEmail.email,
      verified: primaryEmail.verified,
    };
  }

  /**
   * Builds the final user info object.
   * @param userData - The GitHub user data.
   * @param emailInfo - The resolved email information.
   * @param emailInfo.email
   * @param emailInfo.verified
   * @returns The formatted user info object.
   */
  private buildUserInfo(
    userData: IGitHubUserData,
    emailInfo: { email?: string; verified: boolean }
  ): IIdpUserInfo {
    const userInfo: IIdpUserInfo = {
      id: userData.id.toString(),
      emailVerified: emailInfo.verified,
      name: userData.name ?? userData.login,
      picture: userData.avatar_url,
      raw: userData,
    };

    if (emailInfo.email) {
      userInfo.email = emailInfo.email;
    }

    return userInfo;
  }
}
