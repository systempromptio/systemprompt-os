import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// We need to reset the module between tests to clear the rate limit state
let rateLimitMiddleware: any;
let validateProtocolVersion: any;
let requestSizeLimit: any;

describe('Server Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    // Reset the module to clear internal state
    vi.resetModules();
    // Clear all intervals to prevent the middleware's cleanup interval
    vi.clearAllTimers();
    const middleware = await import('../../../src/server/middleware');
    rateLimitMiddleware = middleware.rateLimitMiddleware;
    validateProtocolVersion = middleware.validateProtocolVersion;
    requestSizeLimit = middleware.requestSizeLimit;
    
    mockReq = {
      headers: {},
      ip: '127.0.0.1',
      body: {}
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn()
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  describe('rateLimitMiddleware', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should allow requests within rate limit', () => {
      const middleware = rateLimitMiddleware(60000, 5);
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(i + 1);
      }
      
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding rate limit', () => {
      const middleware = rateLimitMiddleware(60000, 2);
      
      // Make 3 requests
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Too many requests',
          data: expect.any(Object)
        },
        id: null
      });
    });

    it('should reset rate limit after window expires', () => {
      const middleware = rateLimitMiddleware(60000, 2);
      
      // Make 2 requests
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Advance time past window
      vi.advanceTimersByTime(61000);
      
      // Should allow new request
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(3);
    });

    it('should track rate limits per IP', () => {
      const middleware = rateLimitMiddleware(60000, 1);
      
      // Request from first IP
      mockReq.ip = '192.168.1.1';
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      // Request from second IP should be allowed
      mockReq.ip = '192.168.1.2';
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);
      
      // Second request from first IP should be blocked
      mockReq.ip = '192.168.1.1';
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should handle undefined IP gracefully', () => {
      const middleware = rateLimitMiddleware(60000, 1);
      mockReq.ip = undefined;
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Second request should be rate limited
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should use default values when no parameters provided', () => {
      const middleware = rateLimitMiddleware();
      
      // Should allow up to 100 requests by default
      for (let i = 0; i < 100; i++) {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }
      expect(mockNext).toHaveBeenCalledTimes(100);
      
      // 101st request should be blocked
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should calculate retry-after correctly', () => {
      const middleware = rateLimitMiddleware(60000, 1);
      
      // First request
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);
      
      // Second request should be blocked with retry-after ~30 seconds
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const jsonCall = (mockRes.json as any).mock.calls[0][0];
      expect(jsonCall.error.data.retryAfter).toBeGreaterThanOrEqual(29);
      expect(jsonCall.error.data.retryAfter).toBeLessThanOrEqual(31);
    });
  });

  describe('validateProtocolVersion', () => {
    it('should allow requests without protocol version header', () => {
      delete mockReq.headers!['mcp-protocol-version'];
      
      validateProtocolVersion(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow supported protocol versions', () => {
      const supportedVersions = ['2025-06-18', '2025-03-26', '2024-11-05'];
      
      supportedVersions.forEach(version => {
        mockNext.mockClear();
        mockReq.headers!['mcp-protocol-version'] = version;
        
        validateProtocolVersion(mockReq as Request, mockRes as Response, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
      });
    });

    it('should reject unsupported protocol versions', () => {
      mockReq.headers!['mcp-protocol-version'] = '2023-01-01';
      
      validateProtocolVersion(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Unsupported protocol version',
          data: {
            supported: ['2025-06-18', '2025-03-26', '2024-11-05'],
            requested: '2023-01-01'
          }
        },
        id: null
      });
    });
  });

  describe('requestSizeLimit', () => {
    it('should allow requests within size limit', () => {
      const middleware = requestSizeLimit(1024);
      mockReq.headers!['content-length'] = '512';
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding size limit', () => {
      const middleware = requestSizeLimit(1024);
      mockReq.headers!['content-length'] = '2048';
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Request entity too large',
          data: {
            maxSize: 1024,
            received: 2048
          }
        },
        id: null
      });
    });

    it('should handle missing content-length header', () => {
      const middleware = requestSizeLimit(1024);
      delete mockReq.headers!['content-length'];
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use default size limit of 10MB', () => {
      const middleware = requestSizeLimit();
      mockReq.headers!['content-length'] = String(5 * 1024 * 1024); // 5MB
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      
      // Test exceeding default limit
      mockNext.mockClear();
      mockReq.headers!['content-length'] = String(11 * 1024 * 1024); // 11MB
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(413);
    });
  });

  describe('cleanup interval', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clean up expired rate limit entries', async () => {
      // Reset modules to start fresh
      vi.resetModules();
      vi.clearAllTimers();
      
      const middleware = await import('../../../src/server/middleware');
      const rateLimiter = middleware.rateLimitMiddleware(60000, 1);
      
      // Create rate limit entries for different IPs
      const req1 = { ...mockReq, ip: '1.1.1.1' };
      const req2 = { ...mockReq, ip: '2.2.2.2' };
      
      rateLimiter(req1 as Request, mockRes as Response, mockNext);
      rateLimiter(req2 as Request, mockRes as Response, mockNext);
      
      // Second requests should be rate limited
      mockNext.mockClear();
      rateLimiter(req1 as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      
      // Advance time to trigger cleanup (61 seconds)
      vi.advanceTimersByTime(61000);
      
      // After cleanup, requests should be allowed again
      mockNext.mockClear();
      vi.mocked(mockRes.status).mockClear();
      rateLimiter(req1 as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});