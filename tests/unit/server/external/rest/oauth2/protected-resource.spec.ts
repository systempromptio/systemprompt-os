/**
 * Unit tests for OAuth2 Protected Resource Metadata endpoint
 * Testing the actual implementation that uses getAuthModule().exports.oauth2ConfigService()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProtectedResourceEndpoint } from '../../../../../../src/server/external/rest/oauth2/protected-resource.js';
import type { Request, Response } from 'express';
import type { ProtectedResourceMetadata } from '../../../../../../src/server/external/rest/oauth2/protected-resource.js';
import type { IOAuth2ProtectedResourceMetadataInternal } from '../../../../../../src/modules/core/auth/types/oauth2.types.js';

// Mock dependencies
vi.mock('../../../../../../src/modules/core/auth/singleton', () => ({
  getAuthModule: vi.fn()
}));

// Import the mocked functions
import { getAuthModule } from '../../../../../../src/modules/core/auth/singleton.js';

describe('ProtectedResourceEndpoint', () => {
  let protectedResourceEndpoint: ProtectedResourceEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockAuthModule: any;
  let mockOAuth2ConfigService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    protectedResourceEndpoint = new ProtectedResourceEndpoint();
    
    mockReq = {};
    
    mockRes = {
      json: vi.fn().mockReturnThis()
    };

    // Setup mock auth module and oauth2ConfigService
    mockOAuth2ConfigService = {
      getProtectedResourceMetadata: vi.fn()
    };

    mockAuthModule = {
      exports: {
        oauth2ConfigService: vi.fn().mockReturnValue(mockOAuth2ConfigService)
      }
    };

    vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getProtectedResourceMetadata', () => {
    it('should successfully return protected resource metadata in happy path', () => {
      const mockMetadata: IOAuth2ProtectedResourceMetadataInternal = {
        resource: 'https://example.com/mcp',
        authorization_servers: ['https://example.com'],
        bearer_methods_supported: ['header'],
        scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
        resource_documentation: 'https://example.com/docs/api'
      };

      mockOAuth2ConfigService.getProtectedResourceMetadata.mockReturnValue(mockMetadata);

      const result = protectedResourceEndpoint.getProtectedResourceMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      // Verify the auth module was called correctly
      expect(getAuthModule).toHaveBeenCalledTimes(1);
      expect(mockAuthModule.exports.oauth2ConfigService).toHaveBeenCalledTimes(1);
      expect(mockOAuth2ConfigService.getProtectedResourceMetadata).toHaveBeenCalledTimes(1);
      
      // Verify response was sent with correct metadata
      expect(mockRes.json).toHaveBeenCalledWith(mockMetadata);
      
      // Verify return value is the Response object
      expect(result).toBe(mockRes);
    });

    it('should handle metadata with all RFC 9728 required fields', () => {
      const mockMetadata: IOAuth2ProtectedResourceMetadataInternal = {
        resource: 'https://api.example.com/protected',
        authorization_servers: ['https://auth.example.com', 'https://backup-auth.example.com']
      };

      mockOAuth2ConfigService.getProtectedResourceMetadata.mockReturnValue(mockMetadata);

      protectedResourceEndpoint.getProtectedResourceMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(mockMetadata);
      
      const sentMetadata = vi.mocked(mockRes.json).mock.calls[0][0];
      
      // Verify required fields per RFC 9728
      expect(sentMetadata).toHaveProperty('resource');
      expect(sentMetadata).toHaveProperty('authorization_servers');
      expect(Array.isArray(sentMetadata.authorization_servers)).toBe(true);
      expect(sentMetadata.authorization_servers.length).toBeGreaterThan(0);
    });

    it('should handle metadata with all optional fields', () => {
      const mockMetadata: IOAuth2ProtectedResourceMetadataInternal = {
        resource: 'https://api.example.com/protected',
        authorization_servers: ['https://auth.example.com'],
        bearer_methods_supported: ['header', 'query', 'body'],
        resource_documentation: 'https://docs.example.com/api',
        resource_signing_alg_values_supported: ['RS256', 'ES256'],
        resource_encryption_alg_values_supported: ['RSA-OAEP', 'A256KW'],
        resource_encryption_enc_values_supported: ['A256GCM', 'A256CBC-HS512'],
        scopes_supported: ['read', 'write', 'admin']
      };

      mockOAuth2ConfigService.getProtectedResourceMetadata.mockReturnValue(mockMetadata);

      protectedResourceEndpoint.getProtectedResourceMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(mockMetadata);
      
      const sentMetadata = vi.mocked(mockRes.json).mock.calls[0][0];
      
      // Verify all optional fields are preserved
      expect(sentMetadata.bearer_methods_supported).toEqual(['header', 'query', 'body']);
      expect(sentMetadata.resource_documentation).toBe('https://docs.example.com/api');
      expect(sentMetadata.resource_signing_alg_values_supported).toEqual(['RS256', 'ES256']);
      expect(sentMetadata.resource_encryption_alg_values_supported).toEqual(['RSA-OAEP', 'A256KW']);
      expect(sentMetadata.resource_encryption_enc_values_supported).toEqual(['A256GCM', 'A256CBC-HS512']);
      expect(sentMetadata.scopes_supported).toEqual(['read', 'write', 'admin']);
    });

    it('should handle empty authorization_servers array', () => {
      const mockMetadata: IOAuth2ProtectedResourceMetadataInternal = {
        resource: 'https://api.example.com/protected',
        authorization_servers: []
      };

      mockOAuth2ConfigService.getProtectedResourceMetadata.mockReturnValue(mockMetadata);

      protectedResourceEndpoint.getProtectedResourceMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(mockMetadata);
      
      const sentMetadata = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(sentMetadata.authorization_servers).toEqual([]);
    });

    it('should handle metadata with undefined optional fields', () => {
      const mockMetadata: IOAuth2ProtectedResourceMetadataInternal = {
        resource: 'https://api.example.com/protected',
        authorization_servers: ['https://auth.example.com'],
        bearer_methods_supported: undefined,
        resource_documentation: undefined,
        resource_signing_alg_values_supported: undefined,
        resource_encryption_alg_values_supported: undefined,
        resource_encryption_enc_values_supported: undefined,
        scopes_supported: undefined
      };

      mockOAuth2ConfigService.getProtectedResourceMetadata.mockReturnValue(mockMetadata);

      protectedResourceEndpoint.getProtectedResourceMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(mockMetadata);
    });

    it('should propagate error when getAuthModule throws', () => {
      const error = new Error('Auth module not loaded');
      vi.mocked(getAuthModule).mockImplementation(() => {
        throw error;
      });

      expect(() => {
        protectedResourceEndpoint.getProtectedResourceMetadata(
          mockReq as Request, 
          mockRes as Response
        );
      }).toThrow('Auth module not loaded');

      // Verify res.json was not called
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should propagate error when oauth2ConfigService throws', () => {
      const error = new Error('OAuth2 config service error');
      mockAuthModule.exports.oauth2ConfigService.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        protectedResourceEndpoint.getProtectedResourceMetadata(
          mockReq as Request, 
          mockRes as Response
        );
      }).toThrow('OAuth2 config service error');

      // Verify the chain of calls up to the error
      expect(getAuthModule).toHaveBeenCalledTimes(1);
      expect(mockAuthModule.exports.oauth2ConfigService).toHaveBeenCalledTimes(1);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should propagate error when getProtectedResourceMetadata throws', () => {
      const error = new Error('Failed to get protected resource metadata');
      mockOAuth2ConfigService.getProtectedResourceMetadata.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        protectedResourceEndpoint.getProtectedResourceMetadata(
          mockReq as Request, 
          mockRes as Response
        );
      }).toThrow('Failed to get protected resource metadata');

      // Verify the full chain of calls up to the error
      expect(getAuthModule).toHaveBeenCalledTimes(1);
      expect(mockAuthModule.exports.oauth2ConfigService).toHaveBeenCalledTimes(1);
      expect(mockOAuth2ConfigService.getProtectedResourceMetadata).toHaveBeenCalledTimes(1);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should handle different types of complex resource URLs', () => {
      const testCases = [
        'https://api.example.com/v1/mcp',
        'http://localhost:3000/protected',
        'https://sub.domain.com:8080/api/protected-resource',
        'https://example.com/path/to/resource?param=value'
      ];

      testCases.forEach(resourceUrl => {
        vi.clearAllMocks();
        
        const mockMetadata: IOAuth2ProtectedResourceMetadataInternal = {
          resource: resourceUrl,
          authorization_servers: ['https://auth.example.com']
        };

        mockOAuth2ConfigService.getProtectedResourceMetadata.mockReturnValue(mockMetadata);

        protectedResourceEndpoint.getProtectedResourceMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.json).toHaveBeenCalledWith(mockMetadata);
        
        const sentMetadata = vi.mocked(mockRes.json).mock.calls[0][0];
        expect(sentMetadata.resource).toBe(resourceUrl);
      });
    });

    it('should handle multiple authorization servers', () => {
      const authServers = [
        'https://primary-auth.example.com',
        'https://secondary-auth.example.com',
        'https://backup-auth.example.com'
      ];

      const mockMetadata: IOAuth2ProtectedResourceMetadataInternal = {
        resource: 'https://api.example.com/protected',
        authorization_servers: authServers
      };

      mockOAuth2ConfigService.getProtectedResourceMetadata.mockReturnValue(mockMetadata);

      protectedResourceEndpoint.getProtectedResourceMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(mockMetadata);
      
      const sentMetadata = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(sentMetadata.authorization_servers).toEqual(authServers);
      expect(sentMetadata.authorization_servers).toHaveLength(3);
    });

    it('should verify return type matches ProtectedResourceMetadata interface structure', () => {
      const mockMetadata: IOAuth2ProtectedResourceMetadataInternal = {
        resource: 'https://api.example.com/protected',
        authorization_servers: ['https://auth.example.com'],
        bearer_methods_supported: ['header'],
        resource_documentation: 'https://docs.example.com',
        resource_signing_alg_values_supported: ['RS256'],
        resource_encryption_alg_values_supported: ['RSA-OAEP'],
        resource_encryption_enc_values_supported: ['A256GCM'],
        scopes_supported: ['read', 'write']
      };

      mockOAuth2ConfigService.getProtectedResourceMetadata.mockReturnValue(mockMetadata);

      protectedResourceEndpoint.getProtectedResourceMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      const sentMetadata = vi.mocked(mockRes.json).mock.calls[0][0];
      
      // Type compatibility check - this should compile without errors
      const _: ProtectedResourceMetadata = sentMetadata;
      
      // Runtime verification of interface structure
      expect(typeof sentMetadata.resource).toBe('string');
      expect(Array.isArray(sentMetadata.authorization_servers)).toBe(true);
      
      if (sentMetadata.bearer_methods_supported) {
        expect(Array.isArray(sentMetadata.bearer_methods_supported)).toBe(true);
      }
      
      if (sentMetadata.resource_documentation) {
        expect(typeof sentMetadata.resource_documentation).toBe('string');
      }
      
      if (sentMetadata.resource_signing_alg_values_supported) {
        expect(Array.isArray(sentMetadata.resource_signing_alg_values_supported)).toBe(true);
      }
      
      if (sentMetadata.resource_encryption_alg_values_supported) {
        expect(Array.isArray(sentMetadata.resource_encryption_alg_values_supported)).toBe(true);
      }
      
      if (sentMetadata.resource_encryption_enc_values_supported) {
        expect(Array.isArray(sentMetadata.resource_encryption_enc_values_supported)).toBe(true);
      }
      
      if (sentMetadata.scopes_supported) {
        expect(Array.isArray(sentMetadata.scopes_supported)).toBe(true);
      }
    });

    it('should handle service calls with correct method signatures', () => {
      const mockMetadata: IOAuth2ProtectedResourceMetadataInternal = {
        resource: 'https://api.example.com/protected',
        authorization_servers: ['https://auth.example.com']
      };

      mockOAuth2ConfigService.getProtectedResourceMetadata.mockReturnValue(mockMetadata);

      protectedResourceEndpoint.getProtectedResourceMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      // Verify that getProtectedResourceMetadata is called without any arguments
      expect(mockOAuth2ConfigService.getProtectedResourceMetadata).toHaveBeenCalledWith();
      
      // Verify that oauth2ConfigService is called without any arguments
      expect(mockAuthModule.exports.oauth2ConfigService).toHaveBeenCalledWith();
    });
  });
});