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
      client_id: 'test-client-id.apps.googleusercontent.com',
      client_secret: 'test-client-secret',
      redirect_uri: 'http://localhost:3000/callback'
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
      
      expect(url).toContain('scope=openid+email+profile');
    });
    
    it('uses custom scope if provided', () => {
      mockConfig.scope = 'openid email profile https://www.googleapis.com/auth/calendar';
      provider = new GoogleProvider(mockConfig);
      const url = provider.getAuthorizationUrl('test-state');
      
      expect(url).toContain('scope=openid+email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar');
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
      expect(urlObj.searchParams.get('scope')).toBe('openid email profile');
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
          'Content-Type': 'application/x-www-form-urlencoded'
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
          'Authorization': 'Bearer test-access-token'
        }
      });
      
      expect(userInfo).toEqual({
        id: '1234567890',
        email: 'test@gmail.com',
        email_verified: true,
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
        emailverified: undefined,
        name: undefined,
        picture: undefined,
        locale: undefined,
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
          'Content-Type': 'application/x-www-form-urlencoded'
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
    
    it('handles refresh token errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      } as Response);
      
      await expect(provider.refreshTokens('invalid-refresh-token'))
        .rejects.toThrow('Failed to refresh tokens: Bad Request');
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
          'Content-Type': 'application/x-www-form-urlencoded'
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
  });
});