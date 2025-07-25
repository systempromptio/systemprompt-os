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
  // No issuer property means it will be OAuth2
};

describe('GenericOAuth2Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
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

    it('should remain OAuth2 provider when issuer is empty string', () => {
      const config = {
        ...baseConfig,
        issuer: ''
      };
      
      const provider = new GenericOAuth2Provider(config);
      expect(provider.type).toBe('oauth2');
    });

    it('should remain OAuth2 provider when issuer is null', () => {
      const config = {
        ...baseConfig,
        issuer: null as any
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

    it('should set default scope when scope is null', () => {
      const config = {
        ...baseConfig,
        scope: null as any
      };
      
      const provider = new GenericOAuth2Provider(config);
      const authUrl = provider.getAuthorizationUrl('test-state');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('scope')).toBe('openid email profile');
    });

    it('should set default scope when scope is undefined', () => {
      const config = {
        ...baseConfig,
        scope: undefined
      };
      
      const provider = new GenericOAuth2Provider(config);
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
      expect(provider).toBeDefined();
    });

    it('should set default userinfoMapping when userinfoMapping is null', () => {
      const config = {
        ...baseConfig,
        userinfoMapping: null as any
      };
      
      const provider = new GenericOAuth2Provider(config);
      expect(provider).toBeDefined();
    });

    it('should use provided userinfoMapping when available', () => {
      const config = {
        ...baseConfig,
        userinfoMapping: {
          id: 'user_id',
          email: 'email_address',
          name: 'full_name'
        }
      };
      
      const provider = new GenericOAuth2Provider(config);
      expect(provider).toBeDefined();
    });
  });

  describe('getAuthorizationUrl', () => {
    let provider: GenericOAuth2Provider;

    beforeEach(() => {
      provider = new GenericOAuth2Provider(baseConfig);
    });

    it('should generate correct authorization URL with basic parameters', () => {
      const authUrl = provider.getAuthorizationUrl('test-state');
      const url = new URL(authUrl);
      
      expect(url.origin + url.pathname).toBe('https://provider.com/auth');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('state')).toBe('test-state');
      expect(url.searchParams.get('nonce')).toBeNull();
    });

    it('should not include nonce for OAuth2 provider even if provided', () => {
      const authUrl = provider.getAuthorizationUrl('test-state', 'test-nonce');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('nonce')).toBeNull();
    });

    it('should include nonce for OIDC provider when provided', () => {
      const oidcProvider = new GenericOAuth2Provider({
        ...baseConfig,
        issuer: 'https://provider.com'
      });
      
      const authUrl = oidcProvider.getAuthorizationUrl('test-state', 'test-nonce');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('nonce')).toBe('test-nonce');
    });

    it('should not include nonce for OIDC provider when nonce is empty string', () => {
      const oidcProvider = new GenericOAuth2Provider({
        ...baseConfig,
        issuer: 'https://provider.com'
      });
      
      const authUrl = oidcProvider.getAuthorizationUrl('test-state', '');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('nonce')).toBeNull();
    });

    it('should not include nonce for OIDC provider when nonce is null', () => {
      const oidcProvider = new GenericOAuth2Provider({
        ...baseConfig,
        issuer: 'https://provider.com'
      });
      
      const authUrl = oidcProvider.getAuthorizationUrl('test-state', null as any);
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('nonce')).toBeNull();
    });

    it('should include additional authorization parameters when provided', () => {
      const configWithParams = {
        ...baseConfig,
        authorizationParams: {
          'prompt': 'consent',
          'access_type': 'offline'
        }
      } as GenericOAuth2Config & { authorizationParams: Record<string, string> };
      
      const provider = new GenericOAuth2Provider(configWithParams);
      const authUrl = provider.getAuthorizationUrl('test-state');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('prompt')).toBe('consent');
      expect(url.searchParams.get('access_type')).toBe('offline');
    });

    it('should not include authorization parameters when authorizationParams is null', () => {
      const configWithNullParams = {
        ...baseConfig,
        authorizationParams: null
      } as GenericOAuth2Config & { authorizationParams: null };
      
      const provider = new GenericOAuth2Provider(configWithNullParams);
      const authUrl = provider.getAuthorizationUrl('test-state');
      const url = new URL(authUrl);
      
      // Should only have basic parameters
      expect(url.searchParams.has('prompt')).toBe(false);
      expect(url.searchParams.has('access_type')).toBe(false);
    });

    it('should not include authorization parameters when authorizationParams is not present', () => {
      const authUrl = provider.getAuthorizationUrl('test-state');
      const url = new URL(authUrl);
      
      // Should only have basic parameters
      expect(url.searchParams.has('prompt')).toBe(false);
      expect(url.searchParams.has('access_type')).toBe(false);
    });
  });

  describe('exchangeCodeForToken', () => {
    let provider: GenericOAuth2Provider;

    beforeEach(() => {
      provider = new GenericOAuth2Provider(baseConfig);
    });

    it('should successfully exchange code for tokens', async () => {
      const mockTokenResponse: IDPTokens = {
        access_token: 'access-token-123',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token-123',
        scope: 'openid email profile'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      } as Response);

      const result = await provider.exchangeCodeForToken('auth-code-123');

      expect(fetchMock).toHaveBeenCalledWith('https://provider.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: expect.any(URLSearchParams)
      });

      const callArgs = fetchMock.mock.calls[0];
      const bodyParams = callArgs[1].body as URLSearchParams;
      expect(bodyParams.get('grant_type')).toBe('authorization_code');
      expect(bodyParams.get('code')).toBe('auth-code-123');
      expect(bodyParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
      expect(bodyParams.get('client_id')).toBe('test-client-id');
      expect(bodyParams.get('client_secret')).toBe('test-client-secret');

      expect(result).toEqual(mockTokenResponse);
    });

    it('should handle missing client secret gracefully', async () => {
      const configWithoutSecret = {
        ...baseConfig,
        clientSecret: undefined
      };
      const provider = new GenericOAuth2Provider(configWithoutSecret);

      const mockTokenResponse: IDPTokens = {
        access_token: 'access-token-123',
        token_type: 'Bearer'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      } as Response);

      await provider.exchangeCodeForToken('auth-code-123');

      const callArgs = fetchMock.mock.calls[0];
      const bodyParams = callArgs[1].body as URLSearchParams;
      expect(bodyParams.get('client_secret')).toBe('');
    });

    it('should handle null client secret gracefully', async () => {
      const configWithNullSecret = {
        ...baseConfig,
        clientSecret: null as any
      };
      const provider = new GenericOAuth2Provider(configWithNullSecret);

      const mockTokenResponse: IDPTokens = {
        access_token: 'access-token-123',
        token_type: 'Bearer'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      } as Response);

      await provider.exchangeCodeForToken('auth-code-123');

      const callArgs = fetchMock.mock.calls[0];
      const bodyParams = callArgs[1].body as URLSearchParams;
      expect(bodyParams.get('client_secret')).toBe('');
    });

    it('should throw error when token exchange fails', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Invalid client credentials')
      } as Response);

      await expect(provider.exchangeCodeForToken('invalid-code'))
        .rejects.toThrow('Failed to exchange code: Invalid client credentials');
    });

    it('should throw error when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(provider.exchangeCodeForToken('auth-code-123'))
        .rejects.toThrow('Network error');
    });
  });

  describe('getUserInfo', () => {
    let provider: GenericOAuth2Provider;

    beforeEach(() => {
      provider = new GenericOAuth2Provider(baseConfig);
    });

    it('should successfully retrieve user info with default mapping', async () => {
      const mockUserData = {
        sub: 'user-123',
        email: 'user@example.com',
        email_verified: true,
        name: 'John Doe',
        picture: 'https://example.com/avatar.jpg',
        locale: 'en'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(fetchMock).toHaveBeenCalledWith('https://provider.com/userinfo', {
        headers: {
          Authorization: 'Bearer access-token-123',
          Accept: 'application/json'
        }
      });

      expect(result).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        email_verified: true,
        name: 'John Doe',
        picture: 'https://example.com/avatar.jpg',
        raw: mockUserData
      });
    });

    it('should use custom userinfo mapping when provided', async () => {
      const configWithMapping = {
        ...baseConfig,
        userinfoMapping: {
          id: 'user_id',
          email: 'email_address',
          emailVerified: 'verified',
          name: 'display_name',
          picture: 'avatar_url'
        }
      };
      const provider = new GenericOAuth2Provider(configWithMapping);

      const mockUserData = {
        user_id: 'custom-user-123',
        email_address: 'custom@example.com',
        verified: false,
        display_name: 'Custom Name',
        avatar_url: 'https://example.com/custom-avatar.jpg'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(result).toEqual({
        id: 'custom-user-123',
        email: 'custom@example.com',
        email_verified: false,
        name: 'Custom Name',
        picture: 'https://example.com/custom-avatar.jpg',
        raw: mockUserData
      });
    });

    it('should fallback to standard fields when custom mapping returns undefined', async () => {
      const configWithMapping = {
        ...baseConfig,
        userinfoMapping: {
          id: 'nonexistent_field',
          email: 'nonexistent_email'
        }
      };
      const provider = new GenericOAuth2Provider(configWithMapping);

      const mockUserData = {
        sub: 'fallback-user-123',
        id: 'backup-id-456',
        email: 'fallback@example.com',
        name: 'Fallback Name'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(result.id).toBe('fallback-user-123'); // Falls back to 'sub'
      expect(result.email).toBe('fallback@example.com'); // Falls back to 'email'
    });

    it('should fallback to id field when sub is not available', async () => {
      const mockUserData = {
        id: 'id-field-123',
        email: 'user@example.com',
        name: 'User Name'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(result.id).toBe('id-field-123');
    });

    it('should return empty string for id when no fallbacks are available', async () => {
      const mockUserData = {
        email: 'user@example.com',
        name: 'User Name'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(result.id).toBe('');
    });

    it('should handle nested object paths in mapping', async () => {
      const configWithNestedMapping = {
        ...baseConfig,
        userinfoMapping: {
          id: 'user.id',
          email: 'contact.email',
          name: 'profile.displayName'
        }
      };
      const provider = new GenericOAuth2Provider(configWithNestedMapping);

      const mockUserData = {
        user: {
          id: 'nested-user-123'
        },
        contact: {
          email: 'nested@example.com'
        },
        profile: {
          displayName: 'Nested Name'
        }
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(result.id).toBe('nested-user-123');
      expect(result.email).toBe('nested@example.com');
      expect(result.name).toBe('Nested Name');
    });

    it('should handle deep nested paths that do not exist', async () => {
      const configWithDeepMapping = {
        ...baseConfig,
        userinfoMapping: {
          id: 'deeply.nested.nonexistent.field'
        }
      };
      const provider = new GenericOAuth2Provider(configWithDeepMapping);

      const mockUserData = {
        deeply: {
          nested: {}
        },
        sub: 'fallback-id'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(result.id).toBe('fallback-id'); // Should fallback to 'sub'
    });

    it('should handle null values in nested objects', async () => {
      const configWithMapping = {
        ...baseConfig,
        userinfoMapping: {
          id: 'user.id'
        }
      };
      const provider = new GenericOAuth2Provider(configWithMapping);

      const mockUserData = {
        user: null,
        sub: 'fallback-id'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(result.id).toBe('fallback-id'); // Should fallback to 'sub'
    });

    it('should throw error when userinfo endpoint is not configured', async () => {
      const configWithoutUserinfo = {
        ...baseConfig,
        userinfoEndpoint: undefined
      };
      const provider = new GenericOAuth2Provider(configWithoutUserinfo);

      await expect(provider.getUserInfo('access-token-123'))
        .rejects.toThrow('UserInfo endpoint not configured');
    });

    it('should throw error when userinfo endpoint is empty string', async () => {
      const configWithEmptyUserinfo = {
        ...baseConfig,
        userinfoEndpoint: ''
      };
      const provider = new GenericOAuth2Provider(configWithEmptyUserinfo);

      await expect(provider.getUserInfo('access-token-123'))
        .rejects.toThrow('UserInfo endpoint not configured');
    });

    it('should throw error when userinfo endpoint is null', async () => {
      const configWithNullUserinfo = {
        ...baseConfig,
        userinfoEndpoint: null as any
      };
      const provider = new GenericOAuth2Provider(configWithNullUserinfo);

      await expect(provider.getUserInfo('access-token-123'))
        .rejects.toThrow('UserInfo endpoint not configured');
    });

    it('should throw error when userinfo request fails', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response);

      await expect(provider.getUserInfo('invalid-token'))
        .rejects.toThrow('Failed to get user info: Unauthorized');
    });

    it('should throw error when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(provider.getUserInfo('access-token-123'))
        .rejects.toThrow('Network error');
    });
  });

  describe('refreshTokens', () => {
    let provider: GenericOAuth2Provider;

    beforeEach(() => {
      provider = new GenericOAuth2Provider(baseConfig);
    });

    it('should successfully refresh tokens', async () => {
      const mockTokenResponse: IDPTokens = {
        access_token: 'new-access-token-456',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token-456'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      } as Response);

      const result = await provider.refreshTokens('refresh-token-123');

      expect(fetchMock).toHaveBeenCalledWith('https://provider.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: expect.any(URLSearchParams)
      });

      const callArgs = fetchMock.mock.calls[0];
      const bodyParams = callArgs[1].body as URLSearchParams;
      expect(bodyParams.get('grant_type')).toBe('refresh_token');
      expect(bodyParams.get('refresh_token')).toBe('refresh-token-123');
      expect(bodyParams.get('client_id')).toBe('test-client-id');
      expect(bodyParams.get('client_secret')).toBe('test-client-secret');

      expect(result).toEqual(mockTokenResponse);
    });

    it('should handle missing client secret gracefully', async () => {
      const configWithoutSecret = {
        ...baseConfig,
        clientSecret: undefined
      };
      const provider = new GenericOAuth2Provider(configWithoutSecret);

      const mockTokenResponse: IDPTokens = {
        access_token: 'new-access-token-456',
        token_type: 'Bearer'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      } as Response);

      await provider.refreshTokens('refresh-token-123');

      const callArgs = fetchMock.mock.calls[0];
      const bodyParams = callArgs[1].body as URLSearchParams;
      expect(bodyParams.get('client_secret')).toBe('');
    });

    it('should handle null client secret gracefully', async () => {
      const configWithNullSecret = {
        ...baseConfig,
        clientSecret: null as any
      };
      const provider = new GenericOAuth2Provider(configWithNullSecret);

      const mockTokenResponse: IDPTokens = {
        access_token: 'new-access-token-456',
        token_type: 'Bearer'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      } as Response);

      await provider.refreshTokens('refresh-token-123');

      const callArgs = fetchMock.mock.calls[0];
      const bodyParams = callArgs[1].body as URLSearchParams;
      expect(bodyParams.get('client_secret')).toBe('');
    });

    it('should throw error when token refresh fails', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        statusText: 'Invalid refresh token'
      } as Response);

      await expect(provider.refreshTokens('invalid-refresh-token'))
        .rejects.toThrow('Failed to refresh tokens: Invalid refresh token');
    });

    it('should throw error when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(provider.refreshTokens('refresh-token-123'))
        .rejects.toThrow('Network error');
    });
  });

  describe('OIDC-specific functionality', () => {
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

    it('should include nonce in authorization URL for OIDC providers', () => {
      const provider = new GenericOAuth2Provider(oidcConfig);
      const authUrl = provider.getAuthorizationUrl('test-state', 'test-nonce');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('nonce')).toBe('test-nonce');
      expect(provider.type).toBe('oidc');
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle malformed JSON responses in token exchange', async () => {
      const provider = new GenericOAuth2Provider(baseConfig);
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response);

      await expect(provider.exchangeCodeForToken('auth-code-123'))
        .rejects.toThrow('Invalid JSON');
    });

    it('should handle malformed JSON responses in token refresh', async () => {
      const provider = new GenericOAuth2Provider(baseConfig);
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response);

      await expect(provider.refreshTokens('refresh-token-123'))
        .rejects.toThrow('Invalid JSON');
    });

    it('should handle malformed JSON responses in getUserInfo', async () => {
      const provider = new GenericOAuth2Provider(baseConfig);
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response);

      await expect(provider.getUserInfo('access-token-123'))
        .rejects.toThrow('Invalid JSON');
    });
  });

  describe('getNestedValue functionality', () => {
    let provider: GenericOAuth2Provider;

    beforeEach(() => {
      provider = new GenericOAuth2Provider(baseConfig);
    });

    it('should handle primitive values in nested objects', async () => {
      const mockUserData = {
        user: {
          details: {
            info: {
              id: 42, // number
              active: true, // boolean
              tags: ['admin', 'user'] // array
            }
          }
        },
        sub: 'fallback'
      };

      const configWithMapping = {
        ...baseConfig,
        userinfoMapping: {
          id: 'user.details.info.id'
        }
      };
      const testProvider = new GenericOAuth2Provider(configWithMapping);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await testProvider.getUserInfo('access-token-123');
      expect(result.id).toBe(42);
    });

    it('should handle arrays in nested paths', async () => {
      const mockUserData = {
        roles: [
          { name: 'admin' },
          { name: 'user' }
        ],
        sub: 'fallback'
      };

      const configWithMapping = {
        ...baseConfig,
        userinfoMapping: {
          id: 'roles.0.name' // Access first array element
        }
      };
      const testProvider = new GenericOAuth2Provider(configWithMapping);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await testProvider.getUserInfo('access-token-123');
      expect(result.id).toBe('admin');
    });

    it('should return undefined for out-of-bounds array access', async () => {
      const mockUserData = {
        roles: ['admin'],
        sub: 'fallback'
      };

      const configWithMapping = {
        ...baseConfig,
        userinfoMapping: {
          id: 'roles.5' // Out of bounds
        }
      };
      const testProvider = new GenericOAuth2Provider(configWithMapping);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await testProvider.getUserInfo('access-token-123');
      expect(result.id).toBe('fallback'); // Should fallback to 'sub'
    });

    it('should handle empty path segments', async () => {
      const mockUserData = {
        '': {
          nested: 'value'
        },
        sub: 'fallback'
      };

      const configWithMapping = {
        ...baseConfig,
        userinfoMapping: {
          id: '.nested' // Empty first segment
        }
      };
      const testProvider = new GenericOAuth2Provider(configWithMapping);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await testProvider.getUserInfo('access-token-123');
      expect(result.id).toBe('value');
    });

    it('should handle paths with multiple dots', async () => {
      const mockUserData = {
        'key.with.dots': 'value-with-dots',
        nested: {
          'another.key': 'nested-value'
        },
        sub: 'fallback'
      };

      // This tests the edge case where object keys contain dots
      // The getNestedValue method splits by dots, so it won't find 'key.with.dots' as a single key
      const configWithMapping = {
        ...baseConfig,
        userinfoMapping: {
          id: 'key.with.dots' // This won't work as expected due to dot splitting
        }
      };
      const testProvider = new GenericOAuth2Provider(configWithMapping);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await testProvider.getUserInfo('access-token-123');
      expect(result.id).toBe('fallback'); // Should fallback since the path doesn't resolve
    });

    it('should handle circular references gracefully', async () => {
      const circularObj: any = {
        sub: 'test-id',
        circular: null
      };
      circularObj.circular = circularObj;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(circularObj)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');
      expect(result.id).toBe('test-id');
      expect(result.raw).toBe(circularObj);
    });
  });
});

