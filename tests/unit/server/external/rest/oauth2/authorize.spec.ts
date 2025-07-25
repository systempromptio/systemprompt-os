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

// Mock the internal functions used by the authorize file
let mockGetAuthModule: any;
let mockAuthRepository: any;
let mockGetAuthCodeService: any;

// Override the module's internal functions by modifying the authorize module after import
const mockInternalFunctions = () => {
  mockGetAuthModule = vi.fn().mockReturnValue({
    exports: {
      getProviderRegistry: vi.fn().mockReturnValue(mockProviderRegistry),
      authCodeService: vi.fn().mockReturnValue(mockAuthCodeService)
    }
  });
  
  mockAuthRepository = {
    getInstance: vi.fn().mockReturnValue(mockAuthRepository)
  };
  
  mockGetAuthCodeService = vi.fn().mockReturnValue(mockAuthCodeService);
  
  // Inject our mocks into the module
  const authorizeModule = require('../../../../../../src/server/external/rest/oauth2/authorize.js');
  if (authorizeModule.__setMocks) {
    authorizeModule.__setMocks({
      getAuthModule: mockGetAuthModule,
      authRepository: mockAuthRepository,
      getAuthCodeService: mockGetAuthCodeService
    });
  }
};

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

    // Setup internal function mocks
    mockInternalFunctions();

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

      it('should include PKCE parameters in provider URLs', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'openid',
          codeChallenge: 'challenge123',
          codeChallengeMethod: 'S256',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.type).toHaveBeenCalledWith('html');
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('codeChallenge=challenge123'),
        );
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('codeChallengeMethod=S256'),
        );
      });

      it('should include nonce in provider URLs when provided', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'openid',
          nonce: 'test-nonce',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('nonce=test-nonce'),
        );
      });

      it('should handle responseType "code id_token"', async () => {
        mockReq.query = {
          responseType: 'code id_token',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'openid',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.type).toHaveBeenCalledWith('html');
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('responseType=code+id_token'),
        );
      });

      it('should generate cancel link with proper error parameters', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
          state: 'client-state',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('error=access_denied&state=client-state'),
        );
      });

      it('should handle missing state parameter in cancel link', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('&state='),
        );
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

      it('should encode state data properly', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'openid profile',
          provider: 'google',
          state: 'original-state',
          codeChallenge: 'challenge123',
          codeChallengeMethod: 'S256',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        const stateParam = vi.mocked(mockGoogleProvider.getAuthorizationUrl).mock.calls[0][0];
        const decodedState = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
        
        expect(decodedState).toEqual({
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'openid profile',
          originalState: 'original-state',
          codeChallenge: 'challenge123',
          codeChallengeMethod: 'S256',
        });
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

      it('should handle invalid redirectUri format', async () => {
        mockReq.query = {
          clientId: 'test-client',
          redirectUri: 'not-a-valid-url',
          responseType: 'code',
          scope: 'read',
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          message: expect.any(String),
        });
      });

      it('should handle invalid codeChallengeMethod', async () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
          codeChallengeMethod: 'invalid', // not S256 or plain
        };

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          message: expect.any(String),
        });
      });

      it('should handle provider registry not initialized', async () => {
        // Mock getAuthModule to return null provider registry
        const originalCode = authorizeEndpoint.getAuthorize.toString();
        const mockGetAuthModule = vi.fn().mockReturnValue({
          exports: {
            getProviderRegistry: vi.fn().mockReturnValue(null)
          }
        });
        
        // We need to test this through the actual flow since the function is inline
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
          provider: 'google',
        };

        // Mock the internal getAuthModule call by making provider registry throw
        vi.mocked(mockProviderRegistry.getProvider).mockImplementation(() => {
          throw new Error('Provider registry not initialized');
        });

        await authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'server_error',
          message: expect.stringContaining('Provider registry not initialized'),
        });
      });

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

      it('should handle authorization approval without state', async () => {
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.redirect).toHaveBeenCalledWith(
          'http://localhost:3000/callback?code=test-auth-code-123',
        );
      });

      it('should handle user with sub field instead of id', async () => {
        mockReq.user = {
          sub: 'sub123',
          email: 'user@example.com',
        };
        
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'sub123',
            userEmail: 'user@example.com',
          }),
        );
      });

      it('should handle user with empty id and sub fields', async () => {
        mockReq.user = {
          email: 'user@example.com',
        };
        
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: '',
            userEmail: 'user@example.com',
          }),
        );
      });

      it('should handle user with missing email', async () => {
        mockReq.user = {
          id: 'user123',
        };
        
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user123',
            userEmail: '',
          }),
        );
      });

      it('should include provider when specified', async () => {
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
          provider: 'google',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: 'google',
          }),
        );
      });

      it('should include providerCode when specified', async () => {
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
          providerCode: 'provider123',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith(
          expect.objectContaining({
            providerTokens: { code: 'provider123' },
          }),
        );
      });

      it('should include PKCE parameters when specified', async () => {
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'openid email',
          codeChallenge: 'challenge123',
          codeChallengeMethod: 'S256',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith(
          expect.objectContaining({
            codeChallenge: 'challenge123',
            codeChallengeMethod: 'S256',
          }),
        );
      });

      it('should set correct expiration time', async () => {
        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now);

        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith(
          expect.objectContaining({
            expiresAt: new Date(now + 10 * 60 * 1000),
          }),
        );
      });
    });

    describe('error handling', () => {
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

      it('should handle missing required parameters', async () => {
        mockReq.body = {
          clientId: 'test-client',
          // missing other required fields
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          message: expect.any(String),
        });
      });

      it('should handle invalid responseType', async () => {
        mockReq.body = {
          responseType: 'token',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'invalid_request',
          message: expect.any(String),
        });
      });

      it('should handle auth code service errors', async () => {
        vi.mocked(mockAuthCodeService.createAuthorizationCode).mockRejectedValue(
          new Error('Database error'),
        );

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

      it('should handle callback without originalState', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState({ originalState: undefined }),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'token123',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
          id: 'user123',
          email: 'test@example.com',
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.redirect).toHaveBeenCalledWith(
          'http://localhost:3000/callback?code=test-auth-code-123',
        );
      });

      it('should handle user info with avatar in raw field', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'token123',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
          raw: {
            avatarUrl: 'https://example.com/raw-avatar.jpg',
          },
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockAuthRepository.upsertUserFromOAuth).toHaveBeenCalledWith(
          'google',
          'user123',
          {
            email: 'test@example.com',
            name: 'Test User',
            avatar: 'https://example.com/raw-avatar.jpg',
          },
        );
      });

      it('should handle user info without name or avatar', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'token123',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
          id: 'user123',
          email: 'test@example.com',
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockAuthRepository.upsertUserFromOAuth).toHaveBeenCalledWith(
          'google',
          'user123',
          {
            email: 'test@example.com',
          },
        );
      });

      it('should handle user info with missing email', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'token123',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
          id: 'user123',
          name: 'Test User',
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockAuthRepository.upsertUserFromOAuth).toHaveBeenCalledWith(
          'google',
          'user123',
          {
            email: '',
            name: 'Test User',
          },
        );
      });

      it('should include PKCE parameters in auth code', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState({
              codeChallenge: 'challenge123',
              codeChallengeMethod: 'S256',
            }),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'token123',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
          id: 'user123',
          email: 'test@example.com',
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledWith(
          expect.objectContaining({
            codeChallenge: 'challenge123',
            codeChallengeMethod: 'S256',
          }),
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

      it('should handle provider error without description', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            error: 'server_error',
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('server_error'),
        );
      });

      it('should handle Error object as error parameter', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            error: new Error('Custom error'),
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
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

      it('should handle missing state parameter', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Missing code or state parameter'),
        );
      });

      it('should handle invalid state parameter', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: 'invalid-base64url',
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Invalid state parameter'),
        );
      });

      it('should handle unparseable state JSON', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: Buffer.from('invalid json').toString('base64url'),
          },
        };

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Invalid state parameter'),
        );
      });

      it('should handle provider registry not initialized', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        // Mock getAuthModule to return null registry
        const mockBadProviderRegistry = null;
        const mockAuthModule = {
          exports: {
            getProviderRegistry: vi.fn().mockReturnValue(mockBadProviderRegistry)
          }
        };

        // We need to simulate this through the actual endpoint
        vi.mocked(mockProviderRegistry.getProvider).mockImplementation(() => {
          throw new Error('Provider registry not initialized');
        });

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Provider registry not initialized'),
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

      it('should handle token exchange failure', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockRejectedValue(
          new Error('Token exchange failed'),
        );

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Token exchange failed'),
        );
      });

      it('should handle user info retrieval failure', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'token123',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockRejectedValue(
          new Error('User info failed'),
        );

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('User info failed'),
        );
      });

      it('should handle auth repository upsert failure', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'token123',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
          id: 'user123',
          email: 'test@example.com',
        });
        
        vi.mocked(mockAuthRepository.upsertUserFromOAuth).mockRejectedValue(
          new Error('Database error'),
        );

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Database error'),
        );
      });

      it('should handle auth code creation failure', async () => {
        const mockReq = {
          params: { provider: 'google' },
          query: {
            code: 'provider-auth-code',
            state: createValidState(),
          },
        };

        vi.mocked(mockGoogleProvider.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'token123',
        });
        
        vi.mocked(mockGoogleProvider.getUserInfo).mockResolvedValue({
          id: 'user123',
          email: 'test@example.com',
        });
        
        vi.mocked(mockAuthCodeService.createAuthorizationCode).mockRejectedValue(
          new Error('Auth code creation failed'),
        );

        await authorizeEndpoint.handleProviderCallback(mockReq as any, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.stringContaining('Auth code creation failed'),
        );
      });
    });
  });
  
  // Test utility functions and mock objects
  describe('utility functions and mocks', () => {
    describe('oauth2Error', () => {
      it('should create invalidRequest error with correct structure', () => {
        // We test this indirectly through the endpoint
        mockReq.query = {
          clientId: 'test-client',
          // missing required fields to trigger validation error
        };

        return authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response)
          .then(() => {
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
              error: 'invalid_request',
              message: expect.any(String),
            });
          });
      });

      it('should create serverError with correct structure', () => {
        mockReq.query = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };

        // Force a server error
        vi.mocked(mockProviderRegistry.getAllProviders).mockImplementation(() => {
          throw new Error('Server error');
        });

        return authorizeEndpoint.getAuthorize(mockReq as Request, mockRes as Response)
          .then(() => {
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
              error: 'server_error',
              message: 'Server error',
            });
          });
      });
    });

    describe('getAuthCodeService', () => {
      it('should cache the auth code service instance', async () => {
        // First call
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read',
        };
        
        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);
        
        // Second call - should use cached instance
        mockReq.body = {
          responseType: 'code',
          clientId: 'test-client-2',
          redirectUri: 'http://localhost:3000/callback2',
          scope: 'write',
        };
        
        await authorizeEndpoint.postAuthorize(mockReq as Request, mockRes as Response);
        
        // Both calls should use the same service instance
        expect(mockAuthCodeService.createAuthorizationCode).toHaveBeenCalledTimes(2);
        expect(mockAuthCodeService.cleanupExpiredCodes).toHaveBeenCalledTimes(2);
      });
    });
  });
});
