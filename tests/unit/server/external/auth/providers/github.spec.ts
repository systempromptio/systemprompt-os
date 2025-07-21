/**
 * @fileoverview Unit tests for GitHub OAuth Provider
 * @module tests/unit/server/external/auth/providers/github
 */

import { describe, it, expect, vi } from 'vitest';
import { GitHubProvider } from '../../../../../../src/server/external/auth/providers/github';
import { generateOAuth2ProviderTests } from './oauth2-shared-tests';

// Mock global fetch
global.fetch = vi.fn();

const baseConfig = {
  id: 'github',
  name: 'GitHub',
  clientid: 'test-client-id',
  clientsecret: 'test-client-secret',
  redirecturi: 'http://localhost:3000/callback',
  scope: 'read:user user:email'
};

// Generate comprehensive tests using shared utility
generateOAuth2ProviderTests({
  providerName: 'GitHub',
  providerId: 'github',
  providerType: 'oauth2',
  createProvider: (config) => new GitHubProvider(config),
  baseConfig,
  expectedTokenEndpoint: 'https://github.com/login/oauth/accesstoken',
  expectedUserInfoEndpoint: 'https://api.github.com/user',
  supportsRefresh: false
}, () => {
  // GitHub-specific tests for email handling
  describe('GitHub-specific email handling', () => {
    it('should fetch user emails when user has no public email', async () => {
      const mockUserInfo = {
        id: 123456,
        login: 'testuser',
        name: 'Test User',
        email: null
      };

      const mockEmailsResponse = [
        {
          email: 'private@example.com',
          primary: true,
          verified: true,
          visibility: 'private'
        }
      ];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockUserInfo)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockEmailsResponse)
        } as any);

      const provider = new GitHubProvider(baseConfig);
      const userInfo = await provider.getUserInfo('test-token');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenLastCalledWith(
        'https://api.github.com/user/emails',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
      
      expect(userInfo.email).toBe('private@example.com');
      expect(userInfo.emailverified).toBe(true);
    });

    it('should handle errors when fetching emails gracefully', async () => {
      const mockUserInfo = {
        id: 123456,
        login: 'testuser',
        name: 'Test User',
        email: null
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockUserInfo)
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        } as any);

      const provider = new GitHubProvider(baseConfig);
      const userInfo = await provider.getUserInfo('test-token');
      
      // When email fetch fails, it should continue with null email
      expect(userInfo.email).toBeNull();
      expect(userInfo.emailverified).toBe(true);
    });
  });
});