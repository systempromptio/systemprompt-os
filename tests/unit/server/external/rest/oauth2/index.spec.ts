/**
 * Unit tests for OAuth2 routes configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { setupOAuth2Routes } from '../../../../../../src/server/external/rest/oauth2/index.js';

// Mock all the endpoint classes
vi.mock('../../../../../../src/server/external/rest/oauth2/well-known', () => ({
  WellKnownEndpoint: vi.fn().mockImplementation(() => ({
    getJWKS: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/protected-resource', () => ({
  ProtectedResourceEndpoint: vi.fn().mockImplementation(() => ({
    getProtectedResourceMetadata: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/authorization-server', () => ({
  AuthorizationServerEndpoint: vi.fn().mockImplementation(() => ({
    getAuthorizationServerMetadata: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/register', () => ({
  RegisterEndpoint: vi.fn().mockImplementation(() => ({
    register: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/authorize', () => ({
  AuthorizeEndpoint: vi.fn().mockImplementation(() => ({
    getAuthorize: vi.fn().mockResolvedValue(undefined),
    postAuthorize: vi.fn().mockResolvedValue(undefined),
    handleProviderCallback: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/token', () => ({
  TokenEndpoint: vi.fn().mockImplementation(() => ({
    postToken: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../../../../src/server/external/rest/oauth2/userinfo', () => ({
  UserInfoEndpoint: vi.fn().mockImplementation(() => ({
    getUserInfo: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('setupOAuth2Routes', () => {
  let mockRouter: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

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
      use: vi.fn(),
      routes
    };

    // Create mock Express objects
    mockRequest = {};
    mockResponse = {
      setHeader: vi.fn(),
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should setup all OAuth2 routes with security headers middleware', () => {
    setupOAuth2Routes(mockRouter);

    // Check that security headers middleware was applied
    expect(mockRouter.use).toHaveBeenCalledTimes(1);
    expect(mockRouter.use).toHaveBeenCalledWith(expect.any(Function));

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

  it('should initialize all endpoint handlers without parameters', async () => {
    const { WellKnownEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/well-known'));
    const { ProtectedResourceEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/protected-resource'));
    const { AuthorizationServerEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/authorization-server'));
    const { RegisterEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/register'));
    const { AuthorizeEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/authorize'));
    const { TokenEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/token'));
    const { UserInfoEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/userinfo'));

    setupOAuth2Routes(mockRouter);

    // Check that all endpoints are initialized without parameters
    expect(WellKnownEndpoint).toHaveBeenCalledWith();
    expect(ProtectedResourceEndpoint).toHaveBeenCalledWith();
    expect(AuthorizationServerEndpoint).toHaveBeenCalledWith();
    expect(RegisterEndpoint).toHaveBeenCalledWith();
    expect(AuthorizeEndpoint).toHaveBeenCalledWith();
    expect(TokenEndpoint).toHaveBeenCalledWith();
    expect(UserInfoEndpoint).toHaveBeenCalledWith();
  });

  it('should apply security headers middleware correctly', () => {
    setupOAuth2Routes(mockRouter);

    // Get the security headers middleware function
    const securityHeadersMiddleware = mockRouter.use.mock.calls[0][0];
    
    // Call the middleware with mock objects
    securityHeadersMiddleware(mockRequest, mockResponse, mockNext);

    // Verify all security headers are set
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should use internal authMiddleware for userinfo route', () => {
    setupOAuth2Routes(mockRouter);

    // Find the userinfo route registration
    const userinfoRoute = mockRouter.routes.find(
      (r: any) => r.method === 'GET' && r.path === '/oauth2/userinfo'
    );

    expect(userinfoRoute).toBeDefined();
    expect(userinfoRoute.handlers).toHaveLength(2);
    // The first handler should be the internal authMiddleware
    expect(userinfoRoute.handlers[0]).toBeTypeOf('function');
  });

  it('should test internal authMiddleware behavior', () => {
    setupOAuth2Routes(mockRouter);

    // Find the userinfo route and get the auth middleware
    const userinfoRoute = mockRouter.routes.find(
      (r: any) => r.method === 'GET' && r.path === '/oauth2/userinfo'
    );

    const authMiddleware = userinfoRoute.handlers[0];
    
    // Test that the auth middleware calls next()
    authMiddleware(mockRequest, mockResponse, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should handle discovery route calls correctly', async () => {
    const { WellKnownEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/well-known'));
    const { ProtectedResourceEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/protected-resource'));
    const { AuthorizationServerEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/authorization-server'));

    const mockWellKnownInstance = { getJWKS: vi.fn() };
    const mockProtectedResourceInstance = { getProtectedResourceMetadata: vi.fn() };
    const mockAuthServerInstance = { getAuthorizationServerMetadata: vi.fn() };

    WellKnownEndpoint.mockImplementation(() => mockWellKnownInstance as any);
    ProtectedResourceEndpoint.mockImplementation(() => mockProtectedResourceInstance as any);
    AuthorizationServerEndpoint.mockImplementation(() => mockAuthServerInstance as any);

    setupOAuth2Routes(mockRouter);

    // Test protected resource route
    const protectedResourceRoute = mockRouter.routes.find(
      (r: any) => r.path === '/.well-known/oauth-protected-resource'
    );
    const protectedResourceHandler = protectedResourceRoute.handlers[0];
    protectedResourceHandler(mockRequest, mockResponse);
    expect(mockProtectedResourceInstance.getProtectedResourceMetadata).toHaveBeenCalledWith(mockRequest, mockResponse);

    // Test authorization server route
    const authServerRoute = mockRouter.routes.find(
      (r: any) => r.path === '/.well-known/oauth-authorization-server'
    );
    const authServerHandler = authServerRoute.handlers[0];
    authServerHandler(mockRequest, mockResponse);
    expect(mockAuthServerInstance.getAuthorizationServerMetadata).toHaveBeenCalledWith(mockRequest, mockResponse);

    // Test JWKS route
    const jwksRoute = mockRouter.routes.find(
      (r: any) => r.path === '/.well-known/jwks.json'
    );
    const jwksHandler = jwksRoute.handlers[0];
    jwksHandler(mockRequest, mockResponse);
    expect(mockWellKnownInstance.getJWKS).toHaveBeenCalledWith(mockRequest, mockResponse);
  });

  it('should handle OAuth2 flow route calls correctly', async () => {
    const { RegisterEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/register'));
    const { AuthorizeEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/authorize'));
    const { TokenEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/token'));
    const { UserInfoEndpoint } = vi.mocked(await import('../../../../../../src/server/external/rest/oauth2/userinfo'));

    const mockRegisterInstance = { register: vi.fn() };
    const mockAuthorizeInstance = { 
      getAuthorize: vi.fn(),
      postAuthorize: vi.fn(),
      handleProviderCallback: vi.fn()
    };
    const mockTokenInstance = { postToken: vi.fn() };
    const mockUserInfoInstance = { getUserInfo: vi.fn() };

    RegisterEndpoint.mockImplementation(() => mockRegisterInstance as any);
    AuthorizeEndpoint.mockImplementation(() => mockAuthorizeInstance as any);
    TokenEndpoint.mockImplementation(() => mockTokenInstance as any);
    UserInfoEndpoint.mockImplementation(() => mockUserInfoInstance as any);

    setupOAuth2Routes(mockRouter);

    // Test register route
    const registerRoute = mockRouter.routes.find(
      (r: any) => r.method === 'POST' && r.path === '/oauth2/register'
    );
    const registerHandler = registerRoute.handlers[0];
    registerHandler(mockRequest, mockResponse);
    expect(mockRegisterInstance.register).toHaveBeenCalledWith(mockRequest, mockResponse);

    // Test authorize GET route
    const authorizeGetRoute = mockRouter.routes.find(
      (r: any) => r.method === 'GET' && r.path === '/oauth2/authorize'
    );
    const authorizeGetHandler = authorizeGetRoute.handlers[0];
    authorizeGetHandler(mockRequest, mockResponse);
    expect(mockAuthorizeInstance.getAuthorize).toHaveBeenCalledWith(mockRequest, mockResponse);

    // Test authorize POST route
    const authorizePostRoute = mockRouter.routes.find(
      (r: any) => r.method === 'POST' && r.path === '/oauth2/authorize'
    );
    const authorizePostHandler = authorizePostRoute.handlers[0];
    authorizePostHandler(mockRequest, mockResponse);
    expect(mockAuthorizeInstance.postAuthorize).toHaveBeenCalledWith(mockRequest, mockResponse);

    // Test callback route
    const callbackRoute = mockRouter.routes.find(
      (r: any) => r.path === '/oauth2/callback/:provider'
    );
    const callbackHandler = callbackRoute.handlers[0];
    callbackHandler(mockRequest, mockResponse);
    expect(mockAuthorizeInstance.handleProviderCallback).toHaveBeenCalledWith(mockRequest, mockResponse);

    // Test token route
    const tokenRoute = mockRouter.routes.find(
      (r: any) => r.method === 'POST' && r.path === '/oauth2/token'
    );
    const tokenHandler = tokenRoute.handlers[0];
    tokenHandler(mockRequest, mockResponse);
    expect(mockTokenInstance.postToken).toHaveBeenCalledWith(mockRequest, mockResponse);

    // Test userinfo route (async handler)
    const userinfoRoute = mockRouter.routes.find(
      (r: any) => r.method === 'GET' && r.path === '/oauth2/userinfo'
    );
    const userinfoHandler = userinfoRoute.handlers[1]; // Second handler after auth middleware
    await userinfoHandler(mockRequest, mockResponse);
    expect(mockUserInfoInstance.getUserInfo).toHaveBeenCalledWith(mockRequest, mockResponse);
  });

  it('should return void', () => {
    const result = setupOAuth2Routes(mockRouter);
    expect(result).toBeUndefined();
  });

  it('should handle route execution without errors', () => {
    expect(() => {
      setupOAuth2Routes(mockRouter);
    }).not.toThrow();
  });
});