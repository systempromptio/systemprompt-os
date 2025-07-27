/**
 * @fileoverview Comprehensive unit tests for OAuth2 Token endpoint - 100% Coverage
 * @module tests/unit/server/external/rest/oauth2/token
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';

// Mock CONFIG
vi.mock('../../../../../../src/server/config', () => ({
  CONFIG: {
    JWTISSUER: 'test-issuer',
    JWTAUDIENCE: 'test-audience'
  }
}));

// Mock OAuth2Error - Create mock functions directly
const mockOAuth2Error = {
  invalidRequest: vi.fn((message) => ({ 
    code: 400, 
    toJSON: () => ({ error: 'invalid_request', error_description: message }) 
  })),
  invalidGrant: vi.fn((message) => ({ 
    code: 400, 
    toJSON: () => ({ error: 'invalid_grant', error_description: message }) 
  })),
  unsupportedGrantType: vi.fn((message) => ({ 
    code: 400, 
    toJSON: () => ({ error: 'unsupported_grant_type', error_description: message }) 
  })),
  serverError: vi.fn((message) => ({ 
    code: 500, 
    toJSON: () => ({ error: 'server_error', error_description: message }) 
  }))
};

vi.mock('../../../../../../src/server/external/rest/oauth2/errors.js', () => ({
  OAuth2Error: mockOAuth2Error
}));

// Mock JWT functions
const mockJwtSign = vi.fn((payload) => {
  // Return a base64url encoded token for tests
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return Promise.resolve(tokenData);
});

const mockJwtVerify = vi.fn((token) => {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    return Promise.resolve({ payload });
  } catch {
    throw new Error('Invalid token');
  }
});

vi.mock('../../../../../../src/server/external/auth/jwt.js', () => ({
  jwtSign: mockJwtSign,
  jwtVerify: mockJwtVerify
}));

// Mock auth code service
const mockAuthCodeService = {
  createAuthorizationCode: vi.fn(() => 'mock-auth-code'),
  cleanupExpiredCodes: vi.fn(),
  getAuthorizationCode: vi.fn(),
  deleteAuthorizationCode: vi.fn()
};

// Mock auth module
const mockProvider = {
  exchangeCodeForTokens: vi.fn(() => Promise.resolve({
    access_token: 'provider-access-token',
    refresh_token: 'provider-refresh-token',
    expires_in: 3600
  }))
};

const mockAuthModule = {
  exports: {
    authCodeService: vi.fn(() => mockAuthCodeService),
    getProvider: vi.fn((providerName) => {
      if (providerName === 'github' || providerName === 'google') {
        return mockProvider;
      }
      return null;
    })
  }
};

vi.mock('../../../../../../src/modules/core/auth/singleton.js', () => ({
  getAuthModule: vi.fn(() => mockAuthModule)
}));

// Create mock auth repository instance
const mockAuthRepository = {
  getInstance: vi.fn(),
  validateClient: vi.fn(() => true),
  getAuthorizationCode: vi.fn((code) => {
    if (code === 'invalid-code') return null;
    return {
      clientId: 'test-client',
      redirectUri: 'http://localhost:3000/callback',
      scope: 'read write',
      userId: 'user123',
      userEmail: 'user@example.com',
      codeChallenge: null,
      codeChallengeMethod: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    };
  }),
  deleteAuthorizationCode: vi.fn(),
  getIUserById: vi.fn((userId) => ({
    id: userId,
    email: 'user@example.com',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.png'
  })),
  getIUserIRoles: vi.fn(() => [{ name: 'user' }, { name: 'admin' }])
};

// Set up the getInstance mock to return the repository
mockAuthRepository.getInstance.mockReturnValue(mockAuthRepository);

// Mock auth repository
vi.mock('../../../../../../src/modules/core/auth/database/repository.js', () => ({
  AuthRepository: mockAuthRepository
}));

// Mock logger
const mockLogger = {
  getInstance: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
};

// Configure getInstance to return the logger itself
mockLogger.getInstance.mockReturnValue(mockLogger);

vi.mock('../../../../../../src/modules/core/logger/index.js', () => ({
  LoggerService: mockLogger
}));

vi.mock('../../../../../../src/modules/core/logger/types/index.js', () => ({
  LogSource: {
    AUTH: 'AUTH'
  }
}));

// Import the class under test after mocks are set up
const { TokenEndpoint } = await import('../../../../../../src/server/external/rest/oauth2/token.js');

describe('OAuth2 Token Endpoint - 100% Coverage', () => {
  let tokenEndpoint: TokenEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenEndpoint = new TokenEndpoint();
    
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create authorization code
  function createAuthCode(params: any = {}) {
    const code = 'test-auth-code-' + Math.random().toString(36).substring(7);
    
    // Update the mock to return the proper auth code data when this code is used
    mockAuthCodeService.getAuthorizationCode.mockImplementation((requestedCode) => {
      if (requestedCode === code) {
        return Promise.resolve({
          clientId: params.client_id || 'test-client',
          redirectUri: params.redirect_uri || 'http://localhost:3000/callback',
          scope: params.scope || 'read write',
          userId: params.userId || 'user123',
          userEmail: params.userEmail || 'user@example.com',
          codeChallenge: params.code_challenge || null,
          codeChallengeMethod: params.code_challenge_method || null,
          expiresAt: params.expiresAt || new Date(Date.now() + 10 * 60 * 1000),
          provider: params.provider || null,
          providerTokens: params.providerTokens || null
        });
      }
      if (requestedCode === 'invalid-code') return Promise.resolve(null);
      if (requestedCode === 'expired-code') {
        return Promise.resolve({
          clientId: 'test-client',
          redirectUri: 'http://localhost:3000/callback',
          scope: 'read write',
          userId: 'user123',
          userEmail: 'user@example.com',
          codeChallenge: null,
          codeChallengeMethod: null,
          expiresAt: new Date(Date.now() - 1000) // Expired
        });
      }
      return Promise.resolve(null);
    });
    
    return code;
  }

  describe('postToken method', () => {
    it('should handle valid authorization_code request', async () => {
      const code = createAuthCode();
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: expect.any(String),
        scope: 'read write'
      });
    });

    it('should handle valid refresh_token request', async () => {
      // First create a token to get a refresh token
      const code = createAuthCode();
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);
      const tokens = (mockRes.json as any).mock.calls[0][0];
      
      // Reset mocks
      vi.clearAllMocks();
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      };

      // Now use refresh token
      mockReq = {
        body: {
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: 'test-client'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: expect.any(String),
        scope: 'read write'
      });
    });

    it('should handle unsupported grant type', async () => {
      mockReq = {
        body: {
          grant_type: 'unsupported_grant'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.unsupportedGrantType).toHaveBeenCalledWith('Unsupported grant_type');
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle missing grant_type', async () => {
      mockReq = {
        body: {
          // No grant_type
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidRequest).toHaveBeenCalledWith('grant_type is required');
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle Zod validation errors with invalid enum', async () => {
      mockReq = {
        body: {
          grant_type: 'invalid_grant_type'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.unsupportedGrantType).toHaveBeenCalledWith('Unsupported grant_type');
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle other Zod validation errors', async () => {
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          redirect_uri: 'not-a-valid-url'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidRequest).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle generic errors', async () => {
      // Mock an error in the auth code service
      mockAuthCodeService.getAuthorizationCode.mockRejectedValue(new Error('Database error'));
      
      const code = createAuthCode();
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.serverError).toHaveBeenCalledWith('Internal server error');
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('handleAuthorizationCodeGrant', () => {
    it('should reject missing code parameter', async () => {
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidRequest).toHaveBeenCalledWith('Missing required parameters');
    });

    it('should reject missing redirect_uri parameter', async () => {
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code: 'test-code'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidRequest).toHaveBeenCalledWith('Missing required parameters');
    });

    it('should reject invalid authorization code', async () => {
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code: 'invalid-code',
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidGrant).toHaveBeenCalledWith('Invalid authorization code');
    });

    it('should reject expired authorization code', async () => {
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code: 'expired-code',
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidGrant).toHaveBeenCalledWith('Authorization code expired');
      expect(mockAuthCodeService.deleteAuthorizationCode).toHaveBeenCalledWith('expired-code');
    });

    it('should reject invalid client_id', async () => {
      const code = createAuthCode({ client_id: 'correct-client' });
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          client_id: 'wrong-client',
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidGrant).toHaveBeenCalledWith('Invalid client');
    });

    it('should reject invalid redirect_uri', async () => {
      const code = createAuthCode({ redirect_uri: 'http://localhost:3000/callback' });
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/wrong-callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidGrant).toHaveBeenCalledWith('Invalid redirect URI');
    });

    it('should require code_verifier when PKCE is used', async () => {
      const codeChallenge = createHash('sha256').update('test-verifier').digest('base64url');
      const code = createAuthCode({ code_challenge: codeChallenge });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidRequest).toHaveBeenCalledWith('Code verifier required');
    });

    it('should reject invalid code_verifier', async () => {
      const codeChallenge = createHash('sha256').update('correct-verifier').digest('base64url');
      const code = createAuthCode({ code_challenge: codeChallenge });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback',
          code_verifier: 'wrong-verifier'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidGrant).toHaveBeenCalledWith('Invalid code verifier');
    });

    it('should handle successful PKCE verification', async () => {
      const verifier = 'correct-verifier';
      const codeChallenge = createHash('sha256').update(verifier).digest('base64url');
      const code = createAuthCode({ code_challenge: codeChallenge });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback',
          code_verifier: verifier
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String),
        token_type: 'Bearer'
      }));
    });

    it('should handle provider token exchange', async () => {
      const code = createAuthCode({
        provider: 'github',
        providerTokens: { code: 'provider-auth-code' }
      });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockProvider.exchangeCodeForTokens).toHaveBeenCalledWith('provider-auth-code');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String)
      }));
    });

    it('should handle provider token exchange failure', async () => {
      mockProvider.exchangeCodeForTokens.mockRejectedValue(new Error('Provider error'));
      
      const code = createAuthCode({
        provider: 'github',
        providerTokens: { code: 'provider-auth-code' }
      });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'AUTH',
        'Provider token exchange failed',
        expect.any(Object)
      );
    });

    it('should handle unknown provider', async () => {
      mockAuthModule.exports.getProvider.mockReturnValue(null);
      
      const code = createAuthCode({
        provider: 'unknown-provider',
        providerTokens: { code: 'provider-auth-code' }
      });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String)
      }));
    });

    it('should handle empty provider code', async () => {
      const code = createAuthCode({
        provider: 'github',
        providerTokens: { code: '' }
      });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockProvider.exchangeCodeForTokens).not.toHaveBeenCalled();
    });

    it('should allow optional client_id validation', async () => {
      const code = createAuthCode();
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
          // No client_id provided
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String)
      }));
    });

    it('should handle provider tokens as null', async () => {
      const code = createAuthCode({
        provider: 'github',
        providerTokens: null
      });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockProvider.exchangeCodeForTokens).not.toHaveBeenCalled();
    });

    it('should handle provider tokens as non-object', async () => {
      const code = createAuthCode({
        provider: 'github',
        providerTokens: 'invalid-tokens'
      });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockProvider.exchangeCodeForTokens).not.toHaveBeenCalled();
    });

    it('should handle non-string provider', async () => {
      const code = createAuthCode({
        provider: 123, // Non-string provider
        providerTokens: { code: 'provider-auth-code' }
      });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockProvider.exchangeCodeForTokens).not.toHaveBeenCalled();
    });

    it('should handle provider token exchange with non-string code', async () => {
      const code = createAuthCode({
        provider: 'github',
        providerTokens: { code: 123 } // Non-string code
      });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockProvider.exchangeCodeForTokens).not.toHaveBeenCalled();
    });

    it('should handle provider without exchangeCodeForTokens method', async () => {
      const providerWithoutMethod = { someOtherMethod: vi.fn() };
      mockAuthModule.exports.getProvider.mockReturnValue(providerWithoutMethod);
      
      const code = createAuthCode({
        provider: 'incomplete-provider',
        providerTokens: { code: 'provider-auth-code' }
      });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String)
      }));
    });
  });

  describe('handleRefreshTokenGrant', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create a token first to get a refresh token
      const code = createAuthCode();
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);
      const tokens = (mockRes.json as any).mock.calls[0][0];
      refreshToken = tokens.refresh_token;
      
      // Reset mocks for refresh token tests
      vi.clearAllMocks();
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      };
    });

    it('should reject missing refresh_token', async () => {
      mockReq = {
        body: {
          grant_type: 'refresh_token'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidRequest).toHaveBeenCalledWith('Missing refresh token');
    });

    it('should reject invalid refresh_token', async () => {
      mockReq = {
        body: {
          grant_type: 'refresh_token',
          refresh_token: 'invalid-refresh-token'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidGrant).toHaveBeenCalledWith('Invalid refresh token');
    });

    it('should handle expired refresh token', async () => {
      // Create an expired refresh token by manipulating the internal storage
      mockReq = {
        body: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }
      };

      // Mock time to make token appear expired
      const originalDate = Date.now;
      Date.now = vi.fn(() => originalDate() + 31 * 24 * 60 * 60 * 1000); // 31 days later

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidGrant).toHaveBeenCalledWith('Refresh token expired');
      
      // Restore Date.now
      Date.now = originalDate;
    });

    it('should reject invalid client_id', async () => {
      // First create a refresh token with a specific client_id
      const code = createAuthCode({ client_id: 'correct-client' });
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback',
          client_id: 'correct-client'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);
      const tokens = (mockRes.json as any).mock.calls[0][0];
      
      // Reset mocks
      vi.clearAllMocks();
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      };

      // Now use refresh token with wrong client_id
      mockReq = {
        body: {
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: 'wrong-client'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockOAuth2Error.invalidGrant).toHaveBeenCalledWith('Invalid client');
    });

    it('should successfully refresh tokens', async () => {
      mockReq = {
        body: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: expect.any(String),
        scope: 'read write'
      }));
    });

    it('should allow optional client_id for refresh tokens', async () => {
      mockReq = {
        body: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken
          // No client_id provided
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String)
      }));
    });
  });

  describe('generateTokens', () => {
    it('should generate tokens with user data', async () => {
      const code = createAuthCode();
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockAuthRepository.getIUserById).toHaveBeenCalledWith('user123');
      expect(mockAuthRepository.getIUserIRoles).toHaveBeenCalledWith('user123');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: expect.any(String),
        scope: 'read write'
      }));
    });

    it('should handle user fetch failure and fallback to email', async () => {
      mockAuthRepository.getIUserById.mockRejectedValue(new Error('Database error'));
      
      const code = createAuthCode({ userEmail: 'fallback@example.com' });
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'AUTH',
        'Failed to fetch user data',
        expect.any(Object)
      );
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String)
      }));
    });

    it('should handle user fetch failure without email fallback', async () => {
      mockAuthRepository.getIUserById.mockRejectedValue(new Error('Database error'));
      
      const code = createAuthCode({ userEmail: null });
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String)
      }));
    });

    it('should handle anonymous user', async () => {
      const code = createAuthCode({ userId: null });
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String)
      }));
    });

    it('should handle provider information in session', async () => {
      const code = createAuthCode({ 
        provider: 'github',
        providerTokens: { access_token: 'provider-token' }
      });
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String)
      }));
    });

    it('should handle null user data response', async () => {
      mockAuthRepository.getIUserById.mockResolvedValue(null);
      
      const code = createAuthCode({ userEmail: 'user@example.com' });
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        access_token: expect.any(String)
      }));
    });
  });

  describe('Static Methods', () => {
    describe('getUserSession', () => {
      it('should return user session data', async () => {
        // First create a session by exchanging an auth code
        const code = createAuthCode();
        mockReq = {
          body: {
            grant_type: 'authorization_code',
            code,
            redirect_uri: 'http://localhost:3000/callback'
          }
        };

        await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);
        
        // Extract session ID from generated token
        const response = (mockRes.json as any).mock.calls[0][0];
        const tokenPayload = JSON.parse(Buffer.from(response.access_token, 'base64url').toString());
        const sessionId = tokenPayload.sessionid;

        const sessionData = TokenEndpoint.getUserSession(sessionId);
        expect(sessionData).toEqual({
          userId: 'user123'
        });
      });

      it('should return undefined for non-existent session', () => {
        const sessionData = TokenEndpoint.getUserSession('non-existent-session');
        expect(sessionData).toBeUndefined();
      });
    });

    describe('validateAccessToken', () => {
      it('should validate and return valid access token payload', async () => {
        const code = createAuthCode();
        mockReq = {
          body: {
            grant_type: 'authorization_code',
            code,
            redirect_uri: 'http://localhost:3000/callback'
          }
        };

        await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);
        
        const response = (mockRes.json as any).mock.calls[0][0];
        const accessToken = response.access_token;

        const payload = await TokenEndpoint.validateAccessToken(accessToken);
        
        expect(payload).toMatchObject({
          sub: expect.any(String),
          tokentype: 'access',
          iss: 'test-issuer',
          aud: 'test-audience'
        });
      });

      it('should return null for invalid token', async () => {
        mockJwtVerify.mockRejectedValue(new Error('Invalid token'));
        
        const payload = await TokenEndpoint.validateAccessToken('invalid-token');
        expect(payload).toBeNull();
      });

      it('should return null for non-access token', async () => {
        const idTokenPayload = {
          sub: 'user123',
          tokentype: 'id',
          iss: 'test-issuer',
          aud: 'test-audience'
        };
        mockJwtVerify.mockResolvedValue({ payload: idTokenPayload });
        
        const payload = await TokenEndpoint.validateAccessToken('id-token');
        expect(payload).toBeNull();
      });

      it('should return null for token without tokentype', async () => {
        const tokenPayload = {
          sub: 'user123',
          iss: 'test-issuer',
          aud: 'test-audience'
        };
        mockJwtVerify.mockResolvedValue({ payload: tokenPayload });
        
        const payload = await TokenEndpoint.validateAccessToken('token-without-type');
        expect(payload).toBeNull();
      });

      it('should return null for null payload', async () => {
        mockJwtVerify.mockResolvedValue({ payload: null });
        
        const payload = await TokenEndpoint.validateAccessToken('null-payload-token');
        expect(payload).toBeNull();
      });

      it('should return null for non-object payload', async () => {
        mockJwtVerify.mockResolvedValue({ payload: 'string-payload' });
        
        const payload = await TokenEndpoint.validateAccessToken('string-payload-token');
        expect(payload).toBeNull();
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle non-Error type in error handler', async () => {
      // Mock an error that's not an Error instance
      mockAuthCodeService.getAuthorizationCode.mockRejectedValue('string error');
      
      const code = createAuthCode();
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'AUTH',
        'Token endpoint error',
        expect.objectContaining({
          error: expect.any(Error)
        })
      );
    });

    it('should handle provider token exchange error that is not Error instance', async () => {
      mockProvider.exchangeCodeForTokens.mockRejectedValue('string error');
      
      const code = createAuthCode({
        provider: 'github',
        providerTokens: { code: 'provider-auth-code' }
      });
      
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'AUTH',
        'Provider token exchange failed',
        expect.objectContaining({
          error: expect.any(Error)
        })
      );
    });

    it('should handle user data fetch error that is not Error instance', async () => {
      mockAuthRepository.getIUserById.mockRejectedValue('string error');
      
      const code = createAuthCode({ userEmail: 'fallback@example.com' });
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'AUTH',
        'Failed to fetch user data',
        expect.objectContaining({
          error: expect.any(Error)
        })
      );
    });
  });

  describe('Token Structure Validation', () => {
    it('should generate valid JWT structure for access tokens', async () => {
      const code = createAuthCode();
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);
      
      const response = (mockRes.json as any).mock.calls[0][0];
      const tokenPayload = JSON.parse(Buffer.from(response.access_token, 'base64url').toString());
      
      expect(tokenPayload).toMatchObject({
        sub: expect.any(String),
        tokentype: 'access',
        iss: 'test-issuer',
        aud: 'test-audience',
        exp: expect.any(Number),
        iat: expect.any(Number),
        jti: expect.any(String),
        user: expect.any(Object),
        roles: expect.any(Array)
      });
    });

    it('should generate valid refresh token structure', async () => {
      const code = createAuthCode();
      mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);
      
      const response = (mockRes.json as any).mock.calls[0][0];
      expect(response.refresh_token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });
});