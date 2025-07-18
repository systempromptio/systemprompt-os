import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authMiddleware } from '../../../../../src/server/external/middleware/auth';
import { jwtVerify } from '../../../../../src/server/external/auth/jwt';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../../../../src/server/external/auth/jwt', () => ({
  jwtVerify: vi.fn()
}));

vi.mock('../../../../../src/server/config', () => ({
  CONFIG: {
    JWTSECRET: 'test-secret',
    JWTISSUER: 'test-issuer',
    JWTAUDIENCE: 'test-audience'
  }
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: undefined
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn()
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  describe('authMiddleware', () => {
    it('should authenticate valid Bearer token', async () => {
      const mockPayload = { 
        sub: '123', 
        clientid: 'test-client',
        scope: 'read write',
        iss: 'test-issuer',
        aud: 'test-audience',
        tokentype: 'access'
      };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload });

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(jwtVerify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect((mockReq as any).user).toEqual({
        sub: mockPayload.sub,
        clientid: mockPayload.clientid,
        scope: mockPayload.scope
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject missing authorization header', async () => {
      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Missing bearer token'
      });
    });

    it('should reject non-Bearer tokens', async () => {
      mockReq.headers = { authorization: 'Basic sometoken' };

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Missing bearer token'
      });
    });

    it('should handle invalid tokens', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid token'));

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Invalid token'
      });
    });

    it('should handle expired tokens', async () => {
      mockReq.headers = { authorization: 'Bearer expired-token' };
      const expiredError = new Error('Token expired');
      (expiredError as any).name = 'TokenExpiredError';
      vi.mocked(jwtVerify).mockRejectedValue(expiredError);

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Invalid token'
      });
    });

    it('should pass token with spaces without trimming', async () => {
      const mockPayload = { 
        sub: '456', 
        clientid: 'test-client',
        scope: 'read',
        iss: 'test-issuer',
        aud: 'test-audience',
        tokentype: 'access'
      };
      mockReq.headers = { authorization: 'Bearer   token-with-spaces   ' };
      vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload });

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(jwtVerify).toHaveBeenCalledWith('  token-with-spaces   ', 'test-secret');
      expect((mockReq as any).user).toEqual({
        sub: mockPayload.sub,
        clientid: mockPayload.clientid,  
        scope: mockPayload.scope
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid issuer', async () => {
      const mockPayload = { 
        sub: '123', 
        clientid: 'test-client',
        scope: 'read write',
        iss: 'wrong-issuer',
        aud: 'test-audience',
        tokentype: 'access'
      };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload });

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Invalid token issuer or audience'
      });
    });

    it('should reject invalid audience', async () => {
      const mockPayload = { 
        sub: '123', 
        clientid: 'test-client',
        scope: 'read write',
        iss: 'test-issuer',
        aud: 'wrong-audience',
        tokentype: 'access'
      };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload });

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Invalid token issuer or audience'
      });
    });

    it('should reject non-access token type', async () => {
      const mockPayload = { 
        sub: '123', 
        clientid: 'test-client',
        scope: 'read write',
        iss: 'test-issuer',
        aud: 'test-audience',
        tokentype: 'refresh'
      };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload });

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Invalid token type'
      });
    });
  });
});