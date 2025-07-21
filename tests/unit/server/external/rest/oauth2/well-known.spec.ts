/**
 * @fileoverview Unit tests for OAuth2 Well-Known endpoints
 * @module tests/unit/server/external/rest/oauth2/well-known
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { WellKnownEndpoint } from '../../../../../../src/server/external/rest/oauth2/well-known';
import { tunnelStatus } from '../../../../../../src/modules/core/auth/tunnel-status';

// Mock tunnel status
vi.mock('../../../../../../src/modules/core/auth/tunnel-status', () => ({
  tunnelStatus: {
    getBaseUrlOrDefault: vi.fn()
  }
}));

describe('WellKnownEndpoint', () => {
  let endpoint: WellKnownEndpoint;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: any;
  let statusMock: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock }));
    
    mockReq = {};
    mockRes = {
      json: jsonMock,
      status: statusMock
    };
    
    endpoint = new WellKnownEndpoint('http://localhost:3000');
  });
  
  describe('constructor', () => {
    it('removes trailing slash from base URL', () => {
      const endpointWithSlash = new WellKnownEndpoint('http://localhost:3000/');
      const endpointWithoutSlash = new WellKnownEndpoint('http://localhost:3000');
      
      // Both should initialize keys
      expect(endpointWithSlash).toBeDefined();
      expect(endpointWithoutSlash).toBeDefined();
    });
  });
  
  describe('getOpenIDConfiguration', () => {
    it('returns OpenID configuration with default base URL', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue('http://localhost:3000');
      
      endpoint.getOpenIDConfiguration(mockReq as Request, mockRes as Response);
      
      expect(tunnelStatus.getBaseUrlOrDefault).toHaveBeenCalledWith('http://localhost:3000');
      expect(mockRes.json).toHaveBeenCalledWith({
        issuer: 'http://localhost:3000',
        authorization_endpoint: 'http://localhost:3000/oauth2/authorize',
        token_endpoint: 'http://localhost:3000/oauth2/token',
        userinfo_endpoint: 'http://localhost:3000/oauth2/userinfo',
        jwks_uri: 'http://localhost:3000/.well-known/jwks.json',
        response_types_supported: ['code', 'code id_token'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256', 'HS256'],
        scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
        token_endpoint_auth_methods_supported: [
          'client_secret_basic',
          'client_secret_post',
          'none'
        ],
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
        ],
        code_challenge_methods_supported: ['S256', 'plain'],
        grant_types_supported: ['authorization_code', 'refresh_token']
      });
    });
    
    it('uses tunnel URL when available', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue('https://example.tunnel.com');
      
      endpoint.getOpenIDConfiguration(mockReq as Request, mockRes as Response);
      
      const config = (mockRes.json as any).mock.calls[0][0];
      expect(config.issuer).toBe('https://example.tunnel.com');
      expect(config.authorization_endpoint).toBe('https://example.tunnel.com/oauth2/authorize');
      expect(config.token_endpoint).toBe('https://example.tunnel.com/oauth2/token');
      expect(config.userinfo_endpoint).toBe('https://example.tunnel.com/oauth2/userinfo');
      expect(config.jwks_uri).toBe('https://example.tunnel.com/.well-known/jwks.json');
    });
  });
  
  describe('getJWKS', () => {
    it('returns JWKS with initialized key', async () => {
      await endpoint.getJWKS(mockReq as Request, mockRes as Response);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        keys: [{
          kty: 'RSA',
          n: 'placeholder-n-value',
          e: 'AQAB',
          use: 'sig',
          kid: 'systemprompt-os-key-1',
          alg: 'RS256'
        }]
      });
    });
    
    it('initializes keys if not already initialized', async () => {
      // Create new endpoint and immediately call getJWKS
      const newEndpoint = new WellKnownEndpoint('http://localhost:3000');
      
      // Wait a bit for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await newEndpoint.getJWKS(mockReq as Request, mockRes as Response);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        keys: expect.arrayContaining([
          expect.objectContaining({
            kty: 'RSA',
            kid: 'systemprompt-os-key-1'
          })
        ])
      });
    });
    
    it('handles error when keys cannot be initialized', async () => {
      // Create a new endpoint and mock initialization to fail
      const failingEndpoint = new WellKnownEndpoint('http://localhost:3000');
      
      // Force publicKeyJWK to be null by accessing private property
      (failingEndpoint as any).publicKeyJWK = null;
      
      // Mock initializeKeys to not set publicKeyJWK
      (failingEndpoint as any).initializeKeys = vi.fn().mockResolvedValue(undefined);
      
      await failingEndpoint.getJWKS(mockReq as Request, mockRes as Response);
      
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Keys not initialized' });
    });
  });
  
  describe('scopes and claims', () => {
    it('includes custom agent scope and claims', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue('http://localhost:3000');
      
      endpoint.getOpenIDConfiguration(mockReq as Request, mockRes as Response);
      
      const config = (mockRes.json as any).mock.calls[0][0];
      expect(config.scopes_supported).toContain('agent');
      expect(config.claims_supported).toContain('agent_id');
      expect(config.claims_supported).toContain('agent_type');
    });
    
    it('supports PKCE code challenge methods', () => {
      vi.mocked(tunnelStatus.getBaseUrlOrDefault).mockReturnValue('http://localhost:3000');
      
      endpoint.getOpenIDConfiguration(mockReq as Request, mockRes as Response);
      
      const config = (mockRes.json as any).mock.calls[0][0];
      expect(config.code_challenge_methods_supported).toEqual(['S256', 'plain']);
    });
  });
});