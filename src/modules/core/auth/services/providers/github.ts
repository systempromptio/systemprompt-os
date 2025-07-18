/**
 * @fileoverview GitHub Identity Provider
 * @module modules/core/auth/services/providers/github
 */

import { IdentityProvider, IDPConfig, IDPTokens, IDPUserInfo } from '../../types/provider-interface.js';

export interface GitHubConfig extends IDPConfig {
  // GitHub-specific config if needed
}

export class GitHubProvider implements IdentityProvider {
  id = 'github';
  name = 'GitHub';
  type = 'oauth2' as const;
  
  private config: GitHubConfig;
  private authorizationEndpoint = 'https://github.com/login/oauth/authorize';
  private tokenEndpoint = 'https://github.com/login/oauth/accesstoken';
  private userEndpoint = 'https://api.github.com/user';
  private emailEndpoint = 'https://api.github.com/user/emails';
  
  constructor( config: GitHubConfig) {
    this.config = {
      ...config,
      scope: config.scope || 'read:user user:email',
    };
  }
  
  getAuthorizationUrl( state: string): string {
    const params = new URLSearchParams({
      clientid: this.config.clientid,
      redirecturi: this.config.redirecturi,
      scope: this.config.scope!,
      state,
    });
    
    return `${this.authorizationEndpoint}?${params}`;
  }
  
  async exchangeCodeForTokens( code: string): Promise<IDPTokens> {
    const params = new URLSearchParams({
      clientid: this.config.clientid,
      clientsecret: this.config.clientsecret,
      code,
      redirecturi: this.config.redirecturi,
    });
    
    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }
    
    const data = await response.json() as any;
    
    return {
      accesstoken: data.accesstoken,
      tokentype: data.tokentype || 'Bearer',
      scope: data.scope,
    };
  }
  
  async getUserInfo( accessToken: string): Promise<IDPUserInfo> {
    // Get basic user info
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
    
    // Get primary email if not public
    let email = userData.email as string | undefined;
    let emailverified = true;
    
    if (!email) {
      const emailResponse = await fetch(this.emailEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      
      if (emailResponse.ok) {
        const emails = await emailResponse.json() as any[];
        const primaryEmail = emails.find(( e: any) => e.primary);
        if ( primaryEmail) {
          email = primaryEmail.email;
          emailverified = primaryEmail.verified;
        }
      }
    }
    
    return {
      id: userData.id.toString(),
      email,
      emailverified,
      name: userData.name || userData.login,
      picture: userData.avatarurl,
      raw: userData as Record<string, any>,
    };
  }
}