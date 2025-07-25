import type {
  IDPTokens,
  IDPUserInfo,
  IIdentityProvider,
} from '@/modules/core/auth/types/provider-interface';
import type {
  IGitHubConfig,
  IGitHubUserData,
  IGitHubEmailData,
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
   *
   * @param config - The GitHub OAuth2 configuration
   */
  constructor(config: IGitHubConfig) {
    this.config = {
      ...config,
      scope: config.scope ?? 'read:user user:email',
    };
  }

  /**
   * Generates the GitHub OAuth2 authorization URL.
   *
   * @param state - The state parameter for CSRF protection
   * @returns The authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const scope = this.config.scope ?? 'read:user user:email';
    const params = new URLSearchParams({
      'client_id': this.config.clientId,
      'redirect_uri': this.config.redirectUri,
      scope,
      state,
    });

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for access tokens.
   *
   * @param code - The authorization code from GitHub
   * @returns Promise resolving to IDPTokens
   */
  async exchangeCodeForTokens(code: string): Promise<IDPTokens> {
    const clientSecret = this.config.clientSecret ?? '';
    if (clientSecret.length === 0) {
      throw new Error('Client secret is required for token exchange');
    }

    const params = new URLSearchParams({
      'client_id': this.config.clientId,
      'client_secret': clientSecret,
      code,
      'redirect_uri': this.config.redirectUri,
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code: ${errorText}`);
    }

    const tokenResponse = await response.json() as IDPTokens;

    return tokenResponse;
  }

  /**
   * Retrieves user information from GitHub API.
   *
   * @param accessToken - The access token for API authentication
   * @returns Promise resolving to IDPUserInfo
   */
  async getUserInfo(accessToken: string): Promise<IDPUserInfo> {
    const userResponse = await fetch(this.userEndpoint, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to get user info: ${userResponse.statusText}`);
    }

    const userData = await userResponse.json() as IGitHubUserData;

    let userEmail = userData.email ?? undefined;
    let emailVerified = true;

    // If no public email, try to get primary email from emails endpoint
    if (userEmail === undefined || userEmail === null || userEmail.length === 0) {
      const emailResponse = await fetch(this.emailEndpoint, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json() as IGitHubEmailData[];
        const primaryEmail = emails.find((emailData: IGitHubEmailData): boolean => {
          return emailData.primary === true;
        });
        if (primaryEmail !== undefined) {
          const { email, verified } = primaryEmail;
          userEmail = email;
          emailVerified = verified;
        }
      }
    }

    const userInfo: IDPUserInfo = {
      id: userData.id.toString(),
      emailVerified,
      name: userData.name ?? userData.login,
      picture: userData.avatar_url,
      raw: userData as Record<string, unknown>,
    };

    // Only include email if it exists and is not empty
    if (userEmail !== undefined && userEmail !== null && userEmail.length > 0) {
      userInfo.email = userEmail;
    }

    return userInfo;
  }
}
