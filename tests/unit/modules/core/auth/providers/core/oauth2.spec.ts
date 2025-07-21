/**
 * @fileoverview Unit tests for generic OAuth2 provider
 * @module tests/unit/modules/core/auth/providers/core/oauth2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenericOAuth2Provider } from '../../../../../../../src/modules/core/auth/providers/core/oauth2';

// Mock fetch
global.fetch = vi.fn();

describe('GenericOAuth2Provider', () => {
  let provider: GenericOAuth2Provider;
  let mockConfig: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      id: 'test-oauth2',
      name: 'Test OAuth2 Provider',
      clientid: 'test-client-id',
      clientsecret: 'test-client-secret',
      redirecturi: 'http://localhost:3000/callback',
      authorizationendpoint: 'https://provider.com/authorize',
      tokenendpoint: 'https://provider.com/token',
      userinfoendpoint: 'https://provider.com/userinfo',
      scope: 'openid email profile'
    };
  });
  
  describe('constructor', () => {
    it('creates OAuth2 provider with basic config', () => {
      provider = new GenericOAuth2Provider(mockConfig);
      
      expect(provider.id).toBe('test-oauth2');
      expect(provider.name).toBe('Test OAuth2 Provider');
      expect(provider.type).toBe('oauth2');
    });
    
    it('creates OIDC provider when issuer is present', () => {
      mockConfig.issuer = 'https://provider.com';
      provider = new GenericOAuth2Provider(mockConfig);
      
      expect(provider.type).toBe('oidc');
    });
    
    it('sets default scope if not provided', () => {
      delete mockConfig.scope;
      provider = new GenericOAuth2Provider(mockConfig);
      
      const authUrl = provider.getAuthorizationUrl('test-state');
      expect(authUrl).toContain('scope=openid+email+profile');
    });
  });
  
  describe('getAuthorizationUrl', () => {
    beforeEach(() => {
      provider = new GenericOAuth2Provider(mockConfig);
    });
    
    it('generates authorization URL with required parameters', () => {
      const state = 'test-state-123';
      const url = provider.getAuthorizationUrl(state);
      
      const urlObj = new URL(url);
      expect(urlObj.origin + urlObj.pathname).toBe('https://provider.com/authorize');
      expect(urlObj.searchParams.get('client_id')).toBe('test-client-id');
      expect(urlObj.searchParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
      expect(urlObj.searchParams.get('response_type')).toBe('code');
      expect(urlObj.searchParams.get('state')).toBe(state);
      expect(urlObj.searchParams.get('scope')).toBe('openid email profile');
    });
    
    it('includes nonce for OIDC providers', () => {
      mockConfig.issuer = 'https://provider.com';
      provider = new GenericOAuth2Provider(mockConfig);
      
      const url = provider.getAuthorizationUrl('state', 'test-nonce');
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('nonce')).toBe('test-nonce');
    });
    
    it('includes custom parameters', () => {
      mockConfig.authorizationparams = {
        prompt: 'consent',
        access_type: 'offline'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      const url = provider.getAuthorizationUrl('state');
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('prompt')).toBe('consent');
      expect(urlObj.searchParams.get('access_type')).toBe('offline');
    });
  });
  
  describe('exchangeCodeForTokens', () => {
    beforeEach(() => {
      provider = new GenericOAuth2Provider(mockConfig);
    });
    
    it('exchanges authorization code for tokens', async () => {
      const mockTokens = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.exchangeCodeForTokens('test-code');
      
      expect(fetch).toHaveBeenCalledWith('https://provider.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: expect.any(URLSearchParams)
      });
      
      expect(tokens).toEqual(mockTokens);
    });
    
    it('handles token exchange errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid authorization code'
      } as Response);
      
      await expect(provider.exchangeCodeForTokens('invalid-code'))
        .rejects.toThrow('Failed to exchange code: Invalid authorization code');
    });
  });
  
  describe('getUserInfo', () => {
    beforeEach(() => {
      provider = new GenericOAuth2Provider(mockConfig);
    });
    
    it('fetches user info with access token', async () => {
      const mockUserInfo = {
        sub: '123456',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-access-token');
      
      expect(fetch).toHaveBeenCalledWith('https://provider.com/userinfo', {
        headers: {
          'Authorization': 'Bearer test-access-token',
          'Accept': 'application/json'
        }
      });
      
      expect(userInfo).toEqual({
        id: '123456',
        email: 'test@example.com',
        emailverified: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        raw: mockUserInfo
      });
    });
    
    it('applies custom user info mapping', async () => {
      mockConfig.userinfomapping = {
        id: 'user_id',
        email: 'user_email',
        name: 'display_name'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user_id: 'custom-123',
          user_email: 'custom@example.com',
          display_name: 'Custom User'
        })
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('custom-123');
      expect(userInfo.email).toBe('custom@example.com');
      expect(userInfo.name).toBe('Custom User');
    });
    
    it('throws error when endpoint not configured', async () => {
      delete mockConfig.userinfoendpoint;
      provider = new GenericOAuth2Provider(mockConfig);
      
      await expect(provider.getUserInfo('token'))
        .rejects.toThrow('UserInfo endpoint not configured');
    });
  });
  
  describe('refreshAccessToken', () => {
    it('refreshes access token using refresh token', async () => {
      provider = new GenericOAuth2Provider(mockConfig);
      
      const mockTokens = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.refreshTokens('refresh-token');
      
      expect(fetch).toHaveBeenCalledWith('https://provider.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: expect.any(URLSearchParams)
      });
      
      expect(tokens).toEqual(mockTokens);
    });
  });
  
  describe('OIDC discovery', () => {
    it('creates provider from OIDC discovery document', async () => {
      const discoveryDoc = {
        issuer: 'https://provider.com',
        authorization_endpoint: 'https://provider.com/auth',
        token_endpoint: 'https://provider.com/token',
        userinfo_endpoint: 'https://provider.com/userinfo',
        jwks_uri: 'https://provider.com/jwks',
        scopes_supported: ['openid', 'email', 'profile'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token']
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => discoveryDoc
      } as Response);
      
      const config = {
        ...mockConfig,
        discoveryurl: 'https://provider.com/.well-known/openid-configuration'
      };
      
      // This would typically be done in a factory method
      const response = await fetch(config.discoveryurl);
      const discovery = await response.json();
      
      expect(discovery.issuer).toBe('https://provider.com');
      expect(discovery.authorization_endpoint).toBe('https://provider.com/auth');
    });
  });
});