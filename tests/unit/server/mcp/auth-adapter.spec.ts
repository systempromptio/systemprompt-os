/**
 * @fileoverview Unit tests for MCP authentication adapter
 * @module tests/unit/server/mcp
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { mcpAuthAdapter } from '@/server/mcp/auth-adapter.js';
import { authMiddleware } from '@/server/external/middleware/auth.js';
import { CONFIG } from '@/server/config.js';
import { tunnelStatus } from '@/modules/core/auth/tunnel-status.js';

vi.mock('@/server/external/middleware/auth.js', () => ({
  authMiddleware: vi.fn()
}));

vi.mock('@/server/config.js', () => ({
  CONFIG: {
    BASEURL: 'https://example.com'
  }
}));

vi.mock('@/modules/core/auth/tunnel-status.js', () => ({
  tunnelStatus: {
    getBaseUrlOrDefault: vi.fn((defaultUrl) => defaultUrl)
  }
}));

describe('MCP Auth Adapter', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let originalEnv: string | undefined;

  beforeEach(() => {
    mockReq = {
      body: { id: 'test-id' }
    };
    
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn()
    };
    
    mockNext = vi.fn();
    originalEnv = process.env.MCP_AUTH_DISABLED;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.MCP_AUTH_DISABLED = originalEnv;
  });

  it('should bypass auth when MCP_AUTH_DISABLED is true', () => {
    process.env.MCP_AUTH_DISABLED = 'true';
    
    mcpAuthAdapter(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(authMiddleware).not.toHaveBeenCalled();
  });

  it('should call auth middleware when auth is enabled', () => {
    process.env.MCP_AUTH_DISABLED = 'false';
    
    mcpAuthAdapter(mockReq as Request, mockRes as Response, mockNext);
    
    expect(authMiddleware).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
  });

  it('should transform 401 errors to MCP format', () => {
    let capturedStatus = 200;
    let capturedJson: any;
    
    // Mock the response methods
    mockRes.status = vi.fn((code: number) => {
      capturedStatus = code;
      return mockRes as Response;
    });
    
    mockRes.json = vi.fn((body: any) => {
      capturedJson = body;
      return mockRes as Response;
    });
    
    // Execute the adapter
    mcpAuthAdapter(mockReq as Request, mockRes as Response, mockNext);
    
    // Get the overridden methods
    const overriddenStatus = mockRes.status as any;
    const overriddenJson = mockRes.json as any;
    
    // Simulate a 401 error
    overriddenStatus(401);
    overriddenJson({ error_description: 'Invalid token' });
    
    // Verify WWW-Authenticate header was set
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Bearer realm="https://example.com/mcp", as_uri="https://example.com/.well-known/oauth-protected-resource"'
    );
    
    // Verify the response was transformed to MCP format
    expect(capturedJson).toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Invalid token'
      },
      id: 'test-id'
    });
  });

  it('should use default message when error_description is missing', () => {
    let capturedJson: any;
    
    mockRes.status = vi.fn(() => mockRes as Response);
    mockRes.json = vi.fn((body: any) => {
      capturedJson = body;
      return mockRes as Response;
    });
    
    mcpAuthAdapter(mockReq as Request, mockRes as Response, mockNext);
    
    const overriddenStatus = mockRes.status as any;
    const overriddenJson = mockRes.json as any;
    
    overriddenStatus(401);
    overriddenJson({});
    
    expect(capturedJson.error.message).toBe('Authentication required');
  });

  it('should handle requests without body id', () => {
    mockReq.body = undefined;
    let capturedJson: any;
    
    mockRes.status = vi.fn(() => mockRes as Response);
    mockRes.json = vi.fn((body: any) => {
      capturedJson = body;
      return mockRes as Response;
    });
    
    mcpAuthAdapter(mockReq as Request, mockRes as Response, mockNext);
    
    const overriddenStatus = mockRes.status as any;
    const overriddenJson = mockRes.json as any;
    
    overriddenStatus(401);
    overriddenJson({ error_description: 'Test error' });
    
    expect(capturedJson.id).toBe(null);
  });

  it('should not transform non-401 responses', () => {
    let capturedJson: any;
    const originalBody = { data: 'test' };
    
    mockRes.status = vi.fn(() => mockRes as Response);
    mockRes.json = vi.fn((body: any) => {
      capturedJson = body;
      return mockRes as Response;
    });
    
    mcpAuthAdapter(mockReq as Request, mockRes as Response, mockNext);
    
    const overriddenStatus = mockRes.status as any;
    const overriddenJson = mockRes.json as any;
    
    overriddenStatus(200);
    overriddenJson(originalBody);
    
    expect(capturedJson).toEqual(originalBody);
    expect(mockRes.setHeader).not.toHaveBeenCalled();
  });

  it('should use tunnel status for base URL', () => {
    vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue('https://tunnel.example.com');
    
    mockRes.status = vi.fn(() => mockRes as Response);
    mockRes.json = vi.fn(() => mockRes as Response);
    
    mcpAuthAdapter(mockReq as Request, mockRes as Response, mockNext);
    
    const overriddenStatus = mockRes.status as any;
    const overriddenJson = mockRes.json as any;
    
    overriddenStatus(401);
    overriddenJson({});
    
    expect(tunnelStatus.getBaseUrlOrDefault).toHaveBeenCalledWith(CONFIG.BASEURL);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Bearer realm="https://tunnel.example.com/mcp", as_uri="https://tunnel.example.com/.well-known/oauth-protected-resource"'
    );
  });

  it('should preserve original response methods', () => {
    const originalJson = mockRes.json;
    const originalStatus = mockRes.status;
    
    mcpAuthAdapter(mockReq as Request, mockRes as Response, mockNext);
    
    // The methods should be overridden
    expect(mockRes.json).not.toBe(originalJson);
    expect(mockRes.status).not.toBe(originalStatus);
  });
});