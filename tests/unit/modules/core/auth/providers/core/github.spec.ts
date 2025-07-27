/**
 * @fileoverview Unit tests for GitHub identity provider
 * @module tests/unit/modules/core/auth/providers/core/github
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubProvider } from '../../../../../../../src/modules/core/auth/providers/core/github.js';

// Mock fetch
global.fetch = vi.fn();

describe('GitHubProvider', () => {
  let provider: GitHubProvider;
  let mockConfig: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback'
    };
  });
  
  describe('constructor', () => {
    it('initializes with provided config', () => {
      provider = new GitHubProvider(mockConfig);
      
      expect(provider.id).toBe('github');
      expect(provider.name).toBe('GitHub');
      expect(provider.type).toBe('oauth2');
    });
    
    it('sets default scope if not provided', () => {
      provider = new GitHubProvider(mockConfig);
      const url = provider.getAuthorizationUrl('test-state');
      
      expect(url).toContain('scope=read%3Auser+user%3Aemail');
    });
    
    it('uses custom scope if provided', () => {
      mockConfig.scope = 'repo read:org';
      provider = new GitHubProvider(mockConfig);
      const url = provider.getAuthorizationUrl('test-state');
      
      expect(url).toContain('scope=repo+read%3Aorg');
    });
  });
  
  describe('getAuthorizationUrl', () => {
    beforeEach(() => {
      provider = new GitHubProvider(mockConfig);
    });
    
    it('generates correct authorization URL', () => {
      const state = 'random-state-123';
      const url = provider.getAuthorizationUrl(state);
      
      const urlObj = new URL(url);
      expect(urlObj.origin + urlObj.pathname).toBe('https://github.com/login/oauth/authorize');
      expect(urlObj.searchParams.get('client_id')).toBe('test-client-id');
      expect(urlObj.searchParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
      expect(urlObj.searchParams.get('scope')).toBe('read:user user:email');
      expect(urlObj.searchParams.get('state')).toBe(state);
    });
  });
  
  describe('exchangeCodeForTokens', () => {
    beforeEach(() => {
      provider = new GitHubProvider(mockConfig);
    });
    
    it('exchanges authorization code for tokens', async () => {
      const mockTokens = {
        access_token: 'gho_testtoken123',
        token_type: 'bearer',
        scope: 'read:user,user:email'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      const tokens = await provider.exchangeCodeForTokens('test-code');
      
      expect(fetch).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: expect.any(URLSearchParams)
      });
      
      const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams;
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('code')).toBe('test-code');
      expect(body.get('redirect_uri')).toBe('http://localhost:3000/callback');
      
      expect(tokens).toEqual(mockTokens);
    });
    
    it('handles token exchange errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Bad verification code'
      } as Response);
      
      await expect(provider.exchangeCodeForTokens('invalid-code'))
        .rejects.toThrow('Failed to exchange code: Bad verification code');
    });
    
    it('throws error when client secret is missing', async () => {
      const configWithoutSecret = {
        clientId: 'test-client-id',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/callback'
      };
      const providerWithoutSecret = new GitHubProvider(configWithoutSecret);
      
      await expect(providerWithoutSecret.exchangeCodeForTokens('test-code'))
        .rejects.toThrow('Client secret is required for token exchange');
    });
    
    it('throws error when client secret is undefined', async () => {
      const configWithoutSecret = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/callback'
      };
      const providerWithoutSecret = new GitHubProvider(configWithoutSecret);
      
      await expect(providerWithoutSecret.exchangeCodeForTokens('test-code'))
        .rejects.toThrow('Client secret is required for token exchange');
    });
  });
  
  describe('getUserInfo', () => {
    beforeEach(() => {
      provider = new GitHubProvider(mockConfig);
    });
    
    it('fetches user info with primary email when no public email', async () => {
      const mockUser = {
        id: 123456,
        login: 'testuser',
        name: 'Test User',
        email: null, // No public email
        avatar_url: 'https://github.com/avatar.jpg'
      };
      
      const mockEmails = [
        { email: 'secondary@example.com', verified: true, primary: false },
        { email: 'primary@example.com', verified: true, primary: true }
      ];
      
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmails
        } as Response);
      
      const userInfo = await provider.getUserInfo('test-token');
      
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/user', {
        headers: {
          'authorization': 'Bearer test-token',
          'accept': 'application/json'
        }
      });
      
      expect(fetch).toHaveBeenNthCalledWith(2, 'https://api.github.com/user/emails', {
        headers: {
          'authorization': 'Bearer test-token',
          'accept': 'application/json'
        }
      });
      
      expect(userInfo).toEqual({
        id: '123456',
        email: 'primary@example.com',
        emailVerified: true,
        name: 'Test User',
        picture: 'https://github.com/avatar.jpg',
        raw: mockUser
      });
    });
    
    it('uses public email when no primary email found', async () => {
      const mockUser = {
        id: 789,
        login: 'user2',
        name: 'User Two',
        email: 'public@example.com',
        avatar_url: 'https://github.com/avatar2.jpg'
      };
      
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        } as Response);
      
      const userInfo = await provider.getUserInfo('test-token');
      
      expect(userInfo.email).toBe('public@example.com');
      expect(userInfo.emailVerified).toBe(true); // Default to true when using public email
    });
    
    it('handles user info fetch errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response);
      
      await expect(provider.getUserInfo('invalid-token'))
        .rejects.toThrow('Failed to get user info: Unauthorized');
    });
    
    it('handles email fetch errors gracefully', async () => {
      const mockUser = {
        id: 999,
        login: 'user3',
        name: 'User Three',
        email: 'fallback@example.com'
      };
      
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Forbidden'
        } as Response);
      
      const userInfo = await provider.getUserInfo('test-token');
      
      // Should still return user info with public email
      expect(userInfo.email).toBe('fallback@example.com');
      expect(userInfo.name).toBe('User Three');
      expect(userInfo.emailVerified).toBe(true);
    });
    
    it('returns undefined email if no primary and no public email', async () => {
      const mockUser = {
        id: 555,
        login: 'user5',
        email: null // No public email
      };
      
      const mockEmails = [
        { email: 'unverified@example.com', verified: false, primary: false },
        { email: 'verified@example.com', verified: true, primary: false }
      ];
      
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmails
        } as Response);
      
      const userInfo = await provider.getUserInfo('test-token');
      
      expect(userInfo.email).toBeUndefined();
      expect(userInfo.emailVerified).toBe(true); // Default value
      expect(userInfo.name).toBe('user5'); // Uses login as name
    });
    
    it('uses public email when available and returns proper user info structure', async () => {
      const mockUser = {
        id: 777,
        login: 'publicuser',
        name: 'Public User',
        email: 'public@example.com',
        avatar_url: 'https://github.com/public.jpg'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-token');
      
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/user', {
        headers: {
          'authorization': 'Bearer test-token',
          'accept': 'application/json'
        }
      });
      
      expect(userInfo).toEqual({
        id: '777',
        email: 'public@example.com',
        emailVerified: true,
        name: 'Public User',
        picture: 'https://github.com/public.jpg',
        raw: mockUser
      });
      
      // Should not make a second request to emails endpoint when public email is available
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    
    it('handles user with no name and uses login as fallback', async () => {
      const mockUser = {
        id: 888,
        login: 'noname',
        email: 'noname@example.com',
        avatar_url: 'https://github.com/noname.jpg'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      } as Response);
      
      const userInfo = await provider.getUserInfo('test-token');
      
      expect(userInfo.name).toBe('noname');
      expect(userInfo.id).toBe('888');
    });
    
    it('handles primary email with correct verification status', async () => {
      const mockUser = {
        id: 999,
        login: 'primarytest',
        email: null
      };
      
      const mockEmails = [
        { email: 'secondary@example.com', verified: false, primary: false },
        { email: 'primary@example.com', verified: false, primary: true }
      ];
      
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmails
        } as Response);
      
      const userInfo = await provider.getUserInfo('test-token');
      
      expect(userInfo.email).toBe('primary@example.com');
      expect(userInfo.emailVerified).toBe(false); // Uses actual verification status
    });
  });
  
  describe('configuration validation', () => {
    it('handles config with all required fields', () => {
      const fullConfig = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'custom:scope'
      };
      
      const provider = new GitHubProvider(fullConfig);
      expect(provider.id).toBe('github');
      expect(provider.name).toBe('GitHub');
      expect(provider.type).toBe('oauth2');
    });
  });
  
  describe('authorization URL edge cases', () => {
    beforeEach(() => {
      provider = new GitHubProvider(mockConfig);
    });
    
    it('handles undefined scope in config during URL generation', () => {
      const configWithoutScope = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback'
      };
      const providerWithoutScope = new GitHubProvider(configWithoutScope);
      
      const url = providerWithoutScope.getAuthorizationUrl('test-state');
      expect(url).toContain('scope=read%3Auser+user%3Aemail');
    });
    
    it('properly URL encodes special characters in state', () => {
      const specialState = 'state-with-special-chars+&=';
      const url = provider.getAuthorizationUrl(specialState);
      
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('state')).toBe(specialState);
    });
  });
  
  describe('HTTP request headers', () => {
    beforeEach(() => {
      provider = new GitHubProvider(mockConfig);
    });
    
    it('uses correct header casing for token exchange', async () => {
      const mockTokens = {
        access_token: 'test-token',
        token_type: 'bearer'
      };
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      } as Response);
      
      await provider.exchangeCodeForTokens('test-code');
      
      expect(fetch).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: expect.any(URLSearchParams)
      });
    });
  });
  
  // GitHub provider does not support refresh tokens
});