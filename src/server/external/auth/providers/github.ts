/**
 * GitHub Identity Provider implementation.
 * @file GitHub Identity Provider.
 * @module server/external/auth/providers/github
 */

import type {
 IGitHubConfig, IGitHubEmailData, IGitHubUserResponse
} from '@/server/external/auth/providers/types/github';
import type { IIdentityProvider } from '@/server/external/rest/oauth2/types/authorize.types';

interface GitHubTokenResponse {
  access_token?: unknown;
}

interface GitHubUserData {
  id?: unknown;
  login?: unknown;
  email?: unknown;
  name?: unknown;
  avatar_url?: unknown;
  [key: string]: unknown;
}

/**
 * GitHub OAuth2 provider implementation.
 */
export class GitHubProvider implements IIdentityProvider {
  name = 'github';
  private readonly config: IGitHubConfig;
  private readonly authorizationEndpoint = 'https://github.com/login/oauth/authorize';
  private readonly tokenEndpoint = 'https://github.com/login/oauth/access_token';
  private readonly userEndpoint = 'https://api.github.com/user';
  private readonly emailEndpoint = 'https://api.github.com/user/emails';

  /**
   * Creates a new GitHub provider instance.
   * @param config - GitHub OAuth2 configuration.
   */
  constructor(config: IGitHubConfig) {
    this.config = {
      ...config,
      scope: config.scope ?? 'read:user user:email',
    };
  }

  /**
   * Generates GitHub OAuth2 authorization URL.
   * @param state - OAuth2 state parameter.
   * @returns Authorization URL.
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams();
    params.append('client_id', this.config.client_id);
    params.append('redirect_uri', this.config.redirect_uri);
    params.append('scope', this.config.scope ?? 'read:user user:email');
    params.append('state', state);

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for access tokens.
   * @param code - Authorization code.
   * @returns Promise resolving to token response.
   * @throws {Error} When token exchange fails.
   */
  async exchangeCodeForTokens(code: string): Promise<{ accessToken: string }> {
    const clientSecret = this.config.client_secret;
    const secretValue = clientSecret === '' ? '' : clientSecret;

    const params = new URLSearchParams();
    params.append('client_id', this.config.client_id);
    params.append('client_secret', secretValue);
    params.append('code', code);
    params.append('redirect_uri', this.config.redirect_uri);

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const tokenResponse = await response.json() as GitHubTokenResponse;
    const { access_token: accessToken } = tokenResponse;

    if (typeof accessToken !== 'string') {
      throw new Error('Invalid token response: missing access_token');
    }

    return { accessToken };
  }

  /**
   * Legacy method for token exchange compatibility.
   * @param code - Authorization code.
   * @returns Promise resolving to token response.
   */
  async exchangeCodeForToken(code: string): Promise<{ accessToken: string }> {
    return await this.exchangeCodeForTokens(code);
  }

  /**
   * Retrieves user information from GitHub API.
   * @param accessToken - OAuth2 access token.
   * @returns Promise resolving to user info.
   * @throws {Error} When user info retrieval fails.
   */
  async getUserInfo(accessToken: string): Promise<{
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    raw?: GitHubUserData;
  }> {
    const userResponse = await fetch(this.userEndpoint, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to get user info: ${userResponse.statusText}`);
    }

    const userData = await userResponse.json() as GitHubUserData;
    const processedData = this.processUserData(userData);
    const { email: userEmail } = await this.getEmailInfo(
      accessToken,
      processedData.email
    );

    return this.buildUserInfo(processedData, userData, userEmail);
  }

  /**
   * Processes raw user data from GitHub API.
   * @param userData - Raw user data.
   * @returns Processed GitHub user data.
   * @throws {Error} When user data is invalid.
   */
  private processUserData(userData: GitHubUserData): IGitHubUserResponse {
    if (typeof userData.id !== 'number' || typeof userData.login !== 'string') {
      throw new Error('Invalid user data from GitHub API');
    }

    return {
      id: userData.id,
      login: userData.login,
      email: typeof userData.email === 'string' ? userData.email : null,
      name: typeof userData.name === 'string' ? userData.name : null,
      avatar_url: typeof userData.avatar_url === 'string' ? userData.avatar_url : ''
    };
  }

  /**
   * Builds the user info response.
   * @param gitHubData - Processed GitHub data.
   * @param rawData - Raw user data.
   * @param userEmail - User email.
   * @returns User info object.
   */
  private buildUserInfo(
    gitHubData: IGitHubUserResponse,
    rawData: GitHubUserData,
    userEmail: string | undefined
  ): {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    raw?: GitHubUserData;
  } {
    const result: {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
      raw?: GitHubUserData;
    } = {
      id: gitHubData.id.toString(),
      name: gitHubData.name ?? gitHubData.login,
      raw: rawData,
    };

    if (userEmail !== undefined) {
      result.email = userEmail;
    }

    const { avatar_url } = gitHubData;
    if (avatar_url !== undefined) {
      result.picture = avatar_url;
    }

    return result;
  }

  /**
   * Validates email data from GitHub API.
   * @param emailData - Raw email data from GitHub.
   * @returns Validated email data array.
   */
  private validateEmailData(emailData: unknown): IGitHubEmailData[] {
    if (!Array.isArray(emailData)) {
      return [];
    }

    return emailData.filter((item): item is IGitHubEmailData => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }

      const record = item;
      return 'email' in record
        && 'primary' in record
        && 'verified' in record
        && typeof record.email === 'string'
        && typeof record.primary === 'boolean'
        && typeof record.verified === 'boolean';
    });
  }

  /**
   * Retrieves email information from GitHub API.
   * @param accessToken - OAuth2 access token.
   * @param userEmail - Email from user profile.
   * @returns Promise resolving to email info.
   */
  private async getEmailInfo(
    accessToken: string,
    userEmail: string | null
  ): Promise<{ email: string | undefined; emailVerified: boolean }> {
    let email: string | undefined = userEmail ?? undefined;
    let emailVerified = true;

    if (email === undefined || email === '') {
      const emailResponse = await fetch(this.emailEndpoint, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      });

      if (emailResponse.ok) {
        const emailsData = await emailResponse.json();
        const emails = this.validateEmailData(emailsData);
        const primaryEmail = emails.find((emailItem: IGitHubEmailData): boolean => {
          return emailItem.primary;
        });
        if (primaryEmail !== undefined) {
          const { email: primaryEmailAddress, verified } = primaryEmail;
          email = primaryEmailAddress;
          emailVerified = verified;
        }
      }
    }

    return {
      email,
      emailVerified
    };
  }
}
