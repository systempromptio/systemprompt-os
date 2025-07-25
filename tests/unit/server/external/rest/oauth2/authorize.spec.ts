/**
 * @fileoverview Unit tests for OAuth2 Authorize endpoint
 * @module tests/unit/server/external/rest/oauth2/authorize
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { AuthorizeEndpoint } from '../../../../../../src/server/external/rest/oauth2/authorize.js';
import type {
  IAuthCodeParams,
  IAuthCodeService,
  IAuthRepository,
  IAuthenticatedUser,
  IDatabaseUser,
  IIdentityProvider,
  IOAuth2Error,
  IOAuthUserData,
  IProviderRegistry,
  IStateData
} from '../../../../../../src/server/external/rest/oauth2/types/authorize.types.js';

// Mock external dependencies
vi.mock('../../../../../../src/modules/core/logger/index', () => ({
  LoggerService: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }))
  }
}));

vi.mock('../../../../../../src/modules/core/logger/types/index', () => ({
  LogSource: {
    AUTH: 'auth'
  }
}));

// Create shared mock objects that will be used throughout tests
const mockAuthCodeService: IAuthCodeService = {
  createAuthorizationCode: vi.fn().mockResolvedValue('test-auth-code-123'),
  cleanupExpiredCodes: vi.fn().mockResolvedValue(undefined)
};

const mockAuthRepository: IAuthRepository = {
  upsertUserFromOAuth: vi.fn().mockResolvedValue({
    id: 'user123',
    email: 'user@example.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  } as IDatabaseUser)
};

const mockGoogleProvider: IIdentityProvider = {
  name: 'google',
  getAuthorizationUrl: vi.fn((state: string) => `https://accounts.google.com/oauth/authorize?state=${state}`),
  exchangeCodeForTokens: vi.fn().mockResolvedValue({ accessToken: 'mock_token' }),
  getUserInfo: vi.fn().mockResolvedValue({ id: 'mock_id', email: 'mock@email.com' })
};

const mockGithubProvider: IIdentityProvider = {
  name: 'github', 
  getAuthorizationUrl: vi.fn((state: string) => `https://github.com/login/oauth/authorize?state=${state}`),
  exchangeCodeForTokens: vi.fn().mockResolvedValue({ accessToken: 'github_token' }),
  getUserInfo: vi.fn().mockResolvedValue({ id: 'github_id', email: 'github@example.com' })
};

const mockProviderRegistry: IProviderRegistry = {
  getProvider: vi.fn((name: string) => {
    if (name === 'google') return mockGoogleProvider;
    if (name === 'github') return mockGithubProvider;
    return undefined;
  }),
  getAllProviders: vi.fn(() => [mockGoogleProvider, mockGithubProvider])
};

describe('OAuth2 Authorize Endpoint', () => {
  let authorizeEndpoint: AuthorizeEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock implementations to defaults
    vi.mocked(mockProviderRegistry.getProvider).mockImplementation((name: string) => {
      if (name === 'google') return mockGoogleProvider;
      if (name === 'github') return mockGithubProvider;
      return undefined;
    });
    
    vi.mocked(mockProviderRegistry.getAllProviders).mockReturnValue([mockGoogleProvider, mockGithubProvider]);
    vi.mocked(mockAuthCodeService.createAuthorizationCode).mockResolvedValue('test-auth-code-123');
    vi.mocked(mockAuthRepository.upsertUserFromOAuth).mockResolvedValue({
      id: 'user123',
      email: 'user@example.com',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    });

    authorizeEndpoint = new AuthorizeEndpoint();

    mockReq = {
      query: {},
      body: {},
      params: {},
      user: {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com',
      } as IAuthenticatedUser,
    };

    mockRes = {
      redirect: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getAuthorize', () => {
    describe('without provider parameter', () => {
      it('should display authorization consent form with valid parameters', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read write',
          state: 'client-state',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.type).toHaveBeenCalledWith('html');
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('<h1>Sign in to continue</h1>'),
        );
        expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('test-client'));
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('<li class="scope-item">read</li>'),
        );
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('<li class="scope-item">write</li>'),
        );
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('provider=google'),
        );
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('provider=github'),
        );
      });

      it('should handle missing required parameters', async () => {
        mockReq.query = {
          clientId: 'test-client',
          // missing redirectUri and responseType
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          message: expect.any(String),
        });
      });

      it('should handle invalid responseType', async () => {
        mockReq.query = {
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          responseType: 'token', // not supported
          scope: 'read',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          message: expect.any(String),
        });
      });
    });

    describe('with provider parameter', () => {
      it('should redirect to Google provider with state', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'openid',
          provider: 'google',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockGoogleProvider.getAuthorizationUrl).toHaveBeenCalledWith(
          expect.any(String),
        );
        expect(mockRes.redirect).toHaveBeenCalledWith(
          expect.stringContaining('https://accounts.google.com/oauth/authorize'),
        );
      });

      it('should handle case insensitive provider names', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'openid',
          provider: 'GOOGLE',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockProviderRegistry.getProvider).toHaveBeenCalledWith('google');
        expect(mockRes.redirect).toHaveBeenCalled();
      });

      it('should handle unknown provider', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
          provider: 'unknown',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'server_error',
          message: 'Unknown provider: unknown',
        });
      });
    });

    describe('error handling', () => {
      it('should handle server errors during HTML generation', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        // Mock getAllProviders to throw an error
        vi.mocked(mockProviderRegistry.getAllProviders).mockImplementation(() => {
          throw new Error('Database connection failed');
        });

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'server_error',
          message: 'Database connection failed',
        });
      });

      it('should handle non-Error exceptions', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        // Mock to throw a non-Error object
        vi.mocked(mockProviderRegistry.getAllProviders).mockImplementation(() => {
          throw 'String error';
        });

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'server_error',
          message: 'String error',
        });
      });
    });
  });

  describe('postAuthorize', () => {
    describe('authorization denial', () => {
      it('should handle denial with state', async () => {
        mockReq.body = {
          action: 'deny',
          redirectUri: 'http://localhost:3000/callback',
          state: 'client-state',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.redirect).toHaveBeenCalledWith(
          'http://localhost:3000/callback?error=access_denied&errorDescription=User+denied+the+authorization+request&state=client-state',
        );
      });

      it('should handle denial without state', async () => {
        mockReq.body = {
          action: 'deny',
          redirectUri: 'http://localhost:3000/callback',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.redirect).toHaveBeenCalledWith(
          'http://localhost:3000/callback?error=access_denied&errorDescription=User+denied+the+authorization+request',
        );
      });

      it('should handle denial with missing redirectUri', async () => {
        mockReq.body = {
          action: 'deny',
          state: 'client-state',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'server_error',
          message: 'Internal server error',
        });
      });
    });

    describe('authorization approval', () => {
      it('should handle authorization approval with valid user', async () => {
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read write',
          state: 'client-state',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith({
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read write',
          userId: 'user123',
          userEmail: 'user@example.com',
          expiresAt: expect.any(Date),
        });
        
        expect(mockAuthCodeService.cleanupExpiredCodes).toHaveBeenCalled();
        
        expect(mockRes.redirect).toHaveBeenCalledWith(
          'http://localhost:3000/callback?code=test-auth-code-123&state=client-state',
        );
      });

      it('should handle missing user authentication', async () => {
        mockReq.user = undefined;
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'server_error',
          message: 'Internal server error',
        });
      });
    });
  });

  describe('handleProviderCallback', () => {
    const createValidState = (stateData: Partial<IStateData> = {}) => {
      const fullStateData: IStateData = {
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'openid profile',
        originalState: 'client-state',
        ...stateData,
      };
      return Buffer.from(JSON.stringify(fullStateData)).toString('base64url');
    };

    describe('successful callback handling', () => {
      it('should handle provider callback with authorization code', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'provider-access-token',
          refreshToken: 'provider-refresh-token',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
          id: 'google-user-123',
          email: 'user@gmail.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg',
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockGoogleProvider.exchangeCodeForTokens).toHaveBeenCalledWith('provider-auth-code');
        expect(mockGoogleProvider.getUserInfo).toHaveBeenCalledWith('provider-access-token');
        
        expect(mockAuthRepository.upsertUserFromOAuth).toHaveBeenCalledWith(
          'google',
          'google-user-123',
          {
            email: 'user@gmail.com',
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg',
          },
        );
        
        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith(
          expect.objectContaining({
            clientId: 'test-client',
            redirectUri: 'http://localhost:3000/callback',
            scope: 'openid profile',
            userId: 'user123',
            userEmail: 'user@example.com',
            provider: 'google',
          }),
        );
        
        expect(mockAuthCodeService.cleanupExpiredCodes).toHaveBeenCalled();
        
        expect(mockRes.redirect).toHaveBeenCalledWith(
          'http://localhost:3000/callback?code=test-auth-code-123&state=client-state',
        );
      });
    });

    describe('error handling', () => {
      it('should handle missing provider parameter', async () => {
        const mockReq = {
          params: {},
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Provider parameter is required'),
        );
      });

      it('should handle provider callback error', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            error: 'access_denied',
            error_description: 'User denied access',
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Authentication Failed'),
        );
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('access_denied'),
        );
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('User denied access'),
        );
      });

      it('should handle missing code parameter', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            state: createValidState(),
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Missing code or state parameter'),
        );
      });

      it('should handle unknown provider', async () => {
        const mockReq = {
          params: { provider: 'unknown' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockProviderRegistry.getProvider).mockReturnValue(undefined);

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Unknown provider: unknown'),
        );
      });
    });
  });
});