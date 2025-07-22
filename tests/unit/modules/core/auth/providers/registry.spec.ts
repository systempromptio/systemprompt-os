/**
 * Unit tests for ProviderRegistry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProviderRegistry } from '../../../../../../src/modules/core/auth/providers/registry';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';

// Mock dependencies
vi.mock('fs');
vi.mock('yaml');
vi.mock('../../../../../../src/modules/core/auth/providers/core/oauth2', () => {
  return {
    GenericOAuth2Provider: vi.fn().mockImplementation((config) => {
      return {
        id: config.id,
        name: config.name,
        type: config.issuer ? 'oidc' : 'oauth2',
        getAuthorizationUrl: vi.fn(),
        handleCallback: vi.fn(),
        refreshAccessToken: vi.fn()
      };
    })
  };
});
vi.mock('../../../../../../src/modules/core/auth/providers/core/google', () => {
  return {
    GoogleProvider: vi.fn().mockImplementation((config) => {
      return {
        id: 'google',
        name: 'Google',
        type: 'google',
        getAuthorizationUrl: vi.fn(),
        handleCallback: vi.fn(),
        refreshAccessToken: vi.fn()
      };
    })
  };
});
vi.mock('../../../../../../src/modules/core/auth/providers/core/github', () => {
  return {
    GitHubProvider: vi.fn().mockImplementation((config) => {
      return {
        id: 'github',
        name: 'GitHub',
        type: 'github',
        getAuthorizationUrl: vi.fn(),
        handleCallback: vi.fn(),
        refreshAccessToken: vi.fn()
      };
    })
  };
});

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;
  let mockLogger: any;
  const configPath = '/test/config';

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    registry = new ProviderRegistry(configPath, mockLogger);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialize', () => {
    it('should load provider configs and instantiate providers', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['google.yaml', 'github.yml', 'template.yaml']);
      vi.mocked(readFileSync).mockImplementation((path: any) => {
        if (path.includes('google')) {
          return `
id: google
name: Google
type: oauth2
enabled: true
endpoints:
  authorization: https://accounts.google.com/o/oauth2/v2/auth
  token: https://oauth2.googleapis.com/token
credentials:
  client_id: test-client-id
  client_secret: test-client-secret
  redirect_uri: http://localhost:3000/callback`;
        }
        if (path.includes('github')) {
          return `
id: github
name: GitHub
type: oauth2
enabled: true
endpoints:
  authorization: https://github.com/login/oauth/authorize
  token: https://github.com/login/oauth/access_token
credentials:
  client_id: github-client-id
  client_secret: github-client-secret
  redirect_uri: http://localhost:3000/callback`;
        }
        return '';
      });
      
      vi.mocked(parseYaml).mockImplementation((content: any) => {
        if (content.includes('google')) {
          return {
            id: 'google',
            name: 'Google',
            type: 'oauth2',
            enabled: true,
            endpoints: {
              authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
              token: 'https://oauth2.googleapis.com/token'
            },
            credentials: {
              client_id: 'test-client-id',
              client_secret: 'test-client-secret',
              redirect_uri: 'http://localhost:3000/callback'
            }
          };
        }
        if (content.includes('github')) {
          return {
            id: 'github',
            name: 'GitHub', 
            type: 'oauth2',
            enabled: true,
            endpoints: {
              authorization: 'https://github.com/login/oauth/authorize',
              token: 'https://github.com/login/oauth/access_token'
            },
            credentials: {
              client_id: 'github-client-id',
              client_secret: 'github-client-secret',
              redirect_uri: 'http://localhost:3000/callback'
            }
          };
        }
        return {};
      });

      await registry.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(`Looking for providers in: ${configPath}/providers`);
      expect(mockLogger.info).toHaveBeenCalledWith('Loaded provider config: google');
      expect(mockLogger.info).toHaveBeenCalledWith('Loaded provider config: github');
      
      // Check that providers were instantiated
      const googleProvider = registry.getProvider('google');
      const githubProvider = registry.getProvider('github');
      
      expect(googleProvider).toBeDefined();
      expect(githubProvider).toBeDefined();
    });

    it('should handle missing providers directory', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await registry.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(`Providers directory not found: ${configPath}/providers`);
    });
  });

  describe('getProvider', () => {
    it('should return provider by ID', async () => {
      // Create a manual mock provider
      const mockProvider = {
        id: 'test-provider',
        name: 'Test Provider',
        type: 'oauth2' as const,
        getAuthorizationUrl: vi.fn(),
        handleCallback: vi.fn(),
        refreshAccessToken: vi.fn()
      };
      
      // Mock the GenericOAuth2Provider to return our mock provider
      const { GenericOAuth2Provider } = await import('../../../../../../src/modules/core/auth/providers/core/oauth2');
      vi.mocked(GenericOAuth2Provider).mockImplementation(() => mockProvider);
      
      // Setup a provider
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['test.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('test config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'test-provider',
        name: 'Test Provider',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://test.com/auth',
          token: 'https://test.com/token'
        },
        credentials: {
          client_id: 'test-id',
          client_secret: 'test-secret',
          redirect_uri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();
      
      // Check that the provider was loaded into configs
      const config = registry.getProviderConfig('test-provider');
      expect(config).toBeDefined();
      expect(config?.id).toBe('test-provider');
      
      // Check that GenericOAuth2Provider was called
      expect(GenericOAuth2Provider).toHaveBeenCalled();
      
      const provider = registry.getProvider('test-provider');
      expect(provider).toBeDefined();
      expect(provider).toBe(mockProvider);
      expect(provider?.id).toBe('test-provider');
    });

    it('should return undefined for non-existent provider', () => {
      const provider = registry.getProvider('non-existent');
      expect(provider).toBeUndefined();
    });
  });

  describe('getAllProviders', () => {
    it('should return all enabled providers', async () => {
      // Create mock providers
      const mockProvider1 = {
        id: 'provider1',
        name: 'Provider 1',
        type: 'oauth2' as const,
        getAuthorizationUrl: vi.fn(),
        handleCallback: vi.fn(),
        refreshAccessToken: vi.fn()
      };
      
      const mockProvider2 = {
        id: 'provider2',
        name: 'Provider 2',
        type: 'oauth2' as const,
        getAuthorizationUrl: vi.fn(),
        handleCallback: vi.fn(),
        refreshAccessToken: vi.fn()
      };
      
      // Mock the GenericOAuth2Provider to return different providers based on config
      const { GenericOAuth2Provider } = await import('../../../../../../src/modules/core/auth/providers/core/oauth2');
      vi.mocked(GenericOAuth2Provider).mockImplementation((config: any) => {
        if (config.id === 'provider1') return mockProvider1;
        if (config.id === 'provider2') return mockProvider2;
        return mockProvider1;
      });
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['provider1.yaml', 'provider2.yaml'];
      });
      
      vi.mocked(readFileSync).mockImplementation((path: any) => {
        if (path.includes('provider1')) return 'config 1';
        if (path.includes('provider2')) return 'config 2';
        return '';
      });
      
      vi.mocked(parseYaml).mockImplementation((content: any) => {
        if (content.includes('1')) {
          return {
            id: 'provider1',
            name: 'Provider 1',
            type: 'oauth2',
            enabled: true,
            endpoints: {
              authorization: 'https://provider1.com/auth',
              token: 'https://provider1.com/token'
            },
            credentials: {
              client_id: 'provider1-client',
              client_secret: 'provider1-secret',
              redirect_uri: 'http://localhost:3000/callback'
            }
          };
        }
        if (content.includes('2')) {
          return {
            id: 'provider2',
            name: 'Provider 2',
            type: 'oauth2',
            enabled: true,
            endpoints: {
              authorization: 'https://provider2.com/auth',
              token: 'https://provider2.com/token'
            },
            credentials: {
              client_id: 'provider2-client',
              client_secret: 'provider2-secret',
              redirect_uri: 'http://localhost:3000/callback'
            }
          };
        }
        return {};
      });

      await registry.initialize();

      const providers = registry.getAllProviders();
      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.id)).toContain('provider1');
      expect(providers.map(p => p.id)).toContain('provider2');
    });

    it('should return empty array when no providers exist', () => {
      const providers = registry.getAllProviders();
      expect(providers).toEqual([]);
    });
  });

  describe('getProviderConfig', () => {
    it('should return provider configuration', async () => {
      const testConfig = {
        id: 'test-provider',
        name: 'Test',
        type: 'oauth2' as const,
        enabled: true,
        endpoints: {
          authorization: 'https://test.com/auth',
          token: 'https://test.com/token'
        },
        credentials: {
          client_id: 'test-id',
          client_secret: 'test-secret',
          redirect_uri: 'http://localhost:3000/callback'
        }
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['test.yaml']);
      vi.mocked(readFileSync).mockReturnValue('test config');
      vi.mocked(parseYaml).mockReturnValue(testConfig);

      await registry.initialize();

      const config = registry.getProviderConfig('test-provider');
      expect(config).toEqual(testConfig);
    });

    it('should return undefined for non-existent provider config', () => {
      const config = registry.getProviderConfig('non-existent');
      expect(config).toBeUndefined();
    });
  });

  describe('hasProvider', () => {
    it('should return true for existing provider', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['test.yaml']);
      vi.mocked(readFileSync).mockReturnValue('test config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'test-provider',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://test.com/auth',
          token: 'https://test.com/token'
        },
        credentials: {
          client_id: 'test-id',
          client_secret: 'test-secret',
          redirect_uri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(registry.hasProvider('test-provider')).toBe(true);
    });

    it('should return false for non-existent provider', () => {
      expect(registry.hasProvider('non-existent')).toBe(false);
    });
  });

  describe('loadCustomProviders', () => {
    it('should load custom providers from subdirectory', async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('providers');
      });
      
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) {
          return ['custom-provider.yaml'];
        }
        // Return empty array for the main providers directory
        return [];
      });

      vi.mocked(readFileSync).mockReturnValue('custom config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'custom-provider',
        name: 'Custom Provider',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://custom.com/auth',
          token: 'https://custom.com/token'
        },
        credentials: {
          client_id: 'custom-id',
          client_secret: 'custom-secret',
          redirect_uri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Loaded custom provider config: custom-provider');
      expect(registry.hasProvider('custom-provider')).toBe(true);
    });
  });

  describe('environment variable substitution', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should substitute environment variables in config', async () => {
      process.env.OAUTH_CLIENT_ID = 'env-client-id';
      process.env.OAUTH_CLIENT_SECRET = 'env-client-secret';
      process.env.BASE_URL = 'https://example.com';

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['test.yaml']);
      vi.mocked(readFileSync).mockReturnValue('test config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'test-provider',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://test.com/auth',
          token: 'https://test.com/token'
        },
        credentials: {
          client_id: '${OAUTH_CLIENT_ID}',
          client_secret: '${OAUTH_CLIENT_SECRET}',
          redirect_uri: '${OAUTH_REDIRECT_URI}'
        }
      });

      await registry.initialize();

      const config = registry.getProviderConfig('test-provider');
      expect(config?.credentials.client_id).toBe('env-client-id');
      expect(config?.credentials.client_secret).toBe('env-client-secret');
      expect(config?.credentials.redirect_uri).toBe('https://example.com/oauth2/callback');
    });

    it('should handle missing environment variables', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['test.yaml']);
      vi.mocked(readFileSync).mockReturnValue('test config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'test-provider',
        type: 'oauth2',
        endpoints: {
          authorization: 'https://test.com/auth',
          token: 'https://test.com/token'
        },
        credentials: {
          client_id: '${MISSING_VAR}',
          client_secret: 'secret',
          redirect_uri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      const config = registry.getProviderConfig('test-provider');
      expect(config?.credentials.client_id).toBe('${MISSING_VAR}');
    });
  });

  describe('error handling', () => {
    it('should handle provider loading errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['error.yaml']);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      await registry.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load provider config'),
        expect.any(Error)
      );
    });

    it('should skip providers with missing required fields', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['invalid.yaml']);
      vi.mocked(readFileSync).mockReturnValue('invalid config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'invalid-provider',
        // Missing credentials
        endpoints: {
          authorization: 'https://test.com/auth'
        }
      });

      await registry.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping provider config')
      );
      expect(registry.hasProvider('invalid-provider')).toBe(false);
    });

    it('should handle provider instantiation errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['test.yaml']);
      vi.mocked(readFileSync).mockReturnValue('test config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'test-provider',
        type: 'unknown-type', // This will cause instantiation to fail
        enabled: true,
        endpoints: {
          authorization: 'https://test.com/auth',
          token: 'https://test.com/token'
        },
        credentials: {
          client_id: 'test-id',
          client_secret: 'test-secret',
          redirect_uri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      // Unknown provider types are skipped silently
      expect(registry.hasProvider('test-provider')).toBe(false);
    });
  });

  describe('provider types', () => {
    it('should create GoogleProvider for google type', async () => {
      const { GoogleProvider } = await import('../../../../../../src/modules/core/auth/providers/core/google');
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['google.yaml']);
      vi.mocked(readFileSync).mockReturnValue('google config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'google',
        type: 'google',
        enabled: true,
        endpoints: {
          authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
          token: 'https://oauth2.googleapis.com/token'
        },
        credentials: {
          client_id: 'google-client',
          client_secret: 'google-secret',
          redirect_uri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(GoogleProvider).toHaveBeenCalled();
    });

    it('should create GitHubProvider for github type', async () => {
      const { GitHubProvider } = await import('../../../../../../src/modules/core/auth/providers/core/github');
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['github.yaml']);
      vi.mocked(readFileSync).mockReturnValue('github config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'github',
        type: 'github',
        enabled: true,
        endpoints: {
          authorization: 'https://github.com/login/oauth/authorize',
          token: 'https://github.com/login/oauth/access_token'
        },
        credentials: {
          client_id: 'github-client',
          client_secret: 'github-secret',
          redirect_uri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(GitHubProvider).toHaveBeenCalled();
    });

    it('should create GenericOAuth2Provider for oauth2 type', async () => {
      const { GenericOAuth2Provider } = await import('../../../../../../src/modules/core/auth/providers/core/oauth2');
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['generic.yaml']);
      vi.mocked(readFileSync).mockReturnValue('generic config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'generic',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://auth.example.com/authorize',
          token: 'https://auth.example.com/token'
        },
        credentials: {
          client_id: 'generic-client',
          client_secret: 'generic-secret',
          redirect_uri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(GenericOAuth2Provider).toHaveBeenCalled();
    });
  });
});