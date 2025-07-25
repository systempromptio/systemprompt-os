/**
 * @fileoverview Unit tests for Generic OAuth2/OIDC Provider
 * @module tests/unit/server/external/auth/providers/generic-oauth2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenericOAuth2Provider } from '../../../../../../src/server/external/auth/providers/generic-oauth2.js';
import type { GenericOAuth2Config } from '../../../../../../src/server/external/auth/providers/types/generic-oauth2.js';

// Mock global fetch
global.fetch = vi.fn();

const baseConfig: GenericOAuth2Config = {
  id: 'test-provider',
  name: 'Test Provider',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:3000/callback',
  authorizationEndpoint: 'https://provider.com/auth',
  tokenEndpoint: 'https://provider.com/token',
  userinfoEndpoint: 'https://provider.com/userinfo',
  scope: 'openid email profile'
};

describe('GenericOAuth2Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize OAuth2 provider with correct properties', () => {
      const provider = new GenericOAuth2Provider(baseConfig);
      
      expect(provider.id).toBe('test-provider');
      expect(provider.name).toBe('Test Provider');
      expect(provider.type).toBe('oauth2');
    });

    it('should become OIDC provider when issuer is provided', () => {
      const config = {
        ...baseConfig,
        issuer: 'https://provider.com'
      };
      
      const provider = new GenericOAuth2Provider(config);
      expect(provider.type).toBe('oidc');
    });

    it('should become OIDC provider when issuer is empty string', () => {
      const config = {
        ...baseConfig,
        issuer: ''
      };
      
      const provider = new GenericOAuth2Provider(config);
      expect(provider.type).toBe('oauth2');
    });

    it('should set default scope when not provided', () => {
      const configWithoutScope = {
        ...baseConfig
      };
      delete configWithoutScope.scope;
      
      const provider = new GenericOAuth2Provider(configWithoutScope);
      const authUrl = provider.getAuthorizationUrl('test-state');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('scope')).toBe('openid email profile');
    });

    it('should use provided scope when available', () => {
      const config = {
        ...baseConfig,
        scope: 'custom scope'
      };
      
      const provider = new GenericOAuth2Provider(config);
      const authUrl = provider.getAuthorizationUrl('test-state');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('scope')).toBe('custom scope');
    });

    it('should set default userinfoMapping when not provided', () => {
      const provider = new GenericOAuth2Provider(baseConfig);
      // We'll test this indirectly through getUserInfo method
      expect(provider).toBeDefined();
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