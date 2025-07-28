/**
 * Unit tests for ProviderRegistry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProviderRegistry } from '../../../../../../src/modules/core/auth/providers/registry.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';

// Mock dependencies
vi.mock('fs');
vi.mock('yaml');

// Mock global fetch for OIDC discovery
global.fetch = vi.fn();
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

  describe('constructor', () => {
    it('should initialize with logger', () => {
      const registryWithLogger = new ProviderRegistry(configPath, mockLogger);
      expect(registryWithLogger).toBeDefined();
      // Verify private properties are set correctly
      expect(registryWithLogger.hasProvider('any')).toBe(false);
    });

    it('should initialize without logger', () => {
      const registryWithoutLogger = new ProviderRegistry(configPath);
      expect(registryWithoutLogger).toBeDefined();
      expect(registryWithoutLogger.hasProvider('any')).toBe(false);
    });
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
  clientId: test-client-id
  clientSecret: test-client-secret
  redirectUri: http://localhost:3000/callback`;
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
  clientId: github-client-id
  clientSecret: github-client-secret
  redirectUri: http://localhost:3000/callback`;
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
              clientId: 'test-client-id',
              clientSecret: 'test-client-secret',
              redirectUri: 'http://localhost:3000/callback'
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
              clientId: 'github-client-id',
              clientSecret: 'github-client-secret',
              redirectUri: 'http://localhost:3000/callback'
            }
          };
        }
        return {};
      });

      await registry.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('auth', `Looking for providers in: ${configPath}`);
      expect(mockLogger.info).toHaveBeenCalledWith('auth', 'Loaded provider config: google');
      expect(mockLogger.info).toHaveBeenCalledWith('auth', 'Loaded provider config: github');
      
      // Check that providers were instantiated
      const googleProvider = registry.getProvider('google');
      const githubProvider = registry.getProvider('github');
      
      expect(googleProvider).toBeDefined();
      expect(githubProvider).toBeDefined();
    });

    it('should handle missing providers directory', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await registry.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith('auth', `Providers directory not found: ${configPath}`);
    });

    it('should skip disabled providers', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['disabled.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('disabled config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'disabled-provider',
        name: 'Disabled Provider',
        type: 'oauth2',
        enabled: false,
        endpoints: {
          authorization: 'https://disabled.com/auth',
          token: 'https://disabled.com/token'
        },
        credentials: {
          clientId: 'disabled-id',
          clientSecret: 'disabled-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      // Should not load disabled provider
      expect(registry.hasProvider('disabled-provider')).toBe(false);
      expect(registry.getProvider('disabled-provider')).toBeUndefined();
    });

    it('should skip providers with empty credentials', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['empty-creds.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('empty creds config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'empty-creds-provider',
        name: 'Empty Creds Provider',
        type: 'oauth2',
        endpoints: {
          authorization: 'https://empty.com/auth',
          token: 'https://empty.com/token'
        },
        credentials: {
          clientId: '',
          clientSecret: '',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      // Should not load provider with empty credentials
      expect(registry.hasProvider('empty-creds-provider')).toBe(false);
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
          clientId: 'test-id',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:3000/callback'
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
              clientId: 'provider1-client',
              clientSecret: 'provider1-secret',
              redirectUri: 'http://localhost:3000/callback'
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
              clientId: 'provider2-client',
              clientSecret: 'provider2-secret',
              redirectUri: 'http://localhost:3000/callback'
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
          clientId: 'test-id',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:3000/callback'
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
          clientId: 'test-id',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(registry.hasProvider('test-provider')).toBe(true);
    });

    it('should return false for non-existent provider', () => {
      expect(registry.hasProvider('non-existent')).toBe(false);
    });
  });

  describe('listProviderIds', () => {
    it('should return array of provider IDs', async () => {
      const { GenericOAuth2Provider } = await import('../../../../../../src/modules/core/auth/providers/core/oauth2');
      
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
            type: 'oauth2',
            enabled: true,
            endpoints: {
              authorization: 'https://provider1.com/auth',
              token: 'https://provider1.com/token'
            },
            credentials: {
              clientId: 'provider1-client',
              clientSecret: 'provider1-secret',
              redirectUri: 'http://localhost:3000/callback'
            }
          };
        }
        if (content.includes('2')) {
          return {
            id: 'provider2',
            type: 'oauth2',
            enabled: true,
            endpoints: {
              authorization: 'https://provider2.com/auth',
              token: 'https://provider2.com/token'
            },
            credentials: {
              clientId: 'provider2-client',
              clientSecret: 'provider2-secret',
              redirectUri: 'http://localhost:3000/callback'
            }
          };
        }
        return {};
      });

      await registry.initialize();

      const providerIds = registry.listProviderIds();
      expect(providerIds).toHaveLength(2);
      expect(providerIds).toContain('provider1');
      expect(providerIds).toContain('provider2');
    });

    it('should return empty array when no providers exist', () => {
      const providerIds = registry.listProviderIds();
      expect(providerIds).toEqual([]);
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
          clientId: 'custom-id',
          clientSecret: 'custom-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('auth', 'Loaded custom provider config: custom-provider');
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
          clientId: '${OAUTH_CLIENT_ID}',
          clientSecret: '${OAUTH_CLIENT_SECRET}',
          redirectUri: '${OAUTH_REDIRECT_URI}'
        }
      });

      await registry.initialize();

      const config = registry.getProviderConfig('test-provider');
      expect(config?.credentials.clientId).toBe('env-client-id');
      expect(config?.credentials.clientSecret).toBe('env-client-secret');
      expect(config?.credentials.redirectUri).toBe('https://example.com/oauth2/callback');
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
          clientId: '${MISSING_VAR}',
          clientSecret: 'secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      const config = registry.getProviderConfig('test-provider');
      expect(config?.credentials.clientId).toBe('${MISSING_VAR}');
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
        'auth',
        expect.stringContaining('Failed to load provider config'),
        expect.any(Object)
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
        'auth',
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
          clientId: 'test-id',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:3000/callback'
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
          clientId: 'google-client',
          clientSecret: 'google-secret',
          redirectUri: 'http://localhost:3000/callback'
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
          clientId: 'github-client',
          clientSecret: 'github-secret',
          redirectUri: 'http://localhost:3000/callback'
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
          clientId: 'generic-client',
          clientSecret: 'generic-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(GenericOAuth2Provider).toHaveBeenCalled();
    });
  });

  describe('reload', () => {
    it('should clear and reinitialize providers', async () => {
      // First, load some providers
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['provider1.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'provider1',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://provider1.com/auth',
          token: 'https://provider1.com/token'
        },
        credentials: {
          clientId: 'provider1-client',
          clientSecret: 'provider1-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();
      
      // Verify provider exists
      expect(registry.hasProvider('provider1')).toBe(true);
      expect(registry.listProviderIds()).toHaveLength(1);

      // Now simulate different files for reload
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['provider2.yaml'];
      });
      vi.mocked(parseYaml).mockReturnValue({
        id: 'provider2',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://provider2.com/auth',
          token: 'https://provider2.com/token'
        },
        credentials: {
          clientId: 'provider2-client',
          clientSecret: 'provider2-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.reload();

      // Old provider should be gone, new one loaded
      expect(registry.hasProvider('provider1')).toBe(false);
      expect(registry.hasProvider('provider2')).toBe(true);
      expect(registry.listProviderIds()).toHaveLength(1);
      expect(registry.listProviderIds()).toContain('provider2');
    });

    it('should handle reload errors gracefully', async () => {
      // First load a provider successfully
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['provider1.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'provider1',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://provider1.com/auth',
          token: 'https://provider1.com/token'
        },
        credentials: {
          clientId: 'provider1-client',
          clientSecret: 'provider1-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();
      expect(registry.hasProvider('provider1')).toBe(true);

      // Simulate error during reload
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });

      await registry.reload();

      // All providers should be cleared, error should be logged
      expect(registry.hasProvider('provider1')).toBe(false);
      expect(registry.listProviderIds()).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'auth',
        expect.stringContaining('Failed to load provider config'),
        expect.any(Object)
      );
    });
  });

  describe('credential validation and auto-enabling', () => {
    it('should auto-enable provider with valid credentials', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['valid-creds.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('valid config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'valid-provider',
        type: 'oauth2',
        // enabled is not set, should be auto-enabled due to valid credentials
        endpoints: {
          authorization: 'https://valid.com/auth',
          token: 'https://valid.com/token'
        },
        credentials: {
          clientId: 'valid-client-id',
          clientSecret: 'valid-client-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      const config = registry.getProviderConfig('valid-provider');
      expect(config?.enabled).toBe(true);
      expect(registry.hasProvider('valid-provider')).toBe(true);
    });

    it('should not auto-enable provider with whitespace-only credentials', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['whitespace-creds.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('whitespace config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'whitespace-provider',
        type: 'oauth2',
        endpoints: {
          authorization: 'https://whitespace.com/auth',
          token: 'https://whitespace.com/token'
        },
        credentials: {
          clientId: '   ',  // Only whitespace
          clientSecret: '\t\n',  // Only whitespace
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(registry.hasProvider('whitespace-provider')).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'auth',
        expect.stringContaining('Skipping provider config')
      );
    });
  });

  describe('OIDC discovery functionality', () => {
    beforeEach(() => {
      vi.mocked(fetch).mockClear();
    });

    it('should successfully enrich provider with OIDC discovery', async () => {
      const mockDiscoveryResponse = {
        issuer: 'https://oidc.example.com',
        authorization_endpoint: 'https://oidc.example.com/auth',
        token_endpoint: 'https://oidc.example.com/token',
        userinfo_endpoint: 'https://oidc.example.com/userinfo',
        jwks_uri: 'https://oidc.example.com/jwks',
        scopes_supported: ['openid', 'profile', 'email'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        token_endpoint_auth_methods_supported: ['client_secret_basic']
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDiscoveryResponse
      } as Response);

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['oidc-provider.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('oidc config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'oidc-provider',
        type: 'oidc',
        enabled: true,
        endpoints: {
          discovery: 'https://oidc.example.com/.well-known/openid-configuration'
        },
        credentials: {
          clientId: 'oidc-client',
          clientSecret: 'oidc-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(fetch).toHaveBeenCalledWith('https://oidc.example.com/.well-known/openid-configuration');
      expect(registry.hasProvider('oidc-provider')).toBe(true);
    });

    it('should handle OIDC discovery failure gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['oidc-failed.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('oidc config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'oidc-failed',
        type: 'oidc',
        enabled: true,
        endpoints: {
          discovery: 'https://invalid.example.com/.well-known/openid-configuration',
          authorization: 'https://fallback.com/auth',
          token: 'https://fallback.com/token'
        },
        credentials: {
          clientId: 'oidc-client',
          clientSecret: 'oidc-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'auth',
        expect.stringContaining('Failed to discover OIDC config for oidc-failed'),
        expect.any(Object)
      );
      // Provider should still be created with fallback endpoints
      expect(registry.hasProvider('oidc-failed')).toBe(true);
    });

    it('should handle fetch network errors during discovery', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['oidc-network-error.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('oidc config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'oidc-network-error',
        type: 'oidc',
        enabled: true,
        endpoints: {
          discovery: 'https://network-error.example.com/.well-known/openid-configuration',
          authorization: 'https://fallback.com/auth',
          token: 'https://fallback.com/token'
        },
        credentials: {
          clientId: 'oidc-client',
          clientSecret: 'oidc-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to discover OIDC config for oidc-network-error'),
        expect.any(Object)
      );
    });

    it('should extract issuer from discovery URL correctly', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['oidc-issuer.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('oidc config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'oidc-issuer',
        type: 'oidc',
        enabled: true,
        endpoints: {
          discovery: 'https://issuer.example.com/.well-known/openid-configuration'
        },
        credentials: {
          clientId: 'oidc-client',
          clientSecret: 'oidc-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      // Mock successful discovery
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issuer: 'https://issuer.example.com',
          authorization_endpoint: 'https://issuer.example.com/auth',
          token_endpoint: 'https://issuer.example.com/token'
        })
      } as Response);

      await registry.initialize();

      expect(registry.hasProvider('oidc-issuer')).toBe(true);
    });

    it('should not perform discovery for non-OIDC providers', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['oauth2-provider.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('oauth2 config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'oauth2-provider',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://oauth2.example.com/auth',
          token: 'https://oauth2.example.com/token'
        },
        credentials: {
          clientId: 'oauth2-client',
          clientSecret: 'oauth2-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(fetch).not.toHaveBeenCalled();
      expect(registry.hasProvider('oauth2-provider')).toBe(true);
    });

    it('should not perform discovery when discovery URL is empty', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['oidc-no-discovery.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('oidc config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'oidc-no-discovery',
        type: 'oidc',
        enabled: true,
        endpoints: {
          discovery: '',  // Empty discovery URL
          authorization: 'https://oidc.example.com/auth',
          token: 'https://oidc.example.com/token'
        },
        credentials: {
          clientId: 'oidc-client',
          clientSecret: 'oidc-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(fetch).not.toHaveBeenCalled();
      expect(registry.hasProvider('oidc-no-discovery')).toBe(true);
    });
  });

  describe('provider creation edge cases', () => {
    it('should handle provider with optional fields', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['provider-with-optional.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('config with optional fields');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'provider-with-optional',
        name: 'Provider With Optional Fields',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://optional.com/auth',
          token: 'https://optional.com/token',
          userinfo: 'https://optional.com/userinfo',
          jwks: 'https://optional.com/jwks'
        },
        credentials: {
          clientId: 'optional-client',
          clientSecret: 'optional-secret',
          redirectUri: 'http://localhost:3000/callback'
        },
        scopes: ['openid', 'profile', 'email'],
        userinfoMapping: {
          id: 'sub',
          email: 'email',
          name: 'name'
        }
      });

      await registry.initialize();

      expect(registry.hasProvider('provider-with-optional')).toBe(true);
    });

    it('should handle provider with empty optional string fields', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['provider-empty-optional.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('config with empty optional');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'provider-empty-optional',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://empty.com/auth',
          token: 'https://empty.com/token',
          userinfo: '',  // Empty string
          jwks: '   '    // Whitespace only
        },
        credentials: {
          clientId: 'empty-client',
          clientSecret: 'empty-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(registry.hasProvider('provider-empty-optional')).toBe(true);
    });

    it('should handle provider instantiation errors in createProvider', async () => {
      const { GenericOAuth2Provider } = await import('../../../../../../src/modules/core/auth/providers/core/oauth2');
      
      // Mock GenericOAuth2Provider to throw an error
      vi.mocked(GenericOAuth2Provider).mockImplementation(() => {
        throw new Error('Provider instantiation failed');
      });

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['failing-provider.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('failing config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'failing-provider',
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://failing.com/auth',
          token: 'https://failing.com/token'
        },
        credentials: {
          clientId: 'failing-client',
          clientSecret: 'failing-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to instantiate provider failing-provider'),
        expect.any(Object)
      );
      expect(registry.hasProvider('failing-provider')).toBe(false);
    });

    it('should handle missing ID in config', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['no-id.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('no id config');
      vi.mocked(parseYaml).mockReturnValue({
        // id is missing
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://noid.com/auth',
          token: 'https://noid.com/token'
        },
        credentials: {
          clientId: 'noid-client',
          clientSecret: 'noid-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping provider config'),
        expect.stringContaining('missing required fields')
      );
    });

    it('should handle empty ID in config', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['empty-id.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('empty id config');
      vi.mocked(parseYaml).mockReturnValue({
        id: '',  // Empty ID
        type: 'oauth2',
        enabled: true,
        endpoints: {
          authorization: 'https://emptyid.com/auth',
          token: 'https://emptyid.com/token'
        },
        credentials: {
          clientId: 'emptyid-client',
          clientSecret: 'emptyid-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping provider config'),
        expect.stringContaining('missing required fields')
      );
    });

    it('should filter out template.yaml files', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['template.yaml', 'valid-provider.yaml'];
      });
      vi.mocked(readFileSync).mockImplementation((path: any) => {
        if (path.includes('template.yaml')) return 'template config';
        return 'valid config';
      });
      vi.mocked(parseYaml).mockImplementation((content: any) => {
        if (content.includes('template')) {
          return {
            id: 'template-provider',
            type: 'oauth2',
            enabled: true,
            endpoints: {
              authorization: 'https://template.com/auth',
              token: 'https://template.com/token'
            },
            credentials: {
              clientId: 'template-client',
              clientSecret: 'template-secret',
              redirectUri: 'http://localhost:3000/callback'
            }
          };
        }
        return {
          id: 'valid-provider',
          type: 'oauth2',
          enabled: true,
          endpoints: {
            authorization: 'https://valid.com/auth',
            token: 'https://valid.com/token'
          },
          credentials: {
            clientId: 'valid-client',
            clientSecret: 'valid-secret',
            redirectUri: 'http://localhost:3000/callback'
          }
        };
      });

      await registry.initialize();

      // Template should be ignored, only valid provider loaded
      expect(registry.hasProvider('template-provider')).toBe(false);
      expect(registry.hasProvider('valid-provider')).toBe(true);
      expect(registry.listProviderIds()).toHaveLength(1);
    });

    it('should handle unsupported provider types gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.includes('custom')) return [];
        return ['unsupported.yaml'];
      });
      vi.mocked(readFileSync).mockReturnValue('unsupported config');
      vi.mocked(parseYaml).mockReturnValue({
        id: 'unsupported-provider',
        type: 'unsupported-type',
        enabled: true,
        endpoints: {
          authorization: 'https://unsupported.com/auth',
          token: 'https://unsupported.com/token'
        },
        credentials: {
          clientId: 'unsupported-client',
          clientSecret: 'unsupported-secret',
          redirectUri: 'http://localhost:3000/callback'
        }
      });

      await registry.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported provider type unsupported-type for unsupported-provider')
      );
      expect(registry.hasProvider('unsupported-provider')).toBe(false);
    });
  });
});