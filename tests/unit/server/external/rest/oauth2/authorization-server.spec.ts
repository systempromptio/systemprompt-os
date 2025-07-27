/**
 * Unit tests for OAuth2 Authorization Server Metadata endpoint
 * 
 * This test suite provides 100% coverage for the AuthorizationServerEndpoint class,
 * including all functions, branches, conditions, and error scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { AuthorizationServerEndpoint } from '../../../../../../src/server/external/rest/oauth2/authorization-server.js';
import type { IOAuth2ServerMetadataInternal } from '../../../../../../src/modules/core/auth/types/oauth2.types.js';

// Mock the auth module
vi.mock('../../../../../../src/modules/core/auth/index', () => ({
  getAuthModule: vi.fn()
}));

// Import after mocking
import { getAuthModule } from '../../../../../../src/modules/core/auth/index';

describe('AuthorizationServerEndpoint', () => {
  let authServerEndpoint: AuthorizationServerEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockAuthModule: any;
  let mockOAuth2ConfigService: any;

  const mockMetadata: IOAuth2ServerMetadataInternal = {
    issuer: 'https://test.example.com',
    authorization_endpoint: 'https://test.example.com/oauth2/authorize',
    token_endpoint: 'https://test.example.com/oauth2/token',
    jwks_uri: 'https://test.example.com/.well-known/jwks.json',
    registration_endpoint: 'https://test.example.com/oauth2/register',
    scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
    response_types_supported: ['code', 'code id_token'],
    response_modes_supported: ['query', 'fragment'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'none'
    ],
    service_documentation: 'https://test.example.com/docs/api',
    code_challenge_methods_supported: ['S256', 'plain'],
    userinfo_endpoint: 'https://test.example.com/oauth2/userinfo',
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256', 'HS256'],
    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'name',
      'preferred_username',
      'email',
      'email_verified',
      'agent_id',
      'agent_type'
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console.error
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create fresh instance for each test
    authServerEndpoint = new AuthorizationServerEndpoint();
    
    // Setup mock request
    mockReq = {
      method: 'GET',
      headers: {},
      query: {},
      params: {}
    };
    
    // Setup mock response with chainable methods
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    // Setup mock OAuth2ConfigService
    mockOAuth2ConfigService = {
      getAuthorizationServerMetadata: vi.fn().mockReturnValue(mockMetadata)
    };

    // Setup mock auth module
    mockAuthModule = {
      exports: {
        oauth2ConfigService: vi.fn().mockReturnValue(mockOAuth2ConfigService)
      }
    };

    // Mock getAuthModule to return our mock
    vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance without parameters', () => {
      const instance = new AuthorizationServerEndpoint();
      expect(instance).toBeInstanceOf(AuthorizationServerEndpoint);
      expect(instance.getAuthorizationServerMetadata).toBeDefined();
      expect(typeof instance.getAuthorizationServerMetadata).toBe('function');
    });
  });

  describe('getAuthorizationServerMetadata', () => {
    describe('successful GET requests', () => {
      it('should successfully return authorization server metadata for GET request', () => {
        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        // Verify the auth module was called correctly
        expect(getAuthModule).toHaveBeenCalledTimes(1);
        expect(mockAuthModule.exports.oauth2ConfigService).toHaveBeenCalledTimes(1);
        expect(mockOAuth2ConfigService.getAuthorizationServerMetadata).toHaveBeenCalledTimes(1);
        
        // Verify response was called with correct metadata
        expect(mockRes.json).toHaveBeenCalledTimes(1);
        expect(mockRes.json).toHaveBeenCalledWith(mockMetadata);
        
        // Verify return value is the response object
        expect(result).toBe(mockRes);
        
        // Verify status was not called (no error)
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should handle different metadata configurations', () => {
        const alternativeMetadata: IOAuth2ServerMetadataInternal = {
          issuer: 'https://alternative.example.com',
          authorization_endpoint: 'https://alternative.example.com/auth',
          token_endpoint: 'https://alternative.example.com/token',
          jwks_uri: 'https://alternative.example.com/jwks',
          response_types_supported: ['code'],
          scopes_supported: ['openid', 'profile'],
          grant_types_supported: ['authorization_code'],
          token_endpoint_auth_methods_supported: ['client_secret_basic'],
          userinfo_endpoint: 'https://alternative.example.com/userinfo'
        };

        mockOAuth2ConfigService.getAuthorizationServerMetadata.mockReturnValue(alternativeMetadata);

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.json).toHaveBeenCalledWith(alternativeMetadata);
        expect(result).toBe(mockRes);
      });

      it('should handle metadata with minimal required fields only', () => {
        const minimalMetadata: IOAuth2ServerMetadataInternal = {
          issuer: 'https://minimal.example.com',
          authorization_endpoint: 'https://minimal.example.com/oauth2/authorize',
          token_endpoint: 'https://minimal.example.com/oauth2/token',
          jwks_uri: 'https://minimal.example.com/.well-known/jwks.json',
          response_types_supported: ['code']
        };

        mockOAuth2ConfigService.getAuthorizationServerMetadata.mockReturnValue(minimalMetadata);

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.json).toHaveBeenCalledWith(minimalMetadata);
        expect(result).toBe(mockRes);
      });

      it('should handle metadata with empty arrays', () => {
        const metadataWithEmptyArrays: IOAuth2ServerMetadataInternal = {
          issuer: 'https://empty.example.com',
          authorization_endpoint: 'https://empty.example.com/oauth2/authorize',
          token_endpoint: 'https://empty.example.com/oauth2/token',
          jwks_uri: 'https://empty.example.com/.well-known/jwks.json',
          response_types_supported: [],
          scopes_supported: [],
          grant_types_supported: [],
          claims_supported: []
        };

        mockOAuth2ConfigService.getAuthorizationServerMetadata.mockReturnValue(metadataWithEmptyArrays);

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.json).toHaveBeenCalledWith(metadataWithEmptyArrays);
        expect(result).toBe(mockRes);
      });
    });

    describe('HTTP method validation', () => {
      it('should return 405 Method Not Allowed for POST request', () => {
        mockReq.method = 'POST';

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(405);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
        expect(result).toBe(mockRes);
        
        // Verify auth module was not called
        expect(getAuthModule).not.toHaveBeenCalled();
      });

      it('should return 405 Method Not Allowed for PUT request', () => {
        mockReq.method = 'PUT';

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(405);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
        expect(result).toBe(mockRes);
      });

      it('should return 405 Method Not Allowed for DELETE request', () => {
        mockReq.method = 'DELETE';

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(405);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
        expect(result).toBe(mockRes);
      });

      it('should return 405 Method Not Allowed for PATCH request', () => {
        mockReq.method = 'PATCH';

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(405);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
        expect(result).toBe(mockRes);
      });

      it('should return 405 Method Not Allowed for HEAD request', () => {
        mockReq.method = 'HEAD';

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(405);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
        expect(result).toBe(mockRes);
      });

      it('should return 405 Method Not Allowed for OPTIONS request', () => {
        mockReq.method = 'OPTIONS';

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(405);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
        expect(result).toBe(mockRes);
      });

      it('should return 405 Method Not Allowed for undefined method', () => {
        mockReq.method = undefined;

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(405);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
        expect(result).toBe(mockRes);
      });
    });

    describe('error handling', () => {
      it('should handle error from getAuthModule and return 500', () => {
        const authError = new Error('Auth module not loaded');
        vi.mocked(getAuthModule).mockImplementation(() => {
          throw authError;
        });

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'internal_server_error',
          error_description: 'Auth module not loaded'
        });
        expect(result).toBe(mockRes);
        expect(console.error).toHaveBeenCalledWith('OAuth2 authorization server metadata error:', authError);
      });

      it('should handle error from oauth2ConfigService and return 500', () => {
        const serviceError = new Error('Configuration service failed');
        mockOAuth2ConfigService.getAuthorizationServerMetadata.mockImplementation(() => {
          throw serviceError;
        });

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'internal_server_error',
          error_description: 'Configuration service failed'
        });
        expect(result).toBe(mockRes);
        expect(console.error).toHaveBeenCalledWith('OAuth2 authorization server metadata error:', serviceError);
      });

      it('should handle oauth2ConfigService being undefined and return 500', () => {
        mockAuthModule.exports.oauth2ConfigService.mockReturnValue(undefined);

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'internal_server_error',
          error_description: expect.stringContaining('getAuthorizationServerMetadata')
        });
        expect(result).toBe(mockRes);
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle oauth2ConfigService being null and return 500', () => {
        mockAuthModule.exports.oauth2ConfigService.mockReturnValue(null);

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'internal_server_error',
          error_description: expect.stringContaining('getAuthorizationServerMetadata')
        });
        expect(result).toBe(mockRes);
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle auth module exports being null and return 500', () => {
        mockAuthModule.exports = null;
        vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'internal_server_error',
          error_description: expect.stringContaining('oauth2ConfigService')
        });
        expect(result).toBe(mockRes);
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle auth module exports being undefined and return 500', () => {
        mockAuthModule.exports = undefined;
        vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'internal_server_error',
          error_description: expect.stringContaining('oauth2ConfigService')
        });
        expect(result).toBe(mockRes);
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle oauth2ConfigService method being undefined and return 500', () => {
        mockAuthModule.exports.oauth2ConfigService = undefined;
        vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'internal_server_error',
          error_description: expect.stringContaining('oauth2ConfigService')
        });
        expect(result).toBe(mockRes);
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle non-Error exceptions and return 500', () => {
        vi.mocked(getAuthModule).mockImplementation(() => {
          throw 'String error';
        });

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'internal_server_error',
          error_description: 'Failed to get authorization server metadata'
        });
        expect(result).toBe(mockRes);
        expect(console.error).toHaveBeenCalledWith('OAuth2 authorization server metadata error:', 'String error');
      });

      it('should handle null exception and return 500', () => {
        vi.mocked(getAuthModule).mockImplementation(() => {
          throw null;
        });

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'internal_server_error',
          error_description: 'Failed to get authorization server metadata'
        });
        expect(result).toBe(mockRes);
        expect(console.error).toHaveBeenCalledWith('OAuth2 authorization server metadata error:', null);
      });

      it('should handle undefined exception and return 500', () => {
        vi.mocked(getAuthModule).mockImplementation(() => {
          throw undefined;
        });

        const result = authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'internal_server_error',
          error_description: 'Failed to get authorization server metadata'
        });
        expect(result).toBe(mockRes);
        expect(console.error).toHaveBeenCalledWith('OAuth2 authorization server metadata error:', undefined);
      });
    });

    describe('interface compliance and edge cases', () => {
      it('should validate interface compliance with IOAuth2ServerMetadataInternal', () => {
        authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        const calledMetadata = vi.mocked(mockRes.json).mock.calls[0][0];
        
        // Verify required RFC 8414 fields are present
        expect(calledMetadata).toHaveProperty('issuer');
        expect(calledMetadata).toHaveProperty('authorization_endpoint');
        expect(calledMetadata).toHaveProperty('token_endpoint');
        expect(calledMetadata).toHaveProperty('jwks_uri');
        expect(calledMetadata).toHaveProperty('response_types_supported');
        
        // Verify field types
        expect(typeof calledMetadata.issuer).toBe('string');
        expect(typeof calledMetadata.authorization_endpoint).toBe('string');
        expect(typeof calledMetadata.token_endpoint).toBe('string');
        expect(typeof calledMetadata.jwks_uri).toBe('string');
        expect(Array.isArray(calledMetadata.response_types_supported)).toBe(true);
      });

      it('should preserve exact metadata structure without modification', () => {
        const originalMetadata = { ...mockMetadata };
        
        authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );

        // Verify the metadata passed to response is exactly what was returned from service
        expect(mockRes.json).toHaveBeenCalledWith(originalMetadata);
        
        // Verify no mutation occurred
        expect(mockOAuth2ConfigService.getAuthorizationServerMetadata).toHaveReturnedWith(originalMetadata);
      });

      it('should work with different GET request variations', () => {
        const requestVariations = [
          { method: 'GET', headers: { 'user-agent': 'test-agent' } },
          { method: 'GET', query: { format: 'json' } },
          { method: 'GET', params: { version: 'v1' } },
          { method: 'GET', body: { test: 'data' } }
        ];

        requestVariations.forEach((reqModification, index) => {
          const modifiedReq = { ...mockReq, ...reqModification };
          const result = authServerEndpoint.getAuthorizationServerMetadata(
            modifiedReq as Request, 
            mockRes as Response
          );

          expect(result).toBe(mockRes);
          expect(mockRes.json).toHaveBeenCalledWith(mockMetadata);
          
          // Clear mocks for next iteration
          vi.clearAllMocks();
          vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);
        });
      });
    });
  });
});