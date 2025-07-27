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

// Mock auth module dependencies
vi.mock('../../../../../../src/modules/core/auth/index', () => ({
  getAuthModule: vi.fn()
}));

vi.mock('../../../../../../src/modules/core/auth/database/repository', () => ({
  AuthRepository: {
    getInstance: vi.fn()
  }
}));

// Import after mocking
import { getAuthModule } from '../../../../../../src/modules/core/auth/index.js';
import { AuthRepository } from '../../../../../../src/modules/core/auth/database/repository.js';

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
  upsertIUserFromOAuth: vi.fn().mockResolvedValue({
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
  let mockAuthModule: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup auth module mock
    mockAuthModule = {
      exports: {
        getProviderRegistry: vi.fn(() => mockProviderRegistry),
        authCodeService: vi.fn(() => mockAuthCodeService)
      }
    };
    
    vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);
    vi.mocked(AuthRepository.getInstance).mockReturnValue(mockAuthRepository);
    
    // Reset mock implementations to defaults
    vi.mocked(mockProviderRegistry.getProvider).mockImplementation((name: string) => {
      if (name === 'google') return mockGoogleProvider;
      if (name === 'github') return mockGithubProvider;
      return undefined;
    });
    
    vi.mocked(mockProviderRegistry.getAllProviders).mockReturnValue([mockGoogleProvider, mockGithubProvider]);
    vi.mocked(mockAuthCodeService.createAuthorizationCode).mockResolvedValue('test-auth-code-123');
    vi.mocked(mockAuthRepository.upsertIUserFromOAuth).mockResolvedValue({
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
          response_type: 'code',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
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
          client_id: 'test-client',
          // missing redirect_uri and response_type
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          error_description: expect.any(String),
        });
      });

      it('should handle invalid responseType', async () => {
        mockReq.query = {
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          response_type: 'token', // not supported
          scope: 'read',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'unsupported_response_type',
          error_description: expect.any(String),
        });
      });
    });

    describe('with provider parameter', () => {
      it('should redirect to Google provider with state', async () => {
        mockReq.query = {
          response_type: 'code',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
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
          response_type: 'code',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          scope: 'openid',
          provider: 'GOOGLE',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockProviderRegistry.getProvider).toHaveBeenCalledWith('google');
        expect(mockRes.redirect).toHaveBeenCalled();
      });

      it('should handle unknown provider', async () => {
        mockReq.query = {
          response_type: 'code',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          scope: 'read',
          provider: 'unknown',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'server_error',
          error_description: 'Unknown provider: unknown',
        });
      });
    });

    describe('error handling', () => {
      it('should handle server errors during HTML generation', async () => {
        mockReq.query = {
          response_type: 'code',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
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
          error_description: 'Database connection failed',
        });
      });

      it('should handle non-Error exceptions', async () => {
        mockReq.query = {
          response_type: 'code',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
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
          error_description: 'String error',
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
          error_description: 'Internal server error',
        });
      });
    });

    describe('authorization approval', () => {
      it('should handle authorization approval with valid user', async () => {
        mockReq.body = {
          response_type: 'code',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
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
          response_type: 'code',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'server_error',
          error_description: 'Internal server error',
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
        
        expect(mockAuthRepository.upsertIUserFromOAuth).toHaveBeenCalledWith(
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

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          error_description: 'Provider parameter is required',
        });
      });

      it('should handle provider callback error', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            error: 'access_denied',
            errorDescription: 'User denied access',
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

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          error_description: 'Missing code parameter',
        });
      });

      it('should handle missing state parameter', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          error_description: 'Missing state parameter',
        });
      });

      it('should handle invalid state decoding', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: 'invalid-base64url-state',
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          error_description: 'Invalid state parameter',
        });
      });

      it('should handle malformed JSON in state', async () => {
        const invalidState = Buffer.from('invalid-json{').toString('base64url');
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: invalidState,
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          error_description: 'Invalid state parameter',
        });
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

    // Additional comprehensive error and edge case tests
    describe('additional edge cases', () => {
      it('should handle provider callback with all optional state fields', async () => {
        const stateData = {
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'openid profile',
          originalState: 'client-state',
          codeChallenge: 'test-challenge',
          codeChallengeMethod: 'S256',
        };
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: Buffer.from(JSON.stringify(stateData)).toString('base64url'),
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
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith(
          expect.objectContaining({
            codeChallenge: 'test-challenge',
            codeChallengeMethod: 'S256',
          }),
        );
      });

      it('should handle provider callback without optional user fields', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'provider-access-token',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
          id: 'google-user-123',
          email: 'user@gmail.com',
          // No name or picture
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockAuthRepository.upsertIUserFromOAuth).toHaveBeenCalledWith(
          'google',
          'google-user-123',
          {
            email: 'user@gmail.com',
            // Should not include name or avatar
          },
        );
      });

      it('should handle provider callback with avatar from raw data', async () => {
        const mockReq = {
          params: { provider: 'github' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGithubProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'github-access-token',
        });
        
        vi.mocked(mockGithubProvider.getUserInfo).mockResolvedValue({
          id: 'github-user-123',
          email: 'user@github.com',
          raw: {
            avatarUrl: 'https://github.com/avatar.jpg',
          },
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockAuthRepository.upsertIUserFromOAuth).toHaveBeenCalledWith(
          'github',
          'github-user-123',
          {
            email: 'user@github.com',
            avatar: 'https://github.com/avatar.jpg',
          },
        );
      });

      it('should handle provider callback without original state', async () => {
        const stateData = {
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'openid profile',
          // No originalState
        };
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: Buffer.from(JSON.stringify(stateData)).toString('base64url'),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'provider-access-token',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
          id: 'google-user-123',
          email: 'user@gmail.com',
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.redirect).toHaveBeenCalledWith(
          'http://localhost:3000/callback?code=test-auth-code-123'
        );
      });

      it('should handle provider registry null in callback', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        // Mock getProviderRegistry to return null
        mockAuthModule.exports.getProviderRegistry = vi.fn(() => null);

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Provider registry not initialized'),
        );
      });

      it('should handle error during token exchange', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockRejectedValue(
          new Error('Token exchange failed')
        );

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Token exchange failed'),
        );
      });

      it('should handle error during user info retrieval', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'provider-access-token',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockRejectedValue(
          new Error('User info failed')
        );

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('User info failed'),
        );
      });

      it('should handle error with non-Error exception in callback', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockImplementation(() => {
          throw 'String error';
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('String error'),
        );
      });

      it('should handle provider callback error without error_description', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            error: 'access_denied',
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
      });
    });
  });

  // Test utility functions directly by testing the class methods that use them
  describe('utility functions coverage', () => {
    it('should handle missing client_id specifically', async () => {
      mockReq.query = {
        response_type: 'code',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: 'client_id is required',
      });
    });

    it('should handle missing response_type specifically', async () => {
      mockReq.query = {
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: 'response_type is required',
      });
    });

    it('should handle invalid redirect_uri', async () => {
      mockReq.query = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'not-a-valid-url',
        scope: 'read',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: expect.any(String),
      });
    });

    it('should handle supported response_type code id_token', async () => {
      mockReq.query = {
        response_type: 'code id_token',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'openid profile',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.type).toHaveBeenCalledWith('html');
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Sign in to continue'));
    });

    it('should handle optional parameters in consent page', async () => {
      mockReq.query = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read write admin',
        state: 'optional-state',
        nonce: 'optional-nonce',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.type).toHaveBeenCalledWith('html');
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('admin'));
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('state=optional-state'));
    });

    it('should include all optional parameters in provider state', async () => {
      mockReq.query = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'openid profile',
        provider: 'google',
        state: 'original-state',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      expect(mockGoogleProvider.getAuthorizationUrl).toHaveBeenCalledWith(
        expect.any(String)
      );
      expect(mockRes.redirect).toHaveBeenCalled();

      // Verify state includes all required data
      const stateArg = vi.mocked(mockGoogleProvider.getAuthorizationUrl).mock.calls[0][0];
      const decodedState = JSON.parse(Buffer.from(stateArg, 'base64url').toString());
      expect(decodedState).toEqual({
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'openid profile',
        originalState: 'original-state',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
      });
    });

    it('should handle provider registry null error', async () => {
      mockReq.query = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
        provider: 'google',
      };

      // Mock getProviderRegistry to return null
      mockAuthModule.exports.getProviderRegistry = vi.fn(() => null);

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'server_error',
        error_description: 'Provider registry not initialized',
      });
    });

    it('should handle provider registry null in consent page display', async () => {
      mockReq.query = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      // Mock getProviderRegistry to return null for consent page
      mockAuthModule.exports.getProviderRegistry = vi.fn(() => null);

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'server_error',
        error_description: 'Provider registry not initialized',
      });
    });

    it('should handle authorization approval with user without sub field', async () => {
      mockReq.user = {
        id: 'user456',
        email: 'user2@example.com',
      } as IAuthenticatedUser;
      mockReq.body = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

      expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith({
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        userId: 'user456',
        userEmail: 'user2@example.com',
        expiresAt: expect.any(Date),
      });
    });

    it('should handle authorization approval with optional parameters', async () => {
      mockReq.body = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
        provider: 'google',
        provider_code: 'auth-code-123',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      };

      await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

      expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith({
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        userId: 'user123',
        userEmail: 'user@example.com',
        provider: 'google',
        providerTokens: { code: 'auth-code-123' },
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        expiresAt: expect.any(Date),
      });
    });

    it('should handle approval without state parameter', async () => {
      mockReq.body = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/callback?code=test-auth-code-123'
      );
    });

    it('should handle invalid request body type', async () => {
      mockReq.body = 'invalid-string-body';

      await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    });

    it('should handle null request body', async () => {
      mockReq.body = null;

      await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    });

    it('should handle validation errors for missing client_id in POST', async () => {
      mockReq.body = {
        response_type: 'code',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: 'client_id is required',
      });
    });

    it('should handle validation errors for missing response_type in POST', async () => {
      mockReq.body = {
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: 'response_type is required',
      });
    });

    it('should handle validation errors for invalid response_type in POST', async () => {
      mockReq.body = {
        response_type: 'invalid_type',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'unsupported_response_type',
        error_description: 'Unsupported response_type',
      });
    });

    it('should generate consent page with multiple scopes', async () => {
      mockReq.query = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read write admin profile',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('<li class="scope-item">read</li>')
      );
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('<li class="scope-item">write</li>')
      );
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('<li class="scope-item">admin</li>')
      );
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('<li class="scope-item">profile</li>')
      );
    });

    it('should generate provider buttons with correct icons', async () => {
      mockReq.query = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      // Google should have blue circle icon
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('🔵 Sign in with Google')
      );
      // GitHub should have black circle icon
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('⚫ Sign in with Github')
      );
    });

    it('should include cancel URL with state when provided', async () => {
      mockReq.query = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
        state: 'test-state',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('error=access_denied&state=test-state')
      );
    });

    it('should include cancel URL without state when not provided', async () => {
      mockReq.query = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      const sendCall = vi.mocked(mockRes.send).mock.calls[0][0];
      expect(sendCall).toContain('error=access_denied');
      expect(sendCall).not.toContain('&state=');
    });

    it('should include all provider parameters in provider buttons', async () => {
      mockReq.query = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read write',
        state: 'test-state',
        nonce: 'test-nonce',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      };

      await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

      const sendCall = vi.mocked(mockRes.send).mock.calls[0][0];
      expect(sendCall).toContain('responseType=code');
      expect(sendCall).toContain('clientId=test-client');
      expect(sendCall).toContain('redirectUri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(sendCall).toContain('scope=read+write');
      expect(sendCall).toContain('state=test-state');
      expect(sendCall).toContain('nonce=test-nonce');
      expect(sendCall).toContain('codeChallenge=test-challenge');
      expect(sendCall).toContain('codeChallengeMethod=S256');
      expect(sendCall).toContain('provider=google');
      expect(sendCall).toContain('provider=github');
    });

    it('should handle user with minimal authentication data', async () => {
      mockReq.user = {
        // Only id, no sub or email
        id: 'user789',
      } as IAuthenticatedUser;
      mockReq.body = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

      expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith({
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        userId: 'user789',
        userEmail: '',
        expiresAt: expect.any(Date),
      });
    });

    it('should handle user with sub but no id', async () => {
      mockReq.user = {
        sub: 'sub123',
        email: 'sub@example.com',
      } as IAuthenticatedUser;
      mockReq.body = {
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
      };

      await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

      expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith({
        clientId: 'test-client',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'read',
        userId: 'sub123',
        userEmail: 'sub@example.com',
        expiresAt: expect.any(Date),
      });
    });

    it('should handle user info with picture field', async () => {
      const mockReq = {
        params: { provider: 'google' },
        query: {
          code: 'provider-auth-code',
          state: createValidState(),
        },
      };

      vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
        accessToken: 'provider-access-token',
      });
      
      vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
        id: 'google-user-123',
        email: 'user@gmail.com',
        picture: 'https://example.com/picture.jpg',
      });

      await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

      expect(mockAuthRepository.upsertIUserFromOAuth).toHaveBeenCalledWith(
        'google',
        'google-user-123',
        {
          email: 'user@gmail.com',
          avatar: 'https://example.com/picture.jpg',
        },
      );
    });

    it('should handle user info with invalid raw data structure', async () => {
      const mockReq = {
        params: { provider: 'github' },
        query: {
          code: 'provider-auth-code',
          state: createValidState(),
        },
      };

      vi.mocked(mockGithubProvider.exchangeCodeForTokens).mockResolvedValue({
        accessToken: 'github-access-token',
      });
      
      vi.mocked(mockGithubProvider.getUserInfo).mockResolvedValue({
        id: 'github-user-123',
        email: 'user@github.com',
        raw: {
          // avatarUrl is not a string
          avatarUrl: 123,
        },
      });

      await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

      expect(mockAuthRepository.upsertIUserFromOAuth).toHaveBeenCalledWith(
        'github',
        'github-user-123',
        {
          email: 'user@github.com',
          // Should not include avatar since avatarUrl is not a string
        },
      );
    });

    it('should handle user info with null raw data', async () => {
      const mockReq = {
        params: { provider: 'github' },
        query: {
          code: 'provider-auth-code',
          state: createValidState(),
        },
      };

      vi.mocked(mockGithubProvider.exchangeCodeForTokens).mockResolvedValue({
        accessToken: 'github-access-token',
      });
      
      vi.mocked(mockGithubProvider.getUserInfo).mockResolvedValue({
        id: 'github-user-123',
        email: 'user@github.com',
        raw: null,
      });

      await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

      expect(mockAuthRepository.upsertIUserFromOAuth).toHaveBeenCalledWith(
        'github',
        'github-user-123',
        {
          email: 'user@github.com',
        },
      );
    });

    it('should handle user info with undefined raw data', async () => {
      const mockReq = {
        params: { provider: 'github' },
        query: {
          code: 'provider-auth-code',
          state: createValidState(),
        },
      };

      vi.mocked(mockGithubProvider.exchangeCodeForTokens).mockResolvedValue({
        accessToken: 'github-access-token',
      });
      
      vi.mocked(mockGithubProvider.getUserInfo).mockResolvedValue({
        id: 'github-user-123',
        email: 'user@github.com',
        raw: undefined,
      });

      await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

      expect(mockAuthRepository.upsertIUserFromOAuth).toHaveBeenCalledWith(
        'github',
        'github-user-123',
        {
          email: 'user@github.com',
        },
      );
    });

    it('should handle user info with empty email', async () => {
      const mockReq = {
        params: { provider: 'google' },
        query: {
          code: 'provider-auth-code',
          state: createValidState(),
        },
      };

      vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
        accessToken: 'provider-access-token',
      });
      
      vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
        id: 'google-user-123',
        // No email field
      });

      await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

      expect(mockAuthRepository.upsertIUserFromOAuth).toHaveBeenCalledWith(
        'google',
        'google-user-123',
        {
          email: '',
        },
      );
    });
  });
});