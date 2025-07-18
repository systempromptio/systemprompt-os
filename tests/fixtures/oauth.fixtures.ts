import type { OAuthClient, OAuthToken, OAuthCode } from '../../src/server/external/auth/types';

export function createOAuthClientFixture(overrides?: Partial<OAuthClient>): OAuthClient {
  return {
    id: 'test-client-001',
    secret: 'test-client-secret',
    name: 'Test Client',
    redirectUris: ['http://localhost:8080/callback'],
    allowedScopes: ['openid', 'profile', 'email'],
    createdAt: new Date('2024-01-01'),
    ...overrides
  };
}

export function createOAuthTokenFixture(overrides?: Partial<OAuthToken>): OAuthToken {
  return {
    accessToken: 'test-access-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
    refreshToken: 'test-refresh-token',
    scope: 'openid profile email',
    issuedAt: new Date(),
    ...overrides
  };
}

export function createOAuthCodeFixture(overrides?: Partial<OAuthCode>): OAuthCode {
  return {
    code: 'test-auth-code',
    clientId: 'test-client-001',
    userId: 'user-123',
    redirectUri: 'http://localhost:8080/callback',
    scope: 'openid profile email',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    createdAt: new Date(),
    ...overrides
  };
}

export const oauthFixtures = {
  defaultClient: createOAuthClientFixture(),
  
  publicClient: createOAuthClientFixture({
    id: 'public-client',
    secret: undefined,
    name: 'Public Client'
  }),
  
  expiredToken: createOAuthTokenFixture({
    accessToken: 'expired-token',
    issuedAt: new Date(Date.now() - 7200 * 1000), // 2 hours ago
    expiresIn: 3600 // 1 hour
  }),
  
  validCode: createOAuthCodeFixture(),
  
  expiredCode: createOAuthCodeFixture({
    code: 'expired-code',
    expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
    createdAt: new Date(Date.now() - 11 * 60 * 1000) // 11 minutes ago
  }),
  
  googleProvider: {
    client_id: 'mock-google-client-id',
    client_secret: 'mock-google-client-secret',
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    userinfo_endpoint: 'https://www.googleapis.com/oauth2/v2/userinfo'
  },
  
  githubProvider: {
    client_id: 'mock-github-client-id',
    client_secret: 'mock-github-client-secret',
    authorization_endpoint: 'https://github.com/login/oauth/authorize',
    token_endpoint: 'https://github.com/login/oauth/access_token',
    userinfo_endpoint: 'https://api.github.com/user'
  }
};