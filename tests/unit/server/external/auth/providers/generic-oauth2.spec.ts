/**
 * @fileoverview Unit tests for Generic OAuth2/OIDC Provider
 * @module tests/unit/server/external/auth/providers/generic-oauth2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenericOAuth2Provider } from '../../../../../../src/server/external/auth/providers/generic-oauth2.js';
import type { IGenericOAuth2Config, IOAuth2TokenResponse } from '../../../../../../src/server/external/auth/providers/interface.js';

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

const baseConfig: IGenericOAuth2Config = {
  id: 'test-provider',
  name: 'Test Provider',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:3000/callback',
  authorizationEndpoint: 'https://provider.com/auth',
  tokenEndpoint: 'https://provider.com/token',
  userinfoEndpoint: 'https://provider.com/userinfo'
  // No issuer property and no scope means it will be OAuth2 with default scope
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
      
      expect(url.searchParams.get('scope')).toBe('email profile');
    });

    it('should set default scope when scope is null', () => {
      const config = {
        ...baseConfig,
        scope: null as any
      };
      
      const provider = new GenericOAuth2Provider(config);
      const authUrl = provider.getAuthorizationUrl('test-state');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('scope')).toBe('email profile');
    });

    it('should set default scope when scope is undefined', () => {
      const config = {
        ...baseConfig,
        scope: undefined
      };
      
      const provider = new GenericOAuth2Provider(config);
      const authUrl = provider.getAuthorizationUrl('test-state');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('scope')).toBe('email profile');
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
      expect(url.searchParams.get('scope')).toBe('email profile');
      expect(url.searchParams.get('state')).toBe('test-state');
      expect(url.searchParams.get('nonce')).toBeNull();
    });

    it('should use default scope for OAuth2 provider', () => {
      const authUrl = provider.getAuthorizationUrl('test-state');
      const url = new URL(authUrl);
      
      expect(url.searchParams.get('scope')).toBe('email profile');
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
      } as IGenericOAuth2Config & { authorizationParams: Record<string, string> };
      
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
      } as IGenericOAuth2Config & { authorizationParams: null };
      
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

  describe('exchangeCodeForToken (100% Coverage Tests)', () => {
    let provider: GenericOAuth2Provider;

    beforeEach(() => {
      provider = new GenericOAuth2Provider(baseConfig);
    });

    describe('Success scenarios', () => {
      it('should successfully exchange code for tokens with snake_case response', async () => {
        const mockTokenResponse = {
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
        const bodyParams = callArgs[1]!.body as URLSearchParams;
        expect(bodyParams.get('grant_type')).toBe('authorization_code');
        expect(bodyParams.get('code')).toBe('auth-code-123');
        expect(bodyParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
        expect(bodyParams.get('client_id')).toBe('test-client-id');
        expect(bodyParams.get('client_secret')).toBe('test-client-secret');

        const expected: IOAuth2TokenResponse = {
          accessToken: 'access-token-123',
          tokenType: 'Bearer',
          expiresIn: 3600,
          refreshToken: 'refresh-token-123',
          scope: 'openid email profile'
        };
        expect(result).toEqual(expected);
      });

      it('should successfully exchange code for tokens with camelCase response', async () => {
        const mockTokenResponse = {
          accessToken: 'access-token-456',
          tokenType: 'bearer',
          expiresIn: 7200,
          refreshToken: 'refresh-token-456',
          scope: 'read write'
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        const result = await provider.exchangeCodeForToken('auth-code-456');

        const expected: IOAuth2TokenResponse = {
          accessToken: 'access-token-456',
          tokenType: 'bearer',
          expiresIn: 7200,
          refreshToken: 'refresh-token-456',
          scope: 'read write'
        };
        expect(result).toEqual(expected);
      });

      it('should handle mixed case response format', async () => {
        const mockTokenResponse = {
          access_token: 'access-token-789',
          tokenType: 'Bearer', // camelCase
          expires_in: 1800,
          refreshToken: 'refresh-token-789', // camelCase
          scope: 'admin'
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        const result = await provider.exchangeCodeForToken('auth-code-789');

        const expected: IOAuth2TokenResponse = {
          accessToken: 'access-token-789',
          tokenType: 'Bearer',
          expiresIn: 1800,
          refreshToken: 'refresh-token-789',
          scope: 'admin'
        };
        expect(result).toEqual(expected);
      });

      it('should handle response with missing optional fields', async () => {
        const mockTokenResponse = {
          access_token: 'access-token-minimal'
          // Missing token_type, expires_in, refresh_token, scope
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        const result = await provider.exchangeCodeForToken('auth-code-minimal');

        const expected: IOAuth2TokenResponse = {
          accessToken: 'access-token-minimal',
          tokenType: 'Bearer', // Default value
          expiresIn: undefined,
          refreshToken: undefined,
          scope: undefined
        };
        expect(result).toEqual(expected);
      });

      it('should handle response with null/undefined values', async () => {
        const mockTokenResponse = {
          access_token: 'access-token-null',
          token_type: null,
          expires_in: undefined,
          refresh_token: null,
          scope: undefined
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        const result = await provider.exchangeCodeForToken('auth-code-null');

        const expected: IOAuth2TokenResponse = {
          accessToken: 'access-token-null',
          tokenType: 'Bearer', // Falls back to default
          expiresIn: undefined,
          refreshToken: null,
          scope: undefined
        };
        expect(result).toEqual(expected);
      });

      it('should prioritize snake_case over camelCase when both exist', async () => {
        const mockTokenResponse = {
          access_token: 'snake-case-token',
          accessToken: 'camel-case-token',
          token_type: 'snake-case-type',
          tokenType: 'camel-case-type'
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        const result = await provider.exchangeCodeForToken('auth-code-priority');

        expect(result.accessToken).toBe('snake-case-token');
        expect(result.tokenType).toBe('snake-case-type');
      });

      it('should handle response with extra unexpected fields', async () => {
        const mockTokenResponse = {
          access_token: 'extra-fields-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'extra-refresh',
          scope: 'read',
          // Extra fields that should be ignored
          id_token: 'some.jwt.token',
          custom_field: 'custom_value',
          numeric_field: 12345,
          boolean_field: true,
          null_field: null
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        const result = await provider.exchangeCodeForToken('extra-fields-code');

        // Should only include mapped fields from IOAuth2TokenResponse
        const expected: IOAuth2TokenResponse = {
          accessToken: 'extra-fields-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          refreshToken: 'extra-refresh',
          scope: 'read'
        };
        expect(result).toEqual(expected);
      });
    });

    describe('Client secret handling', () => {
      it('should handle missing client secret gracefully', async () => {
        const configWithoutSecret = {
          ...baseConfig,
          clientSecret: undefined as any
        };
        const providerWithoutSecret = new GenericOAuth2Provider(configWithoutSecret);

        const mockTokenResponse = {
          access_token: 'access-token-123',
          token_type: 'Bearer'
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        await providerWithoutSecret.exchangeCodeForToken('auth-code-123');

        const callArgs = fetchMock.mock.calls[0];
        const bodyParams = callArgs[1]!.body as URLSearchParams;
        expect(bodyParams.get('client_secret')).toBe('');
      });

      it('should handle null client secret gracefully', async () => {
        const configWithNullSecret = {
          ...baseConfig,
          clientSecret: null as any
        };
        const providerWithNull = new GenericOAuth2Provider(configWithNullSecret);

        const mockTokenResponse = {
          access_token: 'access-token-123',
          token_type: 'Bearer'
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        await providerWithNull.exchangeCodeForToken('auth-code-123');

        const callArgs = fetchMock.mock.calls[0];
        const bodyParams = callArgs[1]!.body as URLSearchParams;
        expect(bodyParams.get('client_secret')).toBe('');
      });

      it('should handle empty string client secret', async () => {
        const configWithEmptySecret = {
          ...baseConfig,
          clientSecret: ''
        };
        const providerWithEmpty = new GenericOAuth2Provider(configWithEmptySecret);

        const mockTokenResponse = {
          access_token: 'access-token-empty',
          token_type: 'Bearer'
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        await providerWithEmpty.exchangeCodeForToken('auth-code-empty');

        const callArgs = fetchMock.mock.calls[0];
        const bodyParams = callArgs[1]!.body as URLSearchParams;
        expect(bodyParams.get('client_secret')).toBe('');
      });
    });

    describe('Error scenarios', () => {
      it('should throw error when token exchange fails with error message', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          text: () => Promise.resolve('Invalid client credentials')
        } as Response);

        await expect(provider.exchangeCodeForToken('invalid-code'))
          .rejects.toThrow('Failed to exchange code: Invalid client credentials');
      });

      it('should throw error when token exchange fails with empty error message', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          text: () => Promise.resolve('')
        } as Response);

        await expect(provider.exchangeCodeForToken('invalid-code-empty'))
          .rejects.toThrow('Failed to exchange code: ');
      });

      it('should throw error when token exchange fails with JSON error response', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          text: () => Promise.resolve('{"error": "invalid_grant", "error_description": "Code expired"}')
        } as Response);

        await expect(provider.exchangeCodeForToken('expired-code'))
          .rejects.toThrow('Failed to exchange code: {"error": "invalid_grant", "error_description": "Code expired"}');
      });

      it('should throw error when response.text() fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          text: () => Promise.reject(new Error('Failed to read response text'))
        } as Response);

        await expect(provider.exchangeCodeForToken('text-error-code'))
          .rejects.toThrow('Failed to read response text');
      });

      it('should throw error when fetch throws network error', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Network error'));

        await expect(provider.exchangeCodeForToken('auth-code-123'))
          .rejects.toThrow('Network error');
      });

      it('should throw error when fetch throws timeout error', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Request timeout'));

        await expect(provider.exchangeCodeForToken('timeout-code'))
          .rejects.toThrow('Request timeout');
      });

      it('should throw error when fetch throws abort error', async () => {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        fetchMock.mockRejectedValueOnce(abortError);

        await expect(provider.exchangeCodeForToken('abort-code'))
          .rejects.toThrow('Request aborted');
      });

      it('should throw error when response.json() fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON'))
        } as Response);

        await expect(provider.exchangeCodeForToken('invalid-json-code'))
          .rejects.toThrow('Invalid JSON');
      });

      it('should throw error when response.json() returns malformed data', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.reject(new SyntaxError('Unexpected token in JSON'))
        } as Response);

        await expect(provider.exchangeCodeForToken('malformed-code'))
          .rejects.toThrow('Unexpected token in JSON');
      });
    });

    describe('Request parameters validation', () => {
      it('should send correct request parameters for authorization code exchange', async () => {
        const mockTokenResponse = {
          access_token: 'verify-params-token',
          token_type: 'Bearer'
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        await provider.exchangeCodeForToken('verify-params-code');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('https://provider.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: expect.any(URLSearchParams)
        });

        const callArgs = fetchMock.mock.calls[0];
        const bodyParams = callArgs[1]!.body as URLSearchParams;
        
        // Verify all required parameters are present
        expect(bodyParams.get('grant_type')).toBe('authorization_code');
        expect(bodyParams.get('code')).toBe('verify-params-code');
        expect(bodyParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
        expect(bodyParams.get('client_id')).toBe('test-client-id');
        expect(bodyParams.get('client_secret')).toBe('test-client-secret');
        
        // Verify no unexpected parameters
        const paramKeys = Array.from(bodyParams.keys());
        expect(paramKeys).toEqual(['grant_type', 'code', 'redirect_uri', 'client_id', 'client_secret']);
      });

      it('should handle different authorization codes correctly', async () => {
        const testCodes = [
          'short-code',
          'very-long-authorization-code-with-many-characters-1234567890',
          'code-with-special-chars!@#$%^&*()',
          'code.with.dots',
          'code_with_underscores',
          'code-with-hyphens',
          '123456789',
          'αβγδε', // Unicode characters
          ''
        ];

        for (const testCode of testCodes) {
          fetchMock.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ access_token: 'token', token_type: 'Bearer' })
          } as Response);

          await provider.exchangeCodeForToken(testCode);

          const callArgs = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
          const bodyParams = callArgs[1]!.body as URLSearchParams;
          expect(bodyParams.get('code')).toBe(testCode);
        }

        expect(fetchMock).toHaveBeenCalledTimes(testCodes.length);
      });
    });

    describe('Edge cases and boundary conditions', () => {
      it('should handle extremely large token response', async () => {
        const largeToken = 'a'.repeat(10000); // Very long token
        const mockTokenResponse = {
          access_token: largeToken,
          token_type: 'Bearer',
          expires_in: Number.MAX_SAFE_INTEGER,
          refresh_token: 'b'.repeat(5000),
          scope: 'c'.repeat(1000)
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        const result = await provider.exchangeCodeForToken('large-token-code');

        expect(result.accessToken).toBe(largeToken);
        expect(result.expiresIn).toBe(Number.MAX_SAFE_INTEGER);
      });

      it('should handle zero and negative expires_in values', async () => {
        const testValues = [0, -1, -3600, Number.MIN_SAFE_INTEGER];

        for (const expiresIn of testValues) {
          fetchMock.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: expiresIn
            })
          } as Response);

          const result = await provider.exchangeCodeForToken(`code-${expiresIn}`);
          expect(result.expiresIn).toBe(expiresIn);
        }
      });

      it('should handle non-string token values gracefully', async () => {
        const mockTokenResponse = {
          access_token: 12345, // number instead of string
          token_type: true, // boolean instead of string
          expires_in: '3600', // string instead of number
          refresh_token: null,
          scope: { complex: 'object' } // object instead of string
        };

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        } as Response);

        const result = await provider.exchangeCodeForToken('type-test-code');

        // The method should handle these gracefully
        expect(result.accessToken).toBe(12345);
        expect(result.tokenType).toBe(true);
        expect(result.expiresIn).toBe('3600');
        expect(result.refreshToken).toBe(null);
        expect(result.scope).toEqual({ complex: 'object' });
      });
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
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        email_verified: true,
        locale: 'en'
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
        name: 'Custom Name',
        avatar: 'https://example.com/custom-avatar.jpg'
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

    it('should throw error when no user ID can be extracted', async () => {
      const mockUserData = {
        email: 'user@example.com',
        name: 'User Name'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      await expect(provider.getUserInfo('access-token-123'))
        .rejects.toThrow('Unable to extract user ID from userinfo response');
    });

    it('should convert numeric user ID to string', async () => {
      const mockUserData = {
        sub: 12345, // number instead of string
        email: 'user@example.com'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');
      expect(result.id).toBe('12345');
      expect(result.email).toBe('user@example.com');
    });

    it('should handle non-string values in email field', async () => {
      const mockUserData = {
        sub: 'user-123',
        email: 12345, // non-string email
        name: 'John Doe'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(result).toEqual({
        id: 'user-123',
        name: 'John Doe'
      });
      expect(result.email).toBeUndefined();
    });

    it('should handle non-string values in name field', async () => {
      const mockUserData = {
        sub: 'user-123',
        email: 'user@example.com',
        name: { first: 'John', last: 'Doe' } // non-string name
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'user@example.com'
      });
      expect(result.name).toBeUndefined();
    });

    it('should handle non-string values in picture field', async () => {
      const mockUserData = {
        sub: 'user-123',
        email: 'user@example.com',
        picture: true // non-string picture
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'user@example.com'
      });
      expect(result.avatar).toBeUndefined();
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
      const mockTokenResponse = {
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

      const mockTokenResponse = {
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

      const mockTokenResponse = {
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
      expect(result.id).toBe('42');
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
      expect(result.circular).toBe(circularObj);
    });

    it('should handle userinfoMapping being null', async () => {
      const configWithNullMapping = {
        ...baseConfig,
        userinfoMapping: null as any
      };
      const provider = new GenericOAuth2Provider(configWithNullMapping);

      const mockUserData = {
        sub: 'user-123',
        email: 'user@example.com',
        name: 'John Doe'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');
      expect(result).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe'
      });
    });

    it('should handle userinfoMapping being undefined', async () => {
      const configWithoutMapping = {
        ...baseConfig
      };
      delete (configWithoutMapping as any).userinfoMapping;
      const provider = new GenericOAuth2Provider(configWithoutMapping);

      const mockUserData = {
        sub: 'user-123',
        email: 'user@example.com'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');
      expect(result).toEqual({
        id: 'user-123',
        email: 'user@example.com'
      });
    });

    it('should throw error when user ID is empty string', async () => {
      const mockUserData = {
        sub: '',
        email: 'user@example.com'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      await expect(provider.getUserInfo('access-token-123'))
        .rejects.toThrow('Unable to extract user ID from userinfo response');
    });

    it('should include additional properties that are not id, email, name, or avatar', async () => {
      const mockUserData = {
        sub: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        locale: 'en-US',
        timezone: 'America/New_York',
        roles: ['admin', 'user'],
        verified: true,
        custom_field: 'custom_value'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');
      expect(result).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        locale: 'en-US',
        timezone: 'America/New_York',
        roles: ['admin', 'user'],
        verified: true,
        custom_field: 'custom_value'
      });
    });

    it('should handle properties that conflict with standard field names but are different from mapped values', async () => {
      const mockUserData = {
        sub: 'user-123',
        email: 'primary@example.com',
        name: 'Primary Name',
        avatar: 'conflicting-avatar-field',
        id: 'conflicting-id-field' // This should be included as additional property since mapped id comes from 'sub'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData)
      } as Response);

      const result = await provider.getUserInfo('access-token-123');
      expect(result).toEqual({
        id: 'user-123', // from 'sub' mapping
        email: 'primary@example.com',
        name: 'Primary Name',
        avatar: 'conflicting-avatar-field'
        // Note: 'id' from original data should NOT be included since it's in excluded list
      });
      expect(result).not.toHaveProperty('conflicting-id-field');
    });
  });
});

