/**
 * @file GitHub Identity Provider.
 * @module server/external/auth/providers/github
 */

import type {
 IDPConfig, IDPTokens, IDPUserInfo, IdentityProvider
} from '@/server/external/auth/providers/interface';

export type GitHubConfig = IDPConfig;

export class GitHubProvider implements IdentityProvider {
  id = 'github';
  name = 'GitHub';
  type = 'oauth2' as const;
  private readonly config: GitHubConfig;
  private readonly authorizationEndpoint = 'https://github.com/login/oauth/authorize';
  private readonly tokenEndpoint = 'https://github.com/login/oauth/access_token';
  private readonly userEndpoint = 'https://api.github.com/user';
  private readonly emailEndpoint = 'https://api.github.com/user/emails';

  constructor(config: GitHubConfig) {
    this.config = {
      ...config,
      scope: config.scope || 'read:user user:email',
    };
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      scope: this.config.scope!,
      state,
    });

    return `${this.authorizationEndpoint}?${params}`;
  }

  async exchangeCodeForTokens(code: string): Promise<IDPTokens> {
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      client_secret: this.config.client_secret || "",
      code,
      redirect_uri: this.config.redirect_uri,
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        "Accept": 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const data = await response.json() as any;

    return data as IDPTokens;
  }

  async exchangeCodeForToken(code: string): Promise<IDPTokens> {
    return await this.exchangeCodeForTokens(code);
  }

  async getUserInfo(accessToken: string): Promise<IDPUserInfo> {
    const userResponse = await fetch(this.userEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to get user info: ${userResponse.statusText}`);
    }

    const userData = await userResponse.json() as any;

    let email = userData.email as string | undefined;
    let email_verified = true;

    if (!email) {
      const emailResponse = await fetch(this.emailEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json() as any[];
        const primaryEmail = emails.find((e: any) => { return e.primary });
        if (primaryEmail) {
          email = primaryEmail.email;
          email_verified = primaryEmail.verified;
        }
      }
    }

    return {
      id: userData.id.toString(),
      ...email !== undefined && { email },
      ...email !== undefined && { email_verified },
      name: userData.name || userData.login,
      picture: userData.avatar_url,
      raw: userData as Record<string, any>,
    };
  }
}
