/**
 * @fileoverview Shared test utilities for OAuth2 providers
 * @module tests/unit/server/external/auth/providers/oauth2-shared-tests
 */

import { describe, it, expect, vi } from 'vitest';
import type { OAuth2Provider } from '../../../../../src/server/external/auth/providers/interface';

interface OAuth2ProviderTestConfig {
  providerName: string;
  providerId: string;
  providerType: 'oauth2' | 'oidc';
  createProvider: (config: any) => OAuth2Provider;
  baseConfig: any;
  expectedAuthParams?: Record<string, string>;
  expectedTokenEndpoint?: string;
  expectedUserInfoEndpoint?: string;
  supportsRefresh?: boolean;
}

/**
 * Generates comprehensive tests for OAuth2 providers
 */
export function generateOAuth2ProviderTests(config: OAuth2ProviderTestConfig, additionalTests?: () => void) {
  const { 
    providerName, 
    providerId, 
    providerType,
    createProvider, 
    baseConfig,
    expectedAuthParams = {},
    expectedTokenEndpoint,
    expectedUserInfoEndpoint,
    supportsRefresh = true
  } = config;

  describe(`${providerName} OAuth2 Provider`, () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should initialize with correct configuration', () => {
      const provider = createProvider(baseConfig);
      
      expect(provider.id).toBe(providerId);
      expect(provider.name).toBe(baseConfig.name || providerName);
      expect(provider.type).toBe(providerType);
    });

    it('should generate valid authorization URL', () => {
      const provider = createProvider(baseConfig);
      const state = 'test-state';
      const nonce = providerType === 'oidc' ? 'test-nonce' : undefined;
      
      const authUrl = provider.getAuthorizationUrl(state, nonce);
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('client_id')).toBe(baseConfig.client_id);
      expect(url.searchParams.get('redirect_uri')).toBe(baseConfig.redirect_uri);
      expect(url.searchParams.get('state')).toBe(state);
      
      if (providerType === 'oidc' && nonce) {
        expect(url.searchParams.get('nonce')).toBe(nonce);
      }
      
      // Check provider-specific params
      Object.entries(expectedAuthParams).forEach(([key, value]) => {
        expect(url.searchParams.get(key)).toBe(value);
      });
    });

    it('should exchange code for tokens successfully', async () => {
      const mockTokens: any = {
        access_token: 'mock-access-token',
        token_type: 'Bearer'
      };
      
      // GitHub returns different token structure
      if (providerName === 'GitHub') {
        mockTokens.scope = baseConfig.scope;
      } else {
        mockTokens.expires_in = 3600;
        if (supportsRefresh) {
          mockTokens.refresh_token = 'mock-refresh-token';
        }
        if (providerType === 'oidc') {
          mockTokens.id_token = 'mock-id-token';
        }
      }
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens
      });
      
      const provider = createProvider(baseConfig);
      const tokens = await provider.exchangeCodeForTokens('test-code');
      
      expect(tokens).toEqual(mockTokens);
      
      if (expectedTokenEndpoint) {
        expect(global.fetch).toHaveBeenCalledWith(
          expectedTokenEndpoint,
          expect.any(Object)
        );
      }
    });

    it('should fetch user info successfully', async () => {
      const mockUserInfo = providerName === 'Google' ? {
        sub: 'user-123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg'
      } : providerName === 'GitHub' ? {
        id: 123456,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg'
      } : {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User'
      };
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      });
      
      const provider = createProvider(baseConfig);
      const userInfo = await provider.getUserInfo('mock-access-token');
      
      const expectedUserInfo: any = {
        id: expect.any(String),
        email: 'test@example.com'
      };
      
      // Only check email_verified if provider returns it
      if (userInfo.email_verified !== undefined) {
        expectedUserInfo.email_verified = expect.any(Boolean);
      }
      
      expect(userInfo).toMatchObject(expectedUserInfo);
      
      if (expectedUserInfoEndpoint) {
        expect(global.fetch).toHaveBeenCalledWith(
          expectedUserInfoEndpoint,
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-access-token'
            })
          })
        );
      }
    });

    if (supportsRefresh) {
      it('should refresh tokens successfully', async () => {
        const mockNewTokens = {
          access_token: 'new-access-token',
          expires_in: 3600,
          refresh_token: 'new-refresh-token'
        };
        
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => mockNewTokens
        });
        
        const provider = createProvider(baseConfig);
        const tokens = await provider.refreshTokens('old-refresh-token');
        
        expect(tokens).toEqual(mockNewTokens);
      });
    }

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });
      
      const provider = createProvider(baseConfig);
      
      await expect(
        provider.exchangeCodeForTokens('invalid-code')
      ).rejects.toThrow();
    });

    // Run provider-specific additional tests
    if (additionalTests) {
      additionalTests();
    }
  });
}