import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// We need to reset the module between tests to clear the rate limit state
let rateLimitMiddleware: any;

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
  });
});