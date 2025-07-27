/**
 * @fileoverview Unit tests for generic OAuth2 provider
 * @module tests/unit/modules/core/auth/providers/core/oauth2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenericOAuth2Provider, discoverOidcConfiguration } from '../../../../../../../src/modules/core/auth/providers/core/oauth2.js';

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
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      authorizationEndpoint: 'https://provider.com/authorize',
      tokenEndpoint: 'https://provider.com/token',
      userinfoEndpoint: 'https://provider.com/userinfo',
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
    
    it('creates OAuth2 provider when issuer is null', () => {
      mockConfig.issuer = null;
      provider = new GenericOAuth2Provider(mockConfig);
      
      expect(provider.type).toBe('oauth2');
    });
    
    it('creates OAuth2 provider when issuer is undefined', () => {
      mockConfig.issuer = undefined;
      provider = new GenericOAuth2Provider(mockConfig);
      
      expect(provider.type).toBe('oauth2');
    });
    
    it('sets default scope if not provided', () => {
      delete mockConfig.scope;
      provider = new GenericOAuth2Provider(mockConfig);
      
      const authUrl = provider.getAuthorizationUrl('test-state');
      expect(authUrl).toContain('scope=email+profile');
    });
    
    it('sets default scope when scope is null', () => {
      mockConfig.scope = null;
      provider = new GenericOAuth2Provider(mockConfig);
      
      const authUrl = provider.getAuthorizationUrl('test-state');
      expect(authUrl).toContain('scope=email+profile');
    });
    
    it('sets default userinfoMapping when not provided', () => {
      delete mockConfig.userinfoMapping;
      provider = new GenericOAuth2Provider(mockConfig);
      
      // This will be tested through getUserInfo method
      expect(provider).toBeInstanceOf(GenericOAuth2Provider);
    });
    
    it('sets default userinfoMapping when null', () => {
      mockConfig.userinfoMapping = null;
      provider = new GenericOAuth2Provider(mockConfig);
      
      expect(provider).toBeInstanceOf(GenericOAuth2Provider);
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
    
    it('uses fallback scope when config scope is null', () => {
      mockConfig.scope = null;
      provider = new GenericOAuth2Provider(mockConfig);
      
      const url = provider.getAuthorizationUrl('state');
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('scope')).toBe('email profile');
    });
    
    it('includes nonce for OIDC providers', () => {
      mockConfig.issuer = 'https://provider.com';
      provider = new GenericOAuth2Provider(mockConfig);
      
      const url = provider.getAuthorizationUrl('state', 'test-nonce');
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('nonce')).toBe('test-nonce');
    });
    
    it('does not include nonce for OAuth2 providers even when provided', () => {
      // OAuth2 provider (no issuer)
      const url = provider.getAuthorizationUrl('state', 'test-nonce');
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('nonce')).toBeNull();
    });
    
    it('does not include nonce when nonce is null for OIDC providers', () => {
      mockConfig.issuer = 'https://provider.com';
      provider = new GenericOAuth2Provider(mockConfig);
      
      const url = provider.getAuthorizationUrl('state', null);
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('nonce')).toBeNull();
    });
    
    it('does not include nonce when nonce is undefined for OIDC providers', () => {
      mockConfig.issuer = 'https://provider.com';
      provider = new GenericOAuth2Provider(mockConfig);
      
      const url = provider.getAuthorizationUrl('state', undefined);
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('nonce')).toBeNull();
    });
    
    it('includes custom parameters', () => {
      mockConfig.authorizationParams = {
        prompt: 'consent',
        access_type: 'offline'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      const url = provider.getAuthorizationUrl('state');
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('prompt')).toBe('consent');
      expect(urlObj.searchParams.get('access_type')).toBe('offline');
    });
    
    it('handles custom parameters with number values', () => {
      mockConfig.authorizationParams = {
        max_age: 3600,
        ui_locales: 'en'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      const url = provider.getAuthorizationUrl('state');
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('max_age')).toBe('3600');
      expect(urlObj.searchParams.get('ui_locales')).toBe('en');
    });
    
    it('handles custom parameters with boolean values', () => {
      mockConfig.authorizationParams = {
        include_granted_scopes: true,
        approval_prompt: false
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      const url = provider.getAuthorizationUrl('state');
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('include_granted_scopes')).toBe('true');
      expect(urlObj.searchParams.get('approval_prompt')).toBe('false');
    });
    
    it('does not include custom parameters when authorizationParams is undefined', () => {
      delete mockConfig.authorizationParams;
      provider = new GenericOAuth2Provider(mockConfig);
      
      const url = provider.getAuthorizationUrl('state');
      const urlObj = new URL(url);
      // Should only have the standard OAuth2 parameters
      expect(urlObj.searchParams.has('prompt')).toBe(false);
      expect(urlObj.searchParams.has('access_type')).toBe(false);
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
      
      expect(tokens).toEqual({
        accessToken: 'test-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshToken: 'test-refresh-token'
      });
    });
    
    it('handles token response without optional fields', async () => {
      const mockTokens = {
        access_token: 'test-access-token',
        token_type: 'Bearer'
        // Missing expires_in, refresh_token, scope, id_token
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.exchangeCodeForTokens('test-code');
      
      expect(tokens).toEqual({
        accessToken: 'test-access-token',
        tokenType: 'Bearer'
        // Should not include undefined optional fields
      });
      expect(tokens.expiresIn).toBeUndefined();
      expect(tokens.refreshToken).toBeUndefined();
      expect(tokens.scope).toBeUndefined();
      expect(tokens.idToken).toBeUndefined();
    });
    
    it('includes scope when present in response', async () => {
      const mockTokens = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        scope: 'read write'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.exchangeCodeForTokens('test-code');
      
      expect(tokens.scope).toBe('read write');
    });
    
    it('includes id_token when present in response', async () => {
      const mockTokens = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.exchangeCodeForTokens('test-code');
      
      expect(tokens.idToken).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
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
    
    it('sends correct request body with all parameters', async () => {
      const mockTokens = {
        access_token: 'test-access-token',
        token_type: 'Bearer'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      await provider.exchangeCodeForTokens('auth-code-123');
      
      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const requestBody = fetchCall[1]?.body as URLSearchParams;
      
      expect(requestBody.get('grant_type')).toBe('authorization_code');
      expect(requestBody.get('code')).toBe('auth-code-123');
      expect(requestBody.get('redirect_uri')).toBe('http://localhost:3000/callback');
      expect(requestBody.get('client_id')).toBe('test-client-id');
      expect(requestBody.get('client_secret')).toBe('test-client-secret');
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
        emailVerified: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        raw: mockUserInfo
      });
    });
    
    it('applies custom user info mapping', async () => {
      mockConfig.userinfoMapping = {
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
    
    it('applies nested field mapping with dot notation', async () => {
      mockConfig.userinfoMapping = {
        id: 'user.userId',
        email: 'contact.email',
        name: 'profile.displayName',
        picture: 'profile.avatar.url',
        emailVerified: 'contact.verified'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      const mockUserInfo = {
        user: { userId: 'nested-123' },
        contact: { 
          email: 'nested@example.com',
          verified: false
        },
        profile: {
          displayName: 'Nested User',
          avatar: {
            url: 'https://example.com/nested.jpg'
          }
        }
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('nested-123');
      expect(userInfo.email).toBe('nested@example.com');
      expect(userInfo.name).toBe('Nested User');
      expect(userInfo.picture).toBe('https://example.com/nested.jpg');
      expect(userInfo.emailVerified).toBe(false);
    });
    
    it('falls back to default fields when mapping returns undefined', async () => {
      mockConfig.userinfoMapping = {
        id: 'nonexistent.field',
        email: 'missing.email'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      const mockUserInfo = {
        sub: 'fallback-123',
        id: 'fallback-id',
        email: 'fallback@example.com'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      // Should fall back to 'sub' when mapped field doesn't exist
      expect(userInfo.id).toBe('fallback-123');
      // Email mapping fails, returns empty string (no fallback for email)
      expect(userInfo.email).toBe('');
    });
    
    it('handles null and undefined fields in nested mapping', async () => {
      mockConfig.userinfoMapping = {
        id: 'user.id',
        name: 'profile.name'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      const mockUserInfo = {
        user: null,
        profile: undefined,
        sub: 'fallback-id'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('fallback-id');
      expect(userInfo.name).toBe('');
    });
    
    it('handles primitive values in mapping path', async () => {
      mockConfig.userinfoMapping = {
        id: 'primitiveField.nonExistentProperty'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      const mockUserInfo = {
        primitiveField: 'just-a-string',
        sub: 'fallback-id'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('fallback-id');
    });
    
    it('converts all values to strings', async () => {
      const mockUserInfo = {
        sub: 123,
        email: null,
        name: undefined,
        picture: false,
        email_verified: 'yes'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('123');
      expect(userInfo.email).toBe('null');
      expect(userInfo.name).toBe('undefined');
      expect(userInfo.picture).toBe('false');
      expect(userInfo.emailVerified).toBe(true); // Boolean conversion
    });
    
    it('throws error when endpoint not configured', async () => {
      delete mockConfig.userinfoEndpoint;
      provider = new GenericOAuth2Provider(mockConfig);
      
      await expect(provider.getUserInfo('token'))
        .rejects.toThrow('UserInfo endpoint not configured');
    });
    
    it('throws error when userinfoEndpoint is null', async () => {
      mockConfig.userinfoEndpoint = null;
      provider = new GenericOAuth2Provider(mockConfig);
      
      await expect(provider.getUserInfo('token'))
        .rejects.toThrow('UserInfo endpoint not configured');
    });
    
    it('handles HTTP errors from userinfo endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response);
      
      await expect(provider.getUserInfo('invalid-token'))
        .rejects.toThrow('Failed to get user info: Unauthorized');
    });
    
    it('handles userinfo mapping with nested paths', async () => {
      mockConfig.userinfoMapping = {
        id: 'user.id',
        email: 'contact.email',
        name: 'profile.displayName',
        picture: 'avatar.url',
        emailVerified: 'contact.verified'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: 'nested-123' },
          contact: { email: 'nested@example.com', verified: true },
          profile: { displayName: 'Nested User' },
          avatar: { url: 'https://example.com/nested.jpg' }
        })
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('nested-123');
      expect(userInfo.email).toBe('nested@example.com');
      expect(userInfo.name).toBe('Nested User');
      expect(userInfo.picture).toBe('https://example.com/nested.jpg');
      expect(userInfo.emailVerified).toBe(true);
    });
    
    it('handles missing nested values gracefully', async () => {
      mockConfig.userinfoMapping = {
        id: 'user.id',
        email: 'contact.email.primary',
        name: 'profile.name.full'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {},
          contact: {},
          profile: {}
        })
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('');
      expect(userInfo.email).toBe('');
      expect(userInfo.name).toBe('');
    });
    
    it('falls back to default fields when custom mapping fails', async () => {
      mockConfig.userinfoMapping = {
        id: 'nonexistent.field',
        email: 'missing.email'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'fallback-id',
          email: 'fallback@example.com'
        })
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('fallback-id');
      expect(userInfo.email).toBe('fallback@example.com');
    });
    
    it('handles null and undefined values in user data', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: null,
          email: undefined,
          name: null,
          picture: undefined,
          email_verified: null
        })
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('');
      expect(userInfo.email).toBe('');
      expect(userInfo.name).toBe('');
      expect(userInfo.picture).toBe('');
      expect(userInfo.emailVerified).toBe(false);
    });
    
    it('handles non-object values in nested path traversal', async () => {
      mockConfig.userinfoMapping = {
        id: 'user.id',
        email: 'contact.email'
      };
      provider = new GenericOAuth2Provider(mockConfig);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: 'not-an-object',
          contact: null,
          sub: 'fallback-id',
          email: 'fallback@example.com'
        })
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('fallback-id');
      expect(userInfo.email).toBe('fallback@example.com');
    });
    
    it('handles id field fallback to "id" when "sub" is not available', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'fallback-id-field',
          email: 'test@example.com'
          // No "sub" field
        })
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('fallback-id-field');
    });
    
    it('handles empty string id when both sub and id are missing', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          email: 'test@example.com'
          // No "sub" or "id" fields
        })
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('');
    });
    
    it('converts non-string values to strings in field mappings', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 12345,
          email: 67890,
          name: true,
          picture: { url: 'complex-object' },
          email_verified: 'yes'
        })
      } as Response);
      
      const userInfo = await provider.getUserInfo('token');
      
      expect(userInfo.id).toBe('12345');
      expect(userInfo.email).toBe('67890');
      expect(userInfo.name).toBe('true');
      expect(userInfo.picture).toBe('[object Object]');
      expect(userInfo.emailVerified).toBe(true); // Boolean conversion
    });
  });
  
  describe('refreshTokens', () => {
    beforeEach(() => {
      provider = new GenericOAuth2Provider(mockConfig);
    });
    
    it('refreshes access token using refresh token', async () => {
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
      
      expect(tokens).toEqual({
        accessToken: 'new-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600
      });
    });
    
    it('sends correct request body parameters for refresh token', async () => {
      const mockTokens = {
        access_token: 'new-access-token',
        token_type: 'Bearer'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      await provider.refreshTokens('test-refresh-token');
      
      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const requestBody = fetchCall[1]?.body as URLSearchParams;
      
      expect(requestBody.get('grant_type')).toBe('refresh_token');
      expect(requestBody.get('refresh_token')).toBe('test-refresh-token');
      expect(requestBody.get('client_id')).toBe('test-client-id');
      expect(requestBody.get('client_secret')).toBe('test-client-secret');
    });
    
    it('handles refresh token response with all optional fields', async () => {
      const mockTokens = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 7200,
        refresh_token: 'new-refresh-token',
        scope: 'read write admin',
        id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.refreshTokens('refresh-token');
      
      expect(tokens).toEqual({
        accessToken: 'new-access-token',
        tokenType: 'Bearer',
        expiresIn: 7200,
        refreshToken: 'new-refresh-token',
        scope: 'read write admin',
        idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      });
    });
    
    it('handles refresh token response without optional fields', async () => {
      const mockTokens = {
        access_token: 'new-access-token',
        token_type: 'Bearer'
        // Missing expires_in, refresh_token, scope, id_token
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.refreshTokens('refresh-token');
      
      expect(tokens).toEqual({
        accessToken: 'new-access-token',
        tokenType: 'Bearer'
      });
      expect(tokens.expiresIn).toBeUndefined();
      expect(tokens.refreshToken).toBeUndefined();
      expect(tokens.scope).toBeUndefined();
      expect(tokens.idToken).toBeUndefined();
    });
    
    it('handles refresh token errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      } as Response);
      
      await expect(provider.refreshTokens('invalid-refresh-token'))
        .rejects.toThrow('Failed to refresh tokens: Bad Request');
    });
  });
  
  describe('discoverOidcConfiguration', () => {
    it('discovers OIDC configuration from issuer', async () => {
      const discoveryDoc = {
        issuer: 'https://provider.com',
        authorization_endpoint: 'https://provider.com/auth',
        token_endpoint: 'https://provider.com/token',
        userinfo_endpoint: 'https://provider.com/userinfo',
        jwks_uri: 'https://provider.com/jwks',
        scopes_supported: ['openid', 'email', 'profile'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post']
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => discoveryDoc
      } as Response);
      
      const config = await discoverOidcConfiguration('https://provider.com');
      
      expect(fetch).toHaveBeenCalledWith('https://provider.com/.well-known/openid-configuration');
      expect(config).toEqual({
        issuer: 'https://provider.com',
        authorizationEndpoint: 'https://provider.com/auth',
        tokenEndpoint: 'https://provider.com/token',
        userinfoEndpoint: 'https://provider.com/userinfo',
        jwksUri: 'https://provider.com/jwks',
        scopesSupported: ['openid', 'email', 'profile'],
        responseTypesSupported: ['code'],
        grantTypesSupported: ['authorization_code', 'refresh_token'],
        tokenEndpointAuthMethods: ['client_secret_basic', 'client_secret_post']
      });
    });
    
    it('removes trailing slash from issuer URL', async () => {
      const discoveryDoc = {
        issuer: 'https://provider.com/',
        authorization_endpoint: 'https://provider.com/auth',
        token_endpoint: 'https://provider.com/token'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => discoveryDoc
      } as Response);
      
      await discoverOidcConfiguration('https://provider.com/');
      
      expect(fetch).toHaveBeenCalledWith('https://provider.com/.well-known/openid-configuration');
    });
    
    it('handles discovery endpoint with minimal configuration', async () => {
      const discoveryDoc = {
        issuer: 'https://minimal.com',
        authorization_endpoint: 'https://minimal.com/auth',
        token_endpoint: 'https://minimal.com/token'
        // Missing optional fields
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => discoveryDoc
      } as Response);
      
      const config = await discoverOidcConfiguration('https://minimal.com');
      
      expect(config.issuer).toBe('https://minimal.com');
      expect(config.authorizationEndpoint).toBe('https://minimal.com/auth');
      expect(config.tokenEndpoint).toBe('https://minimal.com/token');
      expect(config.userinfoEndpoint).toBeUndefined();
      expect(config.jwksUri).toBeUndefined();
      expect(config.scopesSupported).toBeUndefined();
      expect(config.responseTypesSupported).toBeUndefined();
      expect(config.grantTypesSupported).toBeUndefined();
      expect(config.tokenEndpointAuthMethods).toBeUndefined();
    });
    
    it('throws error when discovery fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);
      
      await expect(discoverOidcConfiguration('https://invalid.com'))
        .rejects.toThrow('Failed to discover OIDC configuration: Not Found');
    });
    
    it('handles network errors during discovery', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      
      await expect(discoverOidcConfiguration('https://network-error.com'))
        .rejects.toThrow('Network error');
    });
  });
});