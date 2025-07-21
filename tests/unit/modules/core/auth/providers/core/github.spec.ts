/**
 * @fileoverview Unit tests for GitHub identity provider
 * @module tests/unit/modules/core/auth/providers/core/github
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubProvider } from '../../../../../../../src/modules/core/auth/providers/core/github';

// Mock fetch
global.fetch = vi.fn();

describe('GitHubProvider', () => {
  let provider: GitHubProvider;
  let mockConfig: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      clientid: 'test-client-id',
      clientsecret: 'test-client-secret',
      redirecturi: 'http://localhost:3000/callback'
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
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: expect.any(URLSearchParams)
      });
      
      const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams;
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('code')).toBe('test-code');
      expect(body.get('redirect_uri')).toBe('http://localhost:3000/callback');
      
      expect(tokens).toEqual({
        accesstoken: mockTokens.access_token,
        tokentype: mockTokens.token_type,
        scope: mockTokens.scope
      });
    });
    
    it('handles token exchange errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Bad verification code'
      } as Response);
      
      await expect(provider.exchangeCodeForTokens('invalid-code'))
        .rejects.toThrow('Failed to exchange code: Bad verification code');
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
          'Authorization': 'Bearer test-token',
          'Accept': 'application/json'
        }
      });
      
      expect(fetch).toHaveBeenNthCalledWith(2, 'https://api.github.com/user/emails', {
        headers: {
          'Authorization': 'Bearer test-token',
          'Accept': 'application/json'
        }
      });
      
      expect(userInfo).toEqual({
        id: '123456',
        email: 'primary@example.com',
        emailverified: true,
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
      expect(userInfo.emailverified).toBe(true); // Default to true when using public email
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
      
      expect(userInfo.email).toBeNull();
      expect(userInfo.emailverified).toBe(true); // Default value
      expect(userInfo.name).toBe('user5'); // Uses login as name
    });
  });
  
  // GitHub provider does not support refresh tokens
});