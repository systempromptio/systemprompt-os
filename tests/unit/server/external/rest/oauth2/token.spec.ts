/**
 * @fileoverview Optimized unit tests for OAuth2 Token endpoint
 * @module tests/unit/server/external/rest/oauth2/token.optimized
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { TokenEndpoint } from '../../../../../../src/server/external/rest/oauth2/token';
import { AuthorizeEndpoint } from '../../../../../../src/server/external/rest/oauth2/authorize';
import { createHash } from 'crypto';

// Mock CONFIG
vi.mock('../../../../../../src/server/config', () => ({
  CONFIG: {
    JWTISSUER: 'test-issuer',
    JWTAUDIENCE: 'test-audience'
  }
}));

describe('OAuth2 Token Endpoint - Optimized', () => {
  let tokenEndpoint: TokenEndpoint;
  let authorizeEndpoint: AuthorizeEndpoint;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenEndpoint = new TokenEndpoint();
    authorizeEndpoint = new AuthorizeEndpoint();
  });

  // Helper to create authorization code
  async function createAuthCode(params = {}) {
    const authReq = {
      body: {
        action: 'approve',
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read write',
        ...params
      }
    };
    const authRes = { redirect: vi.fn() };
    
    await authorizeEndpoint.postAuthorize(authReq as Request, authRes as Response);
    const redirectUrl = new URL(vi.mocked(authRes.redirect).mock.calls[0][0]);
    return redirectUrl.searchParams.get('code');
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
      const mockReq = { body };
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