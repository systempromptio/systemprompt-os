/**
 * Unit tests for OAuth2 Authorization Server Metadata endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthorizationServerEndpoint } from '../../../../../../src/server/external/rest/oauth2/authorization-server';
import { tunnelStatus } from '../../../../../../src/modules/core/auth/tunnel-status';
import type { Request, Response } from 'express';

// Mock dependencies
vi.mock('../../../../../../src/modules/core/auth/tunnel-status', () => ({
  tunnelStatus: {
    getBaseUrlOrDefault: vi.fn()
  }
}));

describe('AuthorizationServerEndpoint', () => {
  let authServerEndpoint: AuthorizationServerEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  const baseUrl = 'https://example.com';

  beforeEach(() => {
    vi.clearAllMocks();
    
    authServerEndpoint = new AuthorizationServerEndpoint(baseUrl);
    
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
      const endpointWithSlash = new AuthorizationServerEndpoint('https://example.com/');
      // Use the getter to check the baseUrl was normalized
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue('https://example.com');
      
      endpointWithSlash.getAuthorizationServerMetadata(mockReq as Request, mockRes as Response);
      
      expect(vi.mocked(tunnelStatus.getBaseUrlOrDefault)).toHaveBeenCalledWith('https://example.com');
    });

    it('should keep baseUrl without trailing slash unchanged', () => {
      const endpoint = new AuthorizationServerEndpoint('https://example.com');
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue('https://example.com');
      
      endpoint.getAuthorizationServerMetadata(mockReq as Request, mockRes as Response);
      
      expect(vi.mocked(tunnelStatus.getBaseUrlOrDefault)).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('getAuthorizationServerMetadata', () => {
    it('should return complete authorization server metadata', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(baseUrl);

      authServerEndpoint.getAuthorizationServerMetadata(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        issuer: 'https://example.com',
        authorization_endpoint: 'https://example.com/oauth2/authorize',
        token_endpoint: 'https://example.com/oauth2/token',
        jwks_uri: 'https://example.com/.well-known/jwks.json',
        registration_endpoint: 'https://example.com/oauth2/register',
        scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
        response_types_supported: ['code', 'code id_token'],
        response_modes_supported: ['query', 'fragment'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: [
          'client_secret_basic',
          'client_secret_post',
          'none'
        ],
        service_documentation: 'https://example.com/docs/api',
        code_challenge_methods_supported: ['S256', 'plain'],
        userinfo_endpoint: 'https://example.com/oauth2/userinfo',
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
      });
    });

    it('should use tunnel URL when available', () => {
      const tunnelUrl = 'https://tunnel.example.com';
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(tunnelUrl);

      authServerEndpoint.getAuthorizationServerMetadata(mockReq as Request, mockRes as Response);

      expect(vi.mocked(tunnelStatus.getBaseUrlOrDefault)).toHaveBeenCalledWith(baseUrl);
      
      const metadata = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(metadata.issuer).toBe(tunnelUrl);
      expect(metadata.authorization_endpoint).toBe(`${tunnelUrl}/oauth2/authorize`);
      expect(metadata.token_endpoint).toBe(`${tunnelUrl}/oauth2/token`);
      expect(metadata.jwks_uri).toBe(`${tunnelUrl}/.well-known/jwks.json`);
      expect(metadata.registration_endpoint).toBe(`${tunnelUrl}/oauth2/register`);
      expect(metadata.service_documentation).toBe(`${tunnelUrl}/docs/api`);
      expect(metadata.userinfo_endpoint).toBe(`${tunnelUrl}/oauth2/userinfo`);
    });

    it('should return Response object', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(baseUrl);
      vi.mocked(mockRes.json).mockReturnValue(mockRes as Response);

      const result = authServerEndpoint.getAuthorizationServerMetadata(
        mockReq as Request, 
        mockRes as Response
      );

      expect(result).toBe(mockRes);
    });

    it('should include all required OAuth 2.0 metadata fields', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(baseUrl);

      authServerEndpoint.getAuthorizationServerMetadata(mockReq as Request, mockRes as Response);

      const metadata = vi.mocked(mockRes.json).mock.calls[0][0];
      
      // Required fields per RFC 8414
      expect(metadata).toHaveProperty('issuer');
      expect(metadata).toHaveProperty('authorization_endpoint');
      expect(metadata).toHaveProperty('token_endpoint');
      expect(metadata).toHaveProperty('jwks_uri');
      expect(metadata).toHaveProperty('response_types_supported');
      
      // Validate array fields are non-empty
      expect(metadata.response_types_supported).toHaveLength(2);
      expect(metadata.scopes_supported).toHaveLength(5);
      expect(metadata.grant_types_supported).toHaveLength(2);
    });

    it('should include OpenID Connect specific fields', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(baseUrl);

      authServerEndpoint.getAuthorizationServerMetadata(mockReq as Request, mockRes as Response);

      const metadata = vi.mocked(mockRes.json).mock.calls[0][0];
      
      // OpenID Connect specific fields
      expect(metadata).toHaveProperty('userinfo_endpoint');
      expect(metadata).toHaveProperty('subject_types_supported');
      expect(metadata).toHaveProperty('id_token_signing_alg_values_supported');
      expect(metadata).toHaveProperty('claims_supported');
      
      // Validate OpenID specific values
      expect(metadata.scopes_supported).toContain('openid');
      expect(metadata.response_types_supported).toContain('code id_token');
      expect(metadata.claims_supported).toContain('email');
      expect(metadata.claims_supported).toContain('email_verified');
    });

    it('should include PKCE support', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue(baseUrl);

      authServerEndpoint.getAuthorizationServerMetadata(mockReq as Request, mockRes as Response);

      const metadata = vi.mocked(mockRes.json).mock.calls[0][0];
      
      expect(metadata.code_challenge_methods_supported).toEqual(['S256', 'plain']);
    });
  });
});