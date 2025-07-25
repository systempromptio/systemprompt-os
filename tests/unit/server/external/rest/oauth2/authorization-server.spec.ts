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

// Mock the auth module singleton
vi.mock('../../../../../../src/modules/core/auth/singleton', () => ({
  getAuthModule: vi.fn()
}));

// Import after mocking
import { getAuthModule } from '../../../../../../src/modules/core/auth/singleton';

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
    
    // Create fresh instance for each test
    authServerEndpoint = new AuthorizationServerEndpoint();
    
    // Setup mock request
    mockReq = {
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
    it('should successfully return authorization server metadata', () => {
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

      authServerEndpoint.getAuthorizationServerMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(alternativeMetadata);
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

      authServerEndpoint.getAuthorizationServerMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(minimalMetadata);
    });

    it('should handle metadata with all optional fields populated', () => {
      const extendedMetadata: IOAuth2ServerMetadataInternal = {
        ...mockMetadata,
        token_endpoint_auth_signing_alg_values_supported: ['RS256', 'HS256'],
        ui_locales_supported: ['en', 'es', 'fr'],
        op_policy_uri: 'https://test.example.com/policy',
        op_tos_uri: 'https://test.example.com/tos',
        revocation_endpoint: 'https://test.example.com/oauth2/revoke',
        revocation_endpoint_auth_methods_supported: ['client_secret_basic'],
        introspection_endpoint: 'https://test.example.com/oauth2/introspect',
        introspection_endpoint_auth_methods_supported: ['client_secret_basic'],
        acr_values_supported: ['1', '2']
      };

      mockOAuth2ConfigService.getAuthorizationServerMetadata.mockReturnValue(extendedMetadata);

      authServerEndpoint.getAuthorizationServerMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(extendedMetadata);
    });

    it('should propagate errors from auth module not being loaded', () => {
      const authError = new Error('Auth module not loaded');
      vi.mocked(getAuthModule).mockImplementation(() => {
        throw authError;
      });

      expect(() => {
        authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );
      }).toThrow('Auth module not loaded');

      // Verify response was not called when error occurs
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should propagate errors from oauth2ConfigService being undefined', () => {
      mockAuthModule.exports.oauth2ConfigService.mockReturnValue(undefined);

      expect(() => {
        authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );
      }).toThrow();
    });

    it('should propagate errors from oauth2ConfigService method failure', () => {
      const serviceError = new Error('Configuration service failed');
      mockOAuth2ConfigService.getAuthorizationServerMetadata.mockImplementation(() => {
        throw serviceError;
      });

      expect(() => {
        authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );
      }).toThrow('Configuration service failed');

      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should handle response.json method throwing an error', () => {
      const responseError = new Error('Response serialization failed');
      vi.mocked(mockRes.json).mockImplementation(() => {
        throw responseError;
      });

      expect(() => {
        authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );
      }).toThrow('Response serialization failed');

      // Verify the service was still called before the response error
      expect(mockOAuth2ConfigService.getAuthorizationServerMetadata).toHaveBeenCalledTimes(1);
    });

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

    it('should handle empty arrays in metadata', () => {
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

      authServerEndpoint.getAuthorizationServerMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(metadataWithEmptyArrays);
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

    it('should work with different request types', () => {
      const requestVariations = [
        { headers: { 'user-agent': 'test-agent' } },
        { query: { format: 'json' } },
        { params: { version: 'v1' } },
        { body: { test: 'data' } }
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

  describe('error boundary coverage', () => {
    it('should handle auth module exports being null', () => {
      mockAuthModule.exports = null;
      vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);

      expect(() => {
        authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );
      }).toThrow();
    });

    it('should handle auth module exports being undefined', () => {
      mockAuthModule.exports = undefined;
      vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);

      expect(() => {
        authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );
      }).toThrow();
    });

    it('should handle oauth2ConfigService method being undefined', () => {
      mockAuthModule.exports.oauth2ConfigService = undefined;
      vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);

      expect(() => {
        authServerEndpoint.getAuthorizationServerMetadata(
          mockReq as Request, 
          mockRes as Response
        );
      }).toThrow();
    });
  });
});