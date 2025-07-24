/**
 * @fileoverview Unit tests for Generic OAuth2/OIDC Provider
 * @module tests/unit/server/external/auth/providers/generic-oauth2
 */

import { describe, it, expect, vi } from 'vitest';
import { GenericOAuth2Provider } from '../../../../../../src/server/external/auth/providers/generic-oauth2.js';
import { generateOAuth2ProviderTests } from './oauth2-shared-tests.js';

// Mock global fetch
global.fetch = vi.fn();

const baseConfig = {
  id: 'test-provider',
  name: 'Test Provider',
  client_id: 'test-client-id',
  client_secret: 'test-client-secret',
  redirect_uri: 'http://localhost:3000/callback',
  authorization_endpoint: 'https://provider.com/auth',
  token_endpoint: 'https://provider.com/token',
  userinfo_endpoint: 'https://provider.com/userinfo',
  scope: 'openid email profile'
};

// Generate comprehensive tests using shared utility for OAuth2
generateOAuth2ProviderTests({
  providerName: 'Generic OAuth2',
  providerId: 'test-provider',
  providerType: 'oauth2',
  createProvider: (config) => new GenericOAuth2Provider(config),
  baseConfig,
  expectedTokenEndpoint: 'https://provider.com/token',
  expectedUserInfoEndpoint: 'https://provider.com/userinfo',
  supportsRefresh: true
}, () => {
  // Generic OAuth2-specific tests
  describe('Generic OAuth2-specific features', () => {
    it('should become OIDC provider when issuer is provided', () => {
      const config = {
        ...baseConfig,
        issuer: 'https://provider.com'
      };
      
      const provider = new GenericOAuth2Provider(config);
      expect(provider.type).toBe('oidc');
    });

    it('should support custom authorization parameters', () => {
      const config = {
        ...baseConfig,
        authorization_params: {
          prompt: 'consent',
          access_type: 'offline'
        }
      };
      
      const provider = new GenericOAuth2Provider(config);
      const authUrl = provider.getAuthorizationUrl('state', 'nonce');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('prompt')).toBe('consent');
      expect(url.searchParams.get('access_type')).toBe('offline');
    });

    it('should handle custom user info mapping', async () => {
      const config = {
        ...baseConfig,
        userinfo_mapping: {
          id: 'sub',
          email: 'email_address',
          name: 'display_name',
          picture: 'avatar_url'
        }
      };

      const mockUserInfo = {
        sub: 'custom-id-123',
        email_address: 'custom@example.com',
        display_name: 'Custom User',
        avatar_url: 'https://example.com/avatar.jpg'
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockUserInfo)
      } as any);

      const provider = new GenericOAuth2Provider(config);
      const userInfo = await provider.getUserInfo('token');

      expect(userInfo).toEqual({
        id: 'custom-id-123',
        email: 'custom@example.com',
        email_verified: undefined,
        name: 'Custom User',
        picture: 'https://example.com/avatar.jpg',
        raw: mockUserInfo
      });
    });
  });
});

// Generate tests for OIDC configuration
describe('Generic OIDC Provider', () => {
  const oidcConfig = {
    ...baseConfig,
    issuer: 'https://provider.com'
  };

  it('should support OIDC-specific features', () => {
    const provider = new GenericOAuth2Provider(oidcConfig);
    expect(provider.type).toBe('oidc');
    
    // OIDC providers support nonce
    const authUrl = provider.getAuthorizationUrl('state', 'nonce-value');
    const url = new URL(authUrl);
    expect(url.searchParams.get('nonce')).toBe('nonce-value');
  });
});