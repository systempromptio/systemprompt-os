/**
 * Unit tests for OAuth2 Protected Resource Metadata endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProtectedResourceEndpoint } from '../../../../../../src/server/external/rest/oauth2/protected-resource';
import { tunnelStatus } from '../../../../../../src/modules/core/auth/tunnel-status';
import type { Request, Response } from 'express';

// Mock dependencies
vi.mock('../../../../../../src/modules/core/auth/tunnel-status', () => ({
  tunnelStatus: {
    getBaseUrlOrDefault: vi.fn()
  }
}));

describe('ProtectedResourceEndpoint', () => {
  let protectedResourceEndpoint: ProtectedResourceEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  const baseUrl = 'https://example.com';

  beforeEach(() => {
    vi.clearAllMocks();
    
    protectedResourceEndpoint = new ProtectedResourceEndpoint(baseUrl);
    
    mockReq = {};
    
    mockRes = {
      json: vi.fn()
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should remove trailing slash from baseUrl', () => {
      const endpointWithSlash = new ProtectedResourceEndpoint('https://example.com/');
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue('https://example.com');
      
      endpointWithSlash.getProtectedResourceMetadata(mockReq as Request, mockRes as Response);
      
      expect(vi.mocked(tunnelStatus.getBaseUrlOrDefault)).toHaveBeenCalledWith('https://example.com');
    });

    it('should keep baseUrl without trailing slash unchanged', () => {
      const endpoint = new ProtectedResourceEndpoint('https://example.com');
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue('https://example.com');
      
      endpoint.getProtectedResourceMetadata(mockReq as Request, mockRes as Response);
      
      expect(vi.mocked(tunnelStatus.getBaseUrlOrDefault)).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('getProtectedResourceMetadata', () => {
    it('should return complete protected resource metadata', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(baseUrl);

      protectedResourceEndpoint.getProtectedResourceMetadata(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        resource: 'https://example.com/mcp',
        authorization_servers: ['https://example.com'],
        bearer_methods_supported: ['header'],
        scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
        resource_documentation: 'https://example.com/docs/api'
      });
    });

    it('should use tunnel URL when available', () => {
      const tunnelUrl = 'https://tunnel.example.com';
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(tunnelUrl);

      protectedResourceEndpoint.getProtectedResourceMetadata(mockReq as Request, mockRes as Response);

      expect(vi.mocked(tunnelStatus.getBaseUrlOrDefault)).toHaveBeenCalledWith(baseUrl);
      
      const metadata = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(metadata.resource).toBe(`${tunnelUrl}/mcp`);
      expect(metadata.authorization_servers).toEqual([tunnelUrl]);
      expect(metadata.resource_documentation).toBe(`${tunnelUrl}/docs/api`);
    });

    it('should return Response object', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(baseUrl);
      vi.mocked(mockRes.json).mockReturnValue(mockRes as Response);

      const result = protectedResourceEndpoint.getProtectedResourceMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(result).toBe(mockRes);
    });

    it('should include all required metadata fields per RFC 9728', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(baseUrl);

      protectedResourceEndpoint.getProtectedResourceMetadata(mockReq as Request, mockRes as Response);

      const metadata = vi.mocked(mockRes.json).mock.calls[0][0];
      
      // Required fields per RFC 9728
      expect(metadata).toHaveProperty('resource');
      expect(metadata).toHaveProperty('authorization_servers');
      
      // Authorization servers must be an array
      expect(Array.isArray(metadata.authorization_servers)).toBe(true);
      expect(metadata.authorization_servers.length).toBeGreaterThan(0);
    });

    it('should indicate support for bearer token in header', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(baseUrl);

      protectedResourceEndpoint.getProtectedResourceMetadata(mockReq as Request, mockRes as Response);

      const metadata = vi.mocked(mockRes.json).mock.calls[0][0];
      
      expect(metadata.bearer_methods_supported).toEqual(['header']);
    });

    it('should include supported scopes', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(baseUrl);

      protectedResourceEndpoint.getProtectedResourceMetadata(mockReq as Request, mockRes as Response);

      const metadata = vi.mocked(mockRes.json).mock.calls[0][0];
      
      expect(metadata.scopes_supported).toEqual([
        'openid', 
        'profile', 
        'email', 
        'offline_access', 
        'agent'
      ]);
    });

    it('should handle multiple baseUrl formats correctly', () => {
      const testCases = [
        { input: 'http://localhost:3000/', expected: 'http://localhost:3000' },
        { input: 'https://api.example.com/v1/', expected: 'https://api.example.com/v1' },
        { input: 'https://example.com', expected: 'https://example.com' }
      ];

      testCases.forEach(({ input, expected }) => {
        const endpoint = new ProtectedResourceEndpoint(input);
        vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(expected);
        
        endpoint.getProtectedResourceMetadata(mockReq as Request, mockRes as Response);
        
        expect(vi.mocked(tunnelStatus.getBaseUrlOrDefault)).toHaveBeenCalledWith(expected);
      });
    });
  });
});