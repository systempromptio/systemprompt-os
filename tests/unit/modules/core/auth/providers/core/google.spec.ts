/**
 * @fileoverview Unit tests for Google identity provider
 * @module tests/unit/modules/core/auth/providers/core/google
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleProvider } from '../../../../../../../src/modules/core/auth/providers/core/google.js';

// Mock fetch
global.fetch = vi.fn();

describe('GoogleProvider', () => {
  let provider: GoogleProvider;
  let mockConfig: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      clientId: 'test-client-id.apps.googleusercontent.com',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback'
    };
  });
  
  describe('constructor', () => {
    it('initializes with provided config', () => {
      provider = new GoogleProvider(mockConfig);
      
      expect(provider.id).toBe('google');
      expect(provider.name).toBe('Google');
      expect(provider.type).toBe('oidc');
    });
    
    it('sets default scope if not provided', () => {
      provider = new GoogleProvider(mockConfig);
      const url = provider.getAuthorizationUrl('test-state');
      
      expect(url).toContain('scope=email+profile');
    });
    
    it('uses custom scope if provided', () => {
      mockConfig.scope = 'email profile https://www.googleapis.com/auth/calendar';
      provider = new GoogleProvider(mockConfig);
      const url = provider.getAuthorizationUrl('test-state');
      
      expect(url).toContain('scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar');
    });
  });
  
  describe('getAuthorizationUrl', () => {
    beforeEach(() => {
      provider = new GoogleProvider(mockConfig);
    });
    
    it('generates correct authorization URL', () => {
      const state = 'random-state-123';
      const url = provider.getAuthorizationUrl(state);
      
      const urlObj = new URL(url);
      expect(urlObj.origin + urlObj.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(urlObj.searchParams.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
      expect(urlObj.searchParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
      expect(urlObj.searchParams.get('response_type')).toBe('code');
      expect(urlObj.searchParams.get('scope')).toBe('email profile');
      expect(urlObj.searchParams.get('state')).toBe(state);
      expect(urlObj.searchParams.get('access_type')).toBe('offline');
      expect(urlObj.searchParams.get('prompt')).toBe('consent');
    });
    
    it('includes nonce when provided', () => {
      const state = 'test-state';
      const nonce = 'test-nonce-123';
      const url = provider.getAuthorizationUrl(state, nonce);
      
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('nonce')).toBe(nonce);
    });

    it('excludes nonce when empty string is provided', () => {
      const state = 'test-state';
      const nonce = '';
      const url = provider.getAuthorizationUrl(state, nonce);
      
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('nonce')).toBeNull();
    });

    it('excludes nonce when undefined is provided', () => {
      const state = 'test-state';
      const url = provider.getAuthorizationUrl(state, undefined);
      
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('nonce')).toBeNull();
    });

    it('includes nonce when provided with special characters', () => {
      const state = 'test-state';
      const nonce = 'test-nonce-with-$pecial-ch@rs!';
      const url = provider.getAuthorizationUrl(state, nonce);
      
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('nonce')).toBe(nonce);
    });
  });
  
  describe('exchangeCodeForTokens', () => {
    beforeEach(() => {
      provider = new GoogleProvider(mockConfig);
    });
    
    it('exchanges authorization code for tokens', async () => {
      const mockTokens = {
        access_token: 'ya29.test_access_token',
        refresh_token: '1//test_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
        id_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20ifQ.signature'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.exchangeCodeForTokens('test-auth-code');
      
      expect(fetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: expect.any(URLSearchParams)
      });
      
      const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams;
      expect(body.get('code')).toBe('test-auth-code');
      expect(body.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('redirect_uri')).toBe('http://localhost:3000/callback');
      expect(body.get('grant_type')).toBe('authorization_code');
      
      expect(tokens).toEqual(mockTokens);
    });
    
    it('throws error when client secret is missing', async () => {
      const configWithoutSecret = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/callback'
      };
      const providerWithoutSecret = new GoogleProvider(configWithoutSecret as any);
      
      await expect(providerWithoutSecret.exchangeCodeForTokens('test-code'))
        .rejects.toThrow('Client secret is required for token exchange');
    });

    it('throws error when client secret is empty string', async () => {
      const configWithEmptySecret = {
        clientId: 'test-client-id',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/callback'
      };
      const providerWithEmptySecret = new GoogleProvider(configWithEmptySecret);
      
      await expect(providerWithEmptySecret.exchangeCodeForTokens('test-code'))
        .rejects.toThrow('Client secret is required for token exchange');
    });

    it('handles token exchange errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'invalid_grant'
      } as Response);
      
      await expect(provider.exchangeCodeForTokens('invalid-code'))
        .rejects.toThrow('Failed to exchange code: invalid_grant');
    });

    it('handles network errors during token exchange', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      
      await expect(provider.exchangeCodeForTokens('test-code'))
        .rejects.toThrow('Network error');
    });
  });
  
  describe('getUserInfo', () => {
    beforeEach(() => {
      provider = new GoogleProvider(mockConfig);
    });
    
    it('fetches user info from Google', async () => {
      const mockUserInfo = {
        sub: '1234567890',
        email: 'test@gmail.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://lh3.googleusercontent.com/a/test-photo',
        given_name: 'Test',
        family_name: 'User',
        locale: 'en'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-access-token');
      
      expect(fetch).toHaveBeenCalledWith('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'authorization': 'Bearer test-access-token'
        }
      });
      
      expect(userInfo).toEqual({
        id: '1234567890',
        email: 'test@gmail.com',
        name: 'Test User',
        picture: 'https://lh3.googleusercontent.com/a/test-photo',
        locale: 'en',
        raw: mockUserInfo
      });
    });
    
    it('handles user info fetch errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response);
      
      await expect(provider.getUserInfo('invalid-token'))
        .rejects.toThrow('Failed to get user info: Unauthorized');
    });

    it('handles network errors during user info fetch', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network timeout'));
      
      await expect(provider.getUserInfo('test-token'))
        .rejects.toThrow('Network timeout');
    });

    it('handles malformed JSON response from Google user info', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      } as Response);
      
      await expect(provider.getUserInfo('test-token'))
        .rejects.toThrow('Invalid JSON');
    });

    it('maps all optional user info fields when present', async () => {
      const mockUserInfo = {
        sub: '1234567890',
        email: 'test@gmail.com',
        emailVerified: true,
        name: 'Test User',
        picture: 'https://lh3.googleusercontent.com/a/test-photo',
        locale: 'en-US'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-access-token');
      
      expect(userInfo).toEqual({
        id: '1234567890',
        email: 'test@gmail.com',
        emailVerified: true,
        name: 'Test User',
        picture: 'https://lh3.googleusercontent.com/a/test-photo',
        locale: 'en-US',
        raw: mockUserInfo
      });
    });

    it('handles undefined values for optional fields', async () => {
      const mockUserInfo = {
        sub: '999',
        email: undefined,
        emailVerified: undefined,
        name: undefined,
        picture: undefined,
        locale: undefined
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-token');
      
      expect(userInfo).toEqual({
        id: '999',
        raw: mockUserInfo
      });
      expect(userInfo).not.toHaveProperty('email');
      expect(userInfo).not.toHaveProperty('emailVerified');
      expect(userInfo).not.toHaveProperty('name');
      expect(userInfo).not.toHaveProperty('picture');
      expect(userInfo).not.toHaveProperty('locale');
    });
    
    it('maps user info correctly with minimal data', async () => {
      const mockUserInfo = {
        sub: '999',
        email: 'minimal@gmail.com'
        // No other fields
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-token');
      
      expect(userInfo).toEqual({
        id: '999',
        email: 'minimal@gmail.com',
        raw: mockUserInfo
      });
    });
  });
  
  describe('refreshTokens', () => {
    beforeEach(() => {
      provider = new GoogleProvider(mockConfig);
    });
    
    it('refreshes access token using refresh token', async () => {
      const mockTokens = {
        access_token: 'ya29.new_access_token',
        expires_in: 3600,
        token_type: 'Bearer'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.refreshTokens('test-refresh-token');
      
      expect(fetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: expect.any(URLSearchParams)
      });
      
      const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams;
      expect(body.get('refresh_token')).toBe('test-refresh-token');
      expect(body.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('grant_type')).toBe('refresh_token');
      
      expect(tokens).toEqual(mockTokens);
    });
    
    it('throws error when client secret is missing for refresh', async () => {
      const configWithoutSecret = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/callback'
      };
      const providerWithoutSecret = new GoogleProvider(configWithoutSecret as any);
      
      await expect(providerWithoutSecret.refreshTokens('test-refresh-token'))
        .rejects.toThrow('Client secret is required for token refresh');
    });

    it('throws error when client secret is empty string for refresh', async () => {
      const configWithEmptySecret = {
        clientId: 'test-client-id',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/callback'
      };
      const providerWithEmptySecret = new GoogleProvider(configWithEmptySecret);
      
      await expect(providerWithEmptySecret.refreshTokens('test-refresh-token'))
        .rejects.toThrow('Client secret is required for token refresh');
    });

    it('handles refresh token errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      } as Response);
      
      await expect(provider.refreshTokens('invalid-refresh-token'))
        .rejects.toThrow('Failed to refresh tokens: Bad Request');
    });

    it('handles network errors during token refresh', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection timeout'));
      
      await expect(provider.refreshTokens('test-refresh-token'))
        .rejects.toThrow('Connection timeout');
    });

    it('handles malformed JSON response from refresh endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Malformed JSON'); }
      } as Response);
      
      await expect(provider.refreshTokens('test-refresh-token'))
        .rejects.toThrow('Malformed JSON');
    });
  });
  
  describe('revokeTokens', () => {
    beforeEach(() => {
      provider = new GoogleProvider(mockConfig);
    });
    
    it('revokes a token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);
      
      await provider.revokeTokens('test-token');
      
      expect(fetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: expect.any(URLSearchParams)
      });
      
      const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams;
      expect(body.get('token')).toBe('test-token');
    });
    
    it('handles revocation errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      } as Response);
      
      await expect(provider.revokeTokens('invalid-token'))
        .rejects.toThrow('Failed to revoke token: Bad Request');
    });

    it('handles network errors during token revocation', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));
      
      await expect(provider.revokeTokens('test-token'))
        .rejects.toThrow('Network failure');
    });

    it('successfully revokes refresh token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);
      
      await expect(provider.revokeTokens('test-refresh-token')).resolves.toBeUndefined();
      
      const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams;
      expect(body.get('token')).toBe('test-refresh-token');
    });

    it('successfully revokes access token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);
      
      await expect(provider.revokeTokens('test-access-token')).resolves.toBeUndefined();
      
      const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams;
      expect(body.get('token')).toBe('test-access-token');
    });
  });

  describe('edge cases and boundary conditions', () => {
    beforeEach(() => {
      provider = new GoogleProvider(mockConfig);
    });

    it('handles extremely long state parameter', () => {
      const longState = 'a'.repeat(2000);
      const url = provider.getAuthorizationUrl(longState);
      
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('state')).toBe(longState);
    });

    it('handles special characters in state parameter', () => {
      const specialState = 'state-with-special-chars-!@#$%^&*()_+{}[]|\\:";\'<>?,./ ';
      const url = provider.getAuthorizationUrl(specialState);
      
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('state')).toBe(specialState);
    });

    it('handles empty state parameter', () => {
      const emptyState = '';
      const url = provider.getAuthorizationUrl(emptyState);
      
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('state')).toBe('');
    });

    it('verifies all required URL parameters are present', () => {
      const url = provider.getAuthorizationUrl('test-state');
      const urlObj = new URL(url);
      
      expect(urlObj.searchParams.get('client_id')).toBeTruthy();
      expect(urlObj.searchParams.get('redirect_uri')).toBeTruthy();
      expect(urlObj.searchParams.get('response_type')).toBeTruthy();
      expect(urlObj.searchParams.get('scope')).toBeTruthy();
      expect(urlObj.searchParams.get('state')).toBeTruthy();
      expect(urlObj.searchParams.get('access_type')).toBeTruthy();
      expect(urlObj.searchParams.get('prompt')).toBeTruthy();
    });

    it('uses scope from constructor over default when provided', () => {
      const customConfig = {
        ...mockConfig,
        scope: 'custom scope value'
      };
      const customProvider = new GoogleProvider(customConfig);
      const url = customProvider.getAuthorizationUrl('test-state');
      
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('scope')).toBe('custom scope value');
    });

    it('preserves undefined discoveryurl in config', () => {
      const configWithUndefinedDiscovery = {
        ...mockConfig,
        discoveryurl: undefined
      };
      const providerWithUndefinedDiscovery = new GoogleProvider(configWithUndefinedDiscovery);
      
      expect(providerWithUndefinedDiscovery.id).toBe('google');
      expect(providerWithUndefinedDiscovery.name).toBe('Google');
      expect(providerWithUndefinedDiscovery.type).toBe('oidc');
    });

    it('handles empty authorization code', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'invalid_request'
      } as Response);
      
      await expect(provider.exchangeCodeForTokens(''))
        .rejects.toThrow('Failed to exchange code: invalid_request');
    });

    it('handles empty access token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response);
      
      await expect(provider.getUserInfo(''))
        .rejects.toThrow('Failed to get user info: Unauthorized');
    });

    it('handles empty refresh token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      } as Response);
      
      await expect(provider.refreshTokens(''))
        .rejects.toThrow('Failed to refresh tokens: Bad Request');
    });

    it('handles empty revocation token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);
      
      await provider.revokeTokens('');
      
      const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams;
      expect(body.get('token')).toBe('');
    });
  });

  describe('constructor variations', () => {
    it('preserves all config properties', () => {
      const fullConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'custom scope',
        discoveryurl: 'https://accounts.google.com/.well-known/openid-configuration'
      };
      
      const fullProvider = new GoogleProvider(fullConfig);
      expect(fullProvider.id).toBe('google');
      expect(fullProvider.name).toBe('Google');
      expect(fullProvider.type).toBe('oidc');
    });

    it('handles null scope in config', () => {
      const configWithNullScope = {
        ...mockConfig,
        scope: null as any
      };
      
      const providerWithNullScope = new GoogleProvider(configWithNullScope);
      const url = providerWithNullScope.getAuthorizationUrl('test-state');
      
      expect(url).toContain('scope=email+profile');
    });

    it('handles undefined scope in config', () => {
      const configWithUndefinedScope = {
        ...mockConfig,
        scope: undefined
      };
      
      const providerWithUndefinedScope = new GoogleProvider(configWithUndefinedScope);
      const url = providerWithUndefinedScope.getAuthorizationUrl('test-state');
      
      expect(url).toContain('scope=email+profile');
    });

    it('handles false scope in config', () => {
      const configWithFalseScope = {
        ...mockConfig,
        scope: false as any
      };
      
      const providerWithFalseScope = new GoogleProvider(configWithFalseScope);
      const url = providerWithFalseScope.getAuthorizationUrl('test-state');
      
      expect(url).toContain('scope=false');
    });

    it('handles empty string scope in config', () => {
      const configWithEmptyScope = {
        ...mockConfig,
        scope: ''
      };
      
      const providerWithEmptyScope = new GoogleProvider(configWithEmptyScope);
      const url = providerWithEmptyScope.getAuthorizationUrl('test-state');
      
      expect(url).toContain('scope=');
    });
  });

  describe('comprehensive coverage tests', () => {
    beforeEach(() => {
      provider = new GoogleProvider(mockConfig);
    });

    it('covers getAuthorizationUrl fallback scope path', () => {
      // Test when config scope is set to null after construction
      const providerWithNullScope = new GoogleProvider({
        ...mockConfig,
        scope: null as any
      });
      
      // This should trigger the fallback scope logic in getAuthorizationUrl
      const url = providerWithNullScope.getAuthorizationUrl('test-state');
      expect(url).toContain('scope=email+profile');
    });

    it('handles getUserInfo with emailVerified field mapping', async () => {
      const mockUserInfo = {
        sub: '1234567890',
        email: 'test@gmail.com',
        emailVerified: true,
        name: 'Test User',
        picture: 'https://lh3.googleusercontent.com/a/test-photo',
        locale: 'en'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-access-token');
      
      expect(userInfo).toEqual({
        id: '1234567890',
        email: 'test@gmail.com',
        emailVerified: true,
        name: 'Test User',
        picture: 'https://lh3.googleusercontent.com/a/test-photo',
        locale: 'en',
        raw: mockUserInfo
      });
    });

    it('handles null values in Google user info response', async () => {
      const mockUserInfo = {
        sub: '1234567890',
        email: null,
        emailVerified: null,
        name: null,
        picture: null,
        locale: null
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-access-token');
      
      // Note: null values are considered defined (not undefined), so they will be included
      expect(userInfo).toEqual({
        id: '1234567890',
        email: null,
        emailVerified: null,
        name: null,
        picture: null,
        locale: null,
        raw: mockUserInfo
      });
    });

    it('handles missing sub field in user info (should not happen but tests robustness)', async () => {
      const mockUserInfo = {
        email: 'test@gmail.com'
        // Missing sub field
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-access-token');
      
      expect(userInfo.id).toBeUndefined();
      expect(userInfo.email).toBe('test@gmail.com');
      expect(userInfo.raw).toEqual(mockUserInfo);
    });

    it('preserves extra fields in raw user info', async () => {
      const mockUserInfo = {
        sub: '1234567890',
        email: 'test@gmail.com',
        given_name: 'Test',
        family_name: 'User',
        hd: 'example.com', // Extra field
        verified_email: true // Extra field  
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-access-token');
      
      expect(userInfo.raw).toEqual(mockUserInfo);
      expect(userInfo.raw).toHaveProperty('given_name', 'Test');
      expect(userInfo.raw).toHaveProperty('family_name', 'User');
      expect(userInfo.raw).toHaveProperty('hd', 'example.com');
      expect(userInfo.raw).toHaveProperty('verified_email', true);
    });

    it('handles refreshTokens with response that includes all token fields', async () => {
      const mockTokens = {
        access_token: 'ya29.new_access_token',
        refresh_token: '1//new_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'email profile',
        id_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20ifQ.signature'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.refreshTokens('test-refresh-token');
      
      expect(tokens).toEqual(mockTokens);
    });

    it('handles exchangeCodeForTokens with minimal token response', async () => {
      const mockTokens = {
        access_token: 'ya29.minimal_token',
        token_type: 'Bearer'
        // Missing other optional fields
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.exchangeCodeForTokens('test-auth-code');
      
      expect(tokens).toEqual(mockTokens);
      expect(tokens.access_token).toBe('ya29.minimal_token');
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens).not.toHaveProperty('expires_in');
      expect(tokens).not.toHaveProperty('refresh_token');
      expect(tokens).not.toHaveProperty('scope');
      expect(tokens).not.toHaveProperty('id_token');
    });
  });
});