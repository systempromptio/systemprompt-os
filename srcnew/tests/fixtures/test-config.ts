/**
 * Test configuration fixtures
 */

export const TEST_CONFIG = {
  PORT: '3333',
  BASE_URL: 'http://localhost:3333',
  JWT_SECRET: 'test-jwt-secret',
  JWT_ISSUER: 'test-issuer',
  JWT_AUDIENCE: 'test-audience',
  NODE_ENV: 'test'
};

export const TEST_CLIENT = {
  id: 'test-client-001',
  secret: 'test-client-secret',
  name: 'Test Client',
  redirect_uris: ['http://localhost:8080/callback'],
  allowed_scopes: ['openid', 'profile', 'email']
};

export const TEST_USER = {
  id: 'test-user-001',
  username: 'testuser',
  email: 'test@example.com',
  name: 'Test User'
};

export const MOCK_OAUTH_PROVIDERS = {
  google: {
    client_id: 'mock-google-client-id',
    client_secret: 'mock-google-client-secret',
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token'
  },
  github: {
    client_id: 'mock-github-client-id',
    client_secret: 'mock-github-client-secret',
    authorization_endpoint: 'https://github.com/login/oauth/authorize',
    token_endpoint: 'https://github.com/login/oauth/access_token'
  }
};