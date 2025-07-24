/**
 * OAuth and authentication types.
 */

export interface OAuthClient {
  id: string;
  secret?: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  createdAt: Date;
}

export interface OAuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  scope?: string;
  issuedAt: Date;
}

export interface OAuthCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  expiresAt: Date;
  createdAt: Date;
}
