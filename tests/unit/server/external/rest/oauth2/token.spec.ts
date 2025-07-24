/**
 * @fileoverview Optimized unit tests for OAuth2 Token endpoint
 * @module tests/unit/server/external/rest/oauth2/token.optimized
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { TokenEndpoint } from '../../../../../../src/server/external/rest/oauth2/token.js';
import { AuthorizeEndpoint } from '../../../../../../src/server/external/rest/oauth2/authorize.js';
import { createHash } from 'crypto';


// Mock CONFIG
vi.mock('../../../../../../src/server/config', () => ({
  CONFIG: {
    JWTISSUER: 'test-issuer',
    JWTAUDIENCE: 'test-audience'
  }
}));

// Mock JWT functions
vi.mock('../../../../../../src/server/external/auth/jwt.js', () => ({
  jwtSign: vi.fn((payload) => {
    // Return a base64url encoded token for tests
    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return tokenData;
  }),
  jwtVerify: vi.fn((token) => {
    try {
      return JSON.parse(Buffer.from(token, 'base64url').toString());
    } catch {
      throw new Error('Invalid token');
    }
  })
}));

// Mock auth module
vi.mock('../../../../../../src/modules/core/auth/singleton.js', () => ({
  getAuthModule: vi.fn(() => ({
    getProviderRegistry: vi.fn(() => ({
      getProvider: vi.fn(() => ({
        getUserInfo: vi.fn(() => ({ sub: 'user123' }))
      }))
    }))
  }))
}));

// Mock database
vi.mock('../../../../../../src/modules/core/database/index.js', () => ({
  getDatabase: vi.fn(() => ({}))
}));

// Create mock auth repository instance
const mockAuthRepository = {
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
  createUser: vi.fn(),
  updateUser: vi.fn(),
  findUserByProviderSub: vi.fn(() => ({ id: 'user123' })),
  saveRefreshToken: vi.fn(),
  getRefreshToken: vi.fn(),
  deleteRefreshToken: vi.fn(),
  getUserById: vi.fn((userId) => ({
    id: userId,
    email: 'user@example.com',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.png'
  }))
};

// Mock auth repository
vi.mock('../../../../../../src/modules/core/auth/database/repository.js', () => ({
  AuthRepository: vi.fn().mockImplementation(() => mockAuthRepository)
}));

// Mock logger
vi.mock('../../../../../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock auth code service
const mockAuthCodeService = {
  createAuthorizationCode: vi.fn(() => 'mock-auth-code'),
  cleanupExpiredCodes: vi.fn(),
  getAuthorizationCode: vi.fn((code) => {
    if (code === 'invalid-code') return null;
    if (code.startsWith('test-auth-code-')) {
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
    }
    return null;
  }),
  deleteAuthorizationCode: vi.fn()
};

vi.mock('../../../../../../src/modules/core/auth/services/auth-code-service.js', () => ({
  AuthCodeService: vi.fn(() => mockAuthCodeService)
}));

describe('OAuth2 Token Endpoint - Optimized', () => {
  let tokenEndpoint: TokenEndpoint;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenEndpoint = new TokenEndpoint();
  });

  // Helper to create authorization code
  async function createAuthCode(params = {}) {
    // For testing, just generate a simple code
    const code = 'test-auth-code-' + Math.random().toString(36).substring(7);
    
    // Update the mock to return the proper auth code data when this code is used
    mockAuthCodeService.getAuthorizationCode.mockImplementation((requestedCode) => {
      if (requestedCode === code) {
        return {
          clientId: params.client_id || 'test-client',
          redirectUri: params.redirect_uri || 'http://localhost:3000/callback',
          scope: params.scope || 'read write',
          userId: 'user123',
          userEmail: 'user@example.com',
          codeChallenge: params.code_challenge || null,
          codeChallengeMethod: params.code_challenge_method || null,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        };
      }
      if (requestedCode === 'invalid-code') return null;
      return null;
    });
    
    return code;
  }

  // Authorization code grant tests
  describe('authorization_code grant', () => {
    it('exchanges valid authorization code for tokens', async () => {
      const code = await createAuthCode();
      const mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          client_id: 'test-client',
          client_secret: 'test-secret',
          redirect_uri: 'http://localhost:3000/callback'
        },
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        }
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: expect.stringMatching(/^[A-Za-z0-9_-]+$/),
        scope: 'read write'
      });
    });

    it('rejects invalid authorization code', async () => {
      const mockReq = {
        body: {
          grant_type: 'authorization_code',
          code: 'invalid-code',
          client_id: 'test-client',
          client_secret: 'test-secret',
          redirect_uri: 'http://localhost:3000/callback'
        },
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        }
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'invalid_grant',
        error_description: 'Invalid authorization code'
      });
    });
  });

  // Grant type validation
  describe('grant type validation', () => {
    it.each([
      {
        name: 'missing grant_type',
        body: { client_id: 'test' },
        expectedError: 'invalid_request'
      },
      {
        name: 'invalid grant_type', 
        body: { grant_type: 'invalid', client_id: 'test' },
        expectedError: 'invalid_request'
      },
      {
        name: 'authorization_code without code',
        body: {
          grant_type: 'authorization_code',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback'
        },
        expectedError: 'invalid_request'
      }
    ])('returns error for $name', async ({ body, expectedError }) => {
      const mockReq = { 
        body,
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        }
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expectedError
        })
      );
    });
  });

  // PKCE-specific tests (can't be generalized)
  describe('PKCE Flow', () => {
    it.each([
      {
        name: 'valid PKCE verification',
        verifier: 'test-verifier-string-that-is-long-enough',
        expectedStatus: 200
      },
      {
        name: 'missing code_verifier',
        verifier: undefined,
        expectedStatus: 400,
        expectedError: 'invalid_request'
      },
      {
        name: 'wrong code_verifier',
        verifier: 'wrong-verifier',
        expectedStatus: 400,
        expectedError: 'invalid_grant'
      }
    ])('handles $name', async ({ verifier, expectedStatus, expectedError }) => {
      const correctVerifier = 'test-verifier-string-that-is-long-enough';
      const codeChallenge = createHash('sha256')
        .update(correctVerifier)
        .digest('base64url');

      const code = await createAuthCode({
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });

      const mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          ...(verifier !== undefined && { code_verifier: verifier })
        },
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        }
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);

      if (expectedStatus === 200) {
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({ access_token: expect.any(String) })
        );
      } else {
        expect(mockRes.status).toHaveBeenCalledWith(expectedStatus);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({ error: expectedError })
        );
      }
    });
  });

  // Complete OAuth flow test
  describe('Authorization Code OAuth flow', () => {
    it('completes full flow successfully', async () => {
      // Step 1: Create authorization code
      const code = await createAuthCode({ 
        scope: 'read write profile',
        state: 'test-state' 
      });
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);

      // Step 2: Exchange code for tokens
      const tokenReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          client_id: 'test-client',
          client_secret: 'test-secret',
          redirect_uri: 'http://localhost:3000/callback'
        },
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        }
      };
      const tokenRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      
      await tokenEndpoint.postToken(tokenReq as Request, tokenRes as Response);
      const tokens = vi.mocked(tokenRes.json).mock.calls[0][0];
      
      expect(tokens).toMatchObject({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write profile'
      });

      // Step 3: Use refresh token
      const refreshReq = {
        body: {
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: 'test-client',
          client_secret: 'test-secret'
        },
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        }
      };
      const refreshRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      
      await tokenEndpoint.postToken(refreshReq as Request, refreshRes as Response);
      const refreshedTokens = vi.mocked(refreshRes.json).mock.calls[0][0];
      
      expect(refreshedTokens).toMatchObject({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600
      });
    });
  });

  // Token structure validation
  describe('Token Structure', () => {
    it('generates valid JWT structure for access tokens', async () => {
      const code = await createAuthCode();
      const mockReq = {
        body: {
          grant_type: 'authorization_code',
          code,
          client_id: 'test-client',
          client_secret: 'test-secret',
          redirect_uri: 'http://localhost:3000/callback'
        },
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        }
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await tokenEndpoint.postToken(mockReq as Request, mockRes as Response);
      
      const response = vi.mocked(mockRes.json).mock.calls[0][0];
      const tokenPayload = JSON.parse(Buffer.from(response.access_token, 'base64url').toString());
      
      expect(tokenPayload).toMatchObject({
        sub: expect.any(String),
        clientid: 'test-client',
        scope: 'read write',
        tokentype: 'access',
        iss: 'test-issuer',
        aud: 'test-audience',
        exp: expect.any(Number),
        iat: expect.any(Number)
      });
    });
  });
});