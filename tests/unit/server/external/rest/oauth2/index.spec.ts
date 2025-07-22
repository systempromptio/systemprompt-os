/**
 * Unit tests for OAuth2 routes configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Router } from 'express';
import { setupOAuth2Routes } from '../../../../../../src/server/external/rest/oauth2/index';

// Mock all the endpoint classes
vi.mock('../../../../../../src/server/external/rest/oauth2/well-known', () => ({
  WellKnownEndpoint: vi.fn().mockImplementation(() => ({
    getJWKS: vi.fn()
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/protected-resource', () => ({
  ProtectedResourceEndpoint: vi.fn().mockImplementation(() => ({
    getProtectedResourceMetadata: vi.fn()
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/authorization-server', () => ({
  AuthorizationServerEndpoint: vi.fn().mockImplementation(() => ({
    getAuthorizationServerMetadata: vi.fn()
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/register', () => ({
  RegisterEndpoint: vi.fn().mockImplementation(() => ({
    register: vi.fn()
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/authorize', () => ({
  AuthorizeEndpoint: vi.fn().mockImplementation(() => ({
    getAuthorize: vi.fn(),
    postAuthorize: vi.fn(),
    handleProviderCallback: vi.fn()
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/token', () => ({
  TokenEndpoint: vi.fn().mockImplementation(() => ({
    postToken: vi.fn()
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/userinfo', () => ({
  UserInfoEndpoint: vi.fn().mockImplementation(() => ({
    getUserInfo: vi.fn()
  }))
}));

vi.mock('../../../../../../src/server/external/middleware/auth', () => ({
  authMiddleware: vi.fn((req, res, next) => next())
}));

describe('setupOAuth2Routes', () => {
  let mockRouter: any;
  const baseUrl = 'https://example.com';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock router with tracking capabilities
    const routes: any[] = [];
    mockRouter = {
      get: vi.fn((path, ...handlers) => {
        routes.push({ method: 'GET', path, handlers });
      }),
      post: vi.fn((path, ...handlers) => {
        routes.push({ method: 'POST', path, handlers });
      }),
      routes
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should setup all OAuth2 routes', async () => {
    await setupOAuth2Routes(mockRouter, baseUrl);

    // Check that all expected routes were registered
    expect(mockRouter.get).toHaveBeenCalledTimes(6);
    expect(mockRouter.post).toHaveBeenCalledTimes(3);

    // Check specific route registrations
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/.well-known/oauth-protected-resource',
      expect.any(Function)
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/.well-known/oauth-authorization-server',
      expect.any(Function)
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/.well-known/jwks.json',
      expect.any(Function)
    );
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/oauth2/register',
      expect.any(Function)
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/oauth2/authorize',
      expect.any(Function)
    );
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/oauth2/authorize',
      expect.any(Function)
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/oauth2/callback/:provider',
      expect.any(Function)
    );
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/oauth2/token',
      expect.any(Function)
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/oauth2/userinfo',
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('should initialize all endpoint handlers with correct parameters', async () => {
    const { WellKnownEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/well-known');
    const { ProtectedResourceEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/protected-resource');
    const { AuthorizationServerEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/authorization-server');
    const { RegisterEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/register');
    const { AuthorizeEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/authorize');
    const { TokenEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/token');
    const { UserInfoEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/userinfo');

    await setupOAuth2Routes(mockRouter, baseUrl);

    // Check endpoints that require baseUrl
    expect(WellKnownEndpoint).toHaveBeenCalledWith(baseUrl);
    expect(ProtectedResourceEndpoint).toHaveBeenCalledWith(baseUrl);
    expect(AuthorizationServerEndpoint).toHaveBeenCalledWith(baseUrl);

    // Check endpoints that don't require baseUrl
    expect(RegisterEndpoint).toHaveBeenCalledWith();
    expect(AuthorizeEndpoint).toHaveBeenCalledWith();
    expect(TokenEndpoint).toHaveBeenCalledWith();
    expect(UserInfoEndpoint).toHaveBeenCalledWith();
  });

  it('should use authMiddleware for protected routes', async () => {
    const { authMiddleware } = await import('../../../../../../src/server/external/middleware/auth');
    
    await setupOAuth2Routes(mockRouter, baseUrl);

    // Find the userinfo route registration
    const userinfoRoute = mockRouter.routes.find(
      (r: any) => r.method === 'GET' && r.path === '/oauth2/userinfo'
    );

    expect(userinfoRoute).toBeDefined();
    expect(userinfoRoute.handlers).toHaveLength(2);
    expect(userinfoRoute.handlers[0]).toBe(authMiddleware);
  });

  it('should handle routes correctly when called', async () => {
    await setupOAuth2Routes(mockRouter, baseUrl);

    // Simulate calling the routes
    const routes = mockRouter.routes;

    // Test well-known routes
    const protectedResourceRoute = routes.find(
      (r: any) => r.path === '/.well-known/oauth-protected-resource'
    );
    expect(protectedResourceRoute).toBeDefined();

    const authServerRoute = routes.find(
      (r: any) => r.path === '/.well-known/oauth-authorization-server'
    );
    expect(authServerRoute).toBeDefined();

    const jwksRoute = routes.find(
      (r: any) => r.path === '/.well-known/jwks.json'
    );
    expect(jwksRoute).toBeDefined();

    // Test OAuth2 routes
    const registerRoute = routes.find(
      (r: any) => r.method === 'POST' && r.path === '/oauth2/register'
    );
    expect(registerRoute).toBeDefined();

    const authorizeGetRoute = routes.find(
      (r: any) => r.method === 'GET' && r.path === '/oauth2/authorize'
    );
    expect(authorizeGetRoute).toBeDefined();

    const authorizePostRoute = routes.find(
      (r: any) => r.method === 'POST' && r.path === '/oauth2/authorize'
    );
    expect(authorizePostRoute).toBeDefined();

    const callbackRoute = routes.find(
      (r: any) => r.path === '/oauth2/callback/:provider'
    );
    expect(callbackRoute).toBeDefined();

    const tokenRoute = routes.find(
      (r: any) => r.method === 'POST' && r.path === '/oauth2/token'
    );
    expect(tokenRoute).toBeDefined();

    const userinfoRoute = routes.find(
      (r: any) => r.method === 'GET' && r.path === '/oauth2/userinfo'
    );
    expect(userinfoRoute).toBeDefined();
  });

  it('should return a Promise that resolves to void', async () => {
    const result = await setupOAuth2Routes(mockRouter, baseUrl);
    expect(result).toBeUndefined();
  });

  it('should work with different baseUrl formats', async () => {
    const { WellKnownEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/well-known');
    const { ProtectedResourceEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/protected-resource');
    const { AuthorizationServerEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/authorization-server');

    const testUrls = [
      'http://localhost:3000',
      'https://api.example.com',
      'https://example.com/api/v1'
    ];

    for (const testUrl of testUrls) {
      vi.clearAllMocks();
      await setupOAuth2Routes(mockRouter, testUrl);

      expect(WellKnownEndpoint).toHaveBeenCalledWith(testUrl);
      expect(ProtectedResourceEndpoint).toHaveBeenCalledWith(testUrl);
      expect(AuthorizationServerEndpoint).toHaveBeenCalledWith(testUrl);
    }
  });
});