/**
 * @fileoverview Unit tests for splash page endpoint
 * @module tests/unit/server/external/rest/splash
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, Router } from 'express';
import { SplashEndpoint, setupRoutes } from '@/server/external/rest/splash';

// Mock the template
vi.mock('@/server/external/templates/splash.js', () => ({
  renderSplashPage: vi.fn(() => '<html>Test Splash Page</html>')
}));

describe('SplashEndpoint', () => {
  let endpoint: SplashEndpoint;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    endpoint = new SplashEndpoint();
    
    mockRequest = {};
    
    mockResponse = {
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
  });

  describe('handleSplashPage', () => {
    it('should render and send splash page HTML', async () => {
      const { renderSplashPage } = await import('@/server/external/templates/splash.js');
      
      await endpoint.handleSplashPage(mockRequest as Request, mockResponse as Response);
      
      expect(renderSplashPage).toHaveBeenCalled();
      expect(mockResponse.type).toHaveBeenCalledWith('html');
      expect(mockResponse.send).toHaveBeenCalledWith('<html>Test Splash Page</html>');
    });

    it('should handle multiple requests', async () => {
      await endpoint.handleSplashPage(mockRequest as Request, mockResponse as Response);
      await endpoint.handleSplashPage(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.type).toHaveBeenCalledTimes(2);
      expect(mockResponse.send).toHaveBeenCalledTimes(2);
    });
  });
});

describe('setupRoutes', () => {
  let mockRouter: Partial<Router>;
  let routeHandler: Function;

  beforeEach(() => {
    mockRouter = {
      get: vi.fn((path: string, handler: Function) => {
        if (path === '/') {
          routeHandler = handler;
        }
      })
    };
  });

  it('should register GET / route', () => {
    setupRoutes(mockRouter as Router);
    
    expect(mockRouter.get).toHaveBeenCalledWith('/', expect.any(Function));
  });

  it('should handle requests through the registered route', async () => {
    setupRoutes(mockRouter as Router);
    
    const mockReq = { query: {} } as Request;
    const mockRes = {
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    } as unknown as Response;
    
    // Call the registered handler
    await routeHandler(mockReq, mockRes);
    
    expect(mockRes.type).toHaveBeenCalledWith('html');
    expect(mockRes.send).toHaveBeenCalledWith('<html>Test Splash Page</html>');
  });

  it('should create new endpoint instance', () => {
    const spy = vi.spyOn(SplashEndpoint.prototype, 'handleSplashPage');
    
    setupRoutes(mockRouter as Router);
    
    const mockReq = { query: {} } as Request;
    const mockRes = {
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    } as unknown as Response;
    
    routeHandler(mockReq, mockRes);
    
    expect(spy).toHaveBeenCalledWith(mockReq, mockRes);
    
    spy.mockRestore();
  });
});