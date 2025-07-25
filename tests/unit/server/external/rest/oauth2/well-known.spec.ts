/**
 * @fileoverview Unit tests for OAuth2 Well-Known endpoints
 * @module tests/unit/server/external/rest/oauth2/well-known
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { WellKnownEndpoint, type OpenIDConfiguration } from '@/server/external/rest/oauth2/well-known';

// Mock the singleton import first
vi.mock('@/modules/core/auth/singleton', () => ({
  getAuthModule: vi.fn()
}));

// Import the mock after setting up the mock
import { getAuthModule } from '@/modules/core/auth/singleton';

// Mock the auth module and dependencies
const mockOAuth2ConfigService = {
  getOpenIDConfiguration: vi.fn()
};

const mockAuthModule = {
  exports: {
    oauth2ConfigService: vi.fn(() => mockOAuth2ConfigService)
  }
};

const mockGetAuthModule = vi.mocked(getAuthModule);

describe('WellKnownEndpoint', () => {
  let endpoint: WellKnownEndpoint;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup the auth module mock to return our mock objects
    mockGetAuthModule.mockReturnValue(mockAuthModule as any);
    
    // Setup response mocks
    jsonSpy = vi.fn().mockReturnThis();
    statusSpy = vi.fn().mockReturnThis();
    
    mockRequest = {
      method: 'GET',
      url: '/.well-known/openid_configuration',
      headers: {}
    };
    
    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
      setHeader: vi.fn(),
      end: vi.fn()
    };
    
    endpoint = new WellKnownEndpoint();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with default publicKeyJWK as null', () => {
      const newEndpoint = new WellKnownEndpoint();
      expect(newEndpoint).toBeInstanceOf(WellKnownEndpoint);
      // Access private property for testing
      expect((newEndpoint as any).publicKeyJWK).toBeNull();
    });

    it('should create multiple instances independently', () => {
      const endpoint1 = new WellKnownEndpoint();
      const endpoint2 = new WellKnownEndpoint();
      
      expect(endpoint1).toBeInstanceOf(WellKnownEndpoint);
      expect(endpoint2).toBeInstanceOf(WellKnownEndpoint);
      expect(endpoint1).not.toBe(endpoint2);
    });
  });

  describe('getOpenIDConfiguration', () => {
    it('should return OpenID configuration from oauth2ConfigService', () => {
      const mockConfig: OpenIDConfiguration = {
        issuer: 'https://example.com',
        authorization_endpoint: 'https://example.com/oauth2/authorize',
        token_endpoint: 'https://example.com/oauth2/token',
        userinfo_endpoint: 'https://example.com/oauth2/userinfo',
        jwks_uri: 'https://example.com/.well-known/jwks.json',
        response_types_supported: ['code', 'code id_token'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256', 'HS256'],
        scopes_supported: ['openid', 'profile', 'email'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
        claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat'],
        code_challenge_methods_supported: ['S256', 'plain'],
        grant_types_supported: ['authorization_code', 'refresh_token']
      };

      mockOAuth2ConfigService.getOpenIDConfiguration.mockReturnValue(mockConfig);

      const result = endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);

      expect(mockGetAuthModule).toHaveBeenCalledTimes(1);
      expect(mockAuthModule.exports.oauth2ConfigService).toHaveBeenCalledTimes(1);
      expect(mockOAuth2ConfigService.getOpenIDConfiguration).toHaveBeenCalledTimes(1);
      expect(jsonSpy).toHaveBeenCalledWith(mockConfig);
      expect(result).toBe(mockResponse);
    });

    it('should handle when authModule throws an error', () => {
      mockGetAuthModule.mockImplementation(() => {
        throw new Error('Auth module not loaded');
      });

      expect(() => {
        endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);
      }).toThrow('Auth module not loaded');

      expect(mockGetAuthModule).toHaveBeenCalledTimes(1);
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should handle when oauth2ConfigService throws an error', () => {
      mockAuthModule.exports.oauth2ConfigService.mockImplementation(() => {
        throw new Error('OAuth2 config service error');
      });

      expect(() => {
        endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);
      }).toThrow('OAuth2 config service error');

      expect(mockGetAuthModule).toHaveBeenCalledTimes(1);
      expect(mockAuthModule.exports.oauth2ConfigService).toHaveBeenCalledTimes(1);
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should handle when getOpenIDConfiguration throws an error', () => {
      mockOAuth2ConfigService.getOpenIDConfiguration.mockImplementation(() => {
        throw new Error('Configuration retrieval error');
      });

      expect(() => {
        endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);
      }).toThrow('Configuration retrieval error');

      expect(mockGetAuthModule).toHaveBeenCalledTimes(1);
      expect(mockAuthModule.exports.oauth2ConfigService).toHaveBeenCalledTimes(1);
      expect(mockOAuth2ConfigService.getOpenIDConfiguration).toHaveBeenCalledTimes(1);
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should work with different request objects', () => {
      const mockConfig: OpenIDConfiguration = {
        issuer: 'https://test.com',
        authorization_endpoint: 'https://test.com/oauth2/authorize',
        token_endpoint: 'https://test.com/oauth2/token',
        userinfo_endpoint: 'https://test.com/oauth2/userinfo',
        jwks_uri: 'https://test.com/.well-known/jwks.json',
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        claims_supported: ['sub'],
        code_challenge_methods_supported: ['S256'],
        grant_types_supported: ['authorization_code']
      };

      mockOAuth2ConfigService.getOpenIDConfiguration.mockReturnValue(mockConfig);

      const differentRequest = {
        method: 'GET',
        url: '/.well-known/openid_configuration',
        headers: { 'user-agent': 'test-agent' },
        query: {},
        params: {}
      } as Request;

      const result = endpoint.getOpenIDConfiguration(differentRequest, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith(mockConfig);
      expect(result).toBe(mockResponse);
    });

    it('should handle null/undefined config gracefully', () => {
      mockOAuth2ConfigService.getOpenIDConfiguration.mockReturnValue(null);

      const result = endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith(null);
      expect(result).toBe(mockResponse);
    });
  });

  describe('getJWKS', () => {
    it('should return 500 error when publicKeyJWK is null', async () => {
      // Ensure publicKeyJWK is null (default state)
      expect((endpoint as any).publicKeyJWK).toBeNull();

      const result = await endpoint.getJWKS(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Keys not initialized' });
      expect(result).toBe(mockResponse);
    });

    it('should return JWKS when publicKeyJWK is set', async () => {
      const mockJWK = {
        kty: 'RSA',
        n: 'mock-n-value',
        e: 'AQAB',
        use: 'sig',
        kid: 'test-key-id',
        alg: 'RS256'
      };

      // Set the private property for testing
      (endpoint as any).publicKeyJWK = mockJWK;

      const result = await endpoint.getJWKS(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        keys: [mockJWK]
      });
      expect(statusSpy).not.toHaveBeenCalled();
      expect(result).toBe(mockResponse);
    });

    it('should handle complex JWK objects', async () => {
      const complexJWK = {
        kty: 'RSA',
        n: 'very-long-n-value-with-base64-encoding',
        e: 'AQAB',
        use: 'sig',
        kid: 'complex-key-id-123',
        alg: 'RS256',
        x5c: ['cert1', 'cert2'],
        x5t: 'thumbprint',
        'x5t#S256': 'sha256-thumbprint'
      };

      (endpoint as any).publicKeyJWK = complexJWK;

      const result = await endpoint.getJWKS(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        keys: [complexJWK]
      });
      expect(result).toBe(mockResponse);
    });

    it('should handle when publicKeyJWK is an empty object', async () => {
      (endpoint as any).publicKeyJWK = {};

      const result = await endpoint.getJWKS(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        keys: [{}]
      });
      expect(result).toBe(mockResponse);
    });

    it('should handle when publicKeyJWK is undefined', async () => {
      (endpoint as any).publicKeyJWK = undefined;

      const result = await endpoint.getJWKS(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Keys not initialized' });
      expect(result).toBe(mockResponse);
    });

    it('should handle when publicKeyJWK is false', async () => {
      (endpoint as any).publicKeyJWK = false;

      const result = await endpoint.getJWKS(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Keys not initialized' });
      expect(result).toBe(mockResponse);
    });

    it('should handle when publicKeyJWK is 0', async () => {
      (endpoint as any).publicKeyJWK = 0;

      const result = await endpoint.getJWKS(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Keys not initialized' });
      expect(result).toBe(mockResponse);
    });

    it('should handle when publicKeyJWK is empty string', async () => {
      (endpoint as any).publicKeyJWK = '';

      const result = await endpoint.getJWKS(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Keys not initialized' });
      expect(result).toBe(mockResponse);
    });

    it('should work with different request objects', async () => {
      const mockJWK = { kty: 'RSA', kid: 'test' };
      (endpoint as any).publicKeyJWK = mockJWK;

      const differentRequest = {
        method: 'GET',
        url: '/.well-known/jwks.json',
        headers: { 'accept': 'application/json' }
      } as Request;

      const result = await endpoint.getJWKS(differentRequest, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        keys: [mockJWK]
      });
      expect(result).toBe(mockResponse);
    });

    it('should return a Promise that resolves to Response', async () => {
      (endpoint as any).publicKeyJWK = { kty: 'RSA' };

      const promise = endpoint.getJWKS(mockRequest as Request, mockResponse as Response);
      
      expect(promise).toBeInstanceOf(Promise);
      
      const result = await promise;
      expect(result).toBe(mockResponse);
    });

    it('should return a Promise that resolves to void when keys not initialized', async () => {
      const promise = endpoint.getJWKS(mockRequest as Request, mockResponse as Response);
      
      expect(promise).toBeInstanceOf(Promise);
      
      const result = await promise;
      expect(result).toBe(mockResponse);
    });
  });

  describe('OpenIDConfiguration interface', () => {
    it('should accept valid OpenIDConfiguration objects', () => {
      const validConfig: OpenIDConfiguration = {
        issuer: 'https://example.com',
        authorization_endpoint: 'https://example.com/oauth2/authorize',
        token_endpoint: 'https://example.com/oauth2/token',
        userinfo_endpoint: 'https://example.com/oauth2/userinfo',
        jwks_uri: 'https://example.com/.well-known/jwks.json',
        response_types_supported: ['code', 'code id_token', 'token'],
        subject_types_supported: ['public', 'pairwise'],
        id_token_signing_alg_values_supported: ['RS256', 'HS256', 'ES256'],
        scopes_supported: ['openid', 'profile', 'email', 'phone', 'address'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
        claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'name', 'email'],
        code_challenge_methods_supported: ['S256', 'plain'],
        grant_types_supported: ['authorization_code', 'refresh_token', 'implicit']
      };

      mockOAuth2ConfigService.getOpenIDConfiguration.mockReturnValue(validConfig);

      endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith(validConfig);
    });

    it('should handle minimal OpenIDConfiguration objects', () => {
      const minimalConfig: OpenIDConfiguration = {
        issuer: 'https://minimal.com',
        authorization_endpoint: 'https://minimal.com/authorize',
        token_endpoint: 'https://minimal.com/token',
        userinfo_endpoint: 'https://minimal.com/userinfo',
        jwks_uri: 'https://minimal.com/jwks',
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        claims_supported: ['sub'],
        code_challenge_methods_supported: ['S256'],
        grant_types_supported: ['authorization_code']
      };

      mockOAuth2ConfigService.getOpenIDConfiguration.mockReturnValue(minimalConfig);

      endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith(minimalConfig);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle when response.json throws an error', () => {
      const mockConfig: OpenIDConfiguration = {
        issuer: 'https://example.com',
        authorization_endpoint: 'https://example.com/oauth2/authorize',
        token_endpoint: 'https://example.com/oauth2/token',
        userinfo_endpoint: 'https://example.com/oauth2/userinfo',
        jwks_uri: 'https://example.com/.well-known/jwks.json',
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        claims_supported: ['sub'],
        code_challenge_methods_supported: ['S256'],
        grant_types_supported: ['authorization_code']
      };

      mockOAuth2ConfigService.getOpenIDConfiguration.mockReturnValue(mockConfig);
      jsonSpy.mockImplementation(() => {
        throw new Error('JSON serialization error');
      });

      expect(() => {
        endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);
      }).toThrow('JSON serialization error');
    });

    it('should handle when response.status throws an error in getJWKS', async () => {
      statusSpy.mockImplementation(() => {
        throw new Error('Status setting error');
      });

      await expect(async () => {
        await endpoint.getJWKS(mockRequest as Request, mockResponse as Response);
      }).rejects.toThrow('Status setting error');
    });

    it('should handle concurrent calls to getJWKS', async () => {
      const mockJWK = { kty: 'RSA', kid: 'concurrent-test' };
      (endpoint as any).publicKeyJWK = mockJWK;

      const promise1 = endpoint.getJWKS(mockRequest as Request, mockResponse as Response);
      const promise2 = endpoint.getJWKS(mockRequest as Request, mockResponse as Response);
      const promise3 = endpoint.getJWKS(mockRequest as Request, mockResponse as Response);

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBe(mockResponse);
      });
      expect(jsonSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent calls to getOpenIDConfiguration', () => {
      const mockConfig: OpenIDConfiguration = {
        issuer: 'https://concurrent.com',
        authorization_endpoint: 'https://concurrent.com/authorize',
        token_endpoint: 'https://concurrent.com/token',
        userinfo_endpoint: 'https://concurrent.com/userinfo',
        jwks_uri: 'https://concurrent.com/jwks',
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        claims_supported: ['sub'],
        code_challenge_methods_supported: ['S256'],
        grant_types_supported: ['authorization_code']
      };

      mockOAuth2ConfigService.getOpenIDConfiguration.mockReturnValue(mockConfig);

      const result1 = endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);
      const result2 = endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);
      const result3 = endpoint.getOpenIDConfiguration(mockRequest as Request, mockResponse as Response);

      expect([result1, result2, result3]).toEqual([mockResponse, mockResponse, mockResponse]);
      expect(jsonSpy).toHaveBeenCalledTimes(3);
      expect(mockOAuth2ConfigService.getOpenIDConfiguration).toHaveBeenCalledTimes(3);
    });
  });

  describe('Property access and method binding', () => {
    it('should maintain method binding when extracted', () => {
      const mockConfig: OpenIDConfiguration = {
        issuer: 'https://binding.com',
        authorization_endpoint: 'https://binding.com/authorize',
        token_endpoint: 'https://binding.com/token',
        userinfo_endpoint: 'https://binding.com/userinfo',
        jwks_uri: 'https://binding.com/jwks',
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        claims_supported: ['sub'],
        code_challenge_methods_supported: ['S256'],
        grant_types_supported: ['authorization_code']
      };

      mockOAuth2ConfigService.getOpenIDConfiguration.mockReturnValue(mockConfig);

      const extractedMethod = endpoint.getOpenIDConfiguration;
      const result = extractedMethod(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith(mockConfig);
      expect(result).toBe(mockResponse);
    });

    it('should maintain method binding for getJWKS when extracted', async () => {
      const mockJWK = { kty: 'RSA', kid: 'binding-test' };
      (endpoint as any).publicKeyJWK = mockJWK;

      const extractedMethod = endpoint.getJWKS;
      const result = await extractedMethod(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        keys: [mockJWK]
      });
      expect(result).toBe(mockResponse);
    });

    it('should handle this context correctly in arrow functions', () => {
      // Test that the arrow function maintains proper this binding
      const mockConfig: OpenIDConfiguration = {
        issuer: 'https://context.com',
        authorization_endpoint: 'https://context.com/authorize',
        token_endpoint: 'https://context.com/token',
        userinfo_endpoint: 'https://context.com/userinfo',
        jwks_uri: 'https://context.com/jwks',
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        claims_supported: ['sub'],
        code_challenge_methods_supported: ['S256'],
        grant_types_supported: ['authorization_code']
      };

      mockOAuth2ConfigService.getOpenIDConfiguration.mockReturnValue(mockConfig);

      const method = endpoint.getOpenIDConfiguration.bind(endpoint);
      const result = method(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith(mockConfig);
      expect(result).toBe(mockResponse);
    });
  });
});