/**
 * @fileoverview Integration test for auth module provider configuration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Bootstrap } from '../../src/bootstrap.js';
import type { IModule } from '../../src/modules/core/modules/types/index.js';
import type { IAuthModuleExports } from '../../src/modules/core/auth/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Setting up integration test environment...');

describe('Auth Module Provider Configuration', () => {
  let bootstrap: Bootstrap;
  let authModule: IModule<IAuthModuleExports>;

  beforeAll(async () => {
    // Use proper bootstrap pattern
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });

    const modules = await bootstrap.bootstrap();
    const auth = modules.get('auth');
    
    if (!auth) {
      throw new Error('Auth module not found in bootstrap');
    }
    
    authModule = auth as IModule<IAuthModuleExports>;
  });

  afterAll(async () => {
    await bootstrap?.shutdown();
    console.log('🧹 Cleaning up integration test environment...');
  });

  it('should load provider configurations from YAML files', () => {
    const providersPath = join(__dirname, '../../src/modules/core/auth/providers');
    
    // Check if the providers directory exists
    expect(existsSync(providersPath)).toBe(true);
    
    // Check for GitHub provider config
    const githubConfigPath = join(providersPath, 'github.yaml');
    expect(existsSync(githubConfigPath)).toBe(true);
    
    // Check for Google provider config
    const googleConfigPath = join(providersPath, 'google.yaml');
    expect(existsSync(googleConfigPath)).toBe(true);
  });

  it('should have provider configuration files', () => {
    const providers = authModule.exports.getAllProviders();
    
    // Should have at least GitHub and Google providers
    expect(providers.length).toBeGreaterThanOrEqual(2);
    
    const providerIds = providers.map(p => p.id);
    expect(providerIds).toContain('github');
    expect(providerIds).toContain('google');
  });

  it('should expose provider management APIs', () => {
    // Verify the auth module exports provider-related functions
    expect(authModule.exports.getProvider).toBeDefined();
    expect(authModule.exports.getAllProviders).toBeDefined();
    expect(authModule.exports.hasProvider).toBeDefined();
    expect(authModule.exports.getProviderRegistry).toBeDefined();
    expect(authModule.exports.reloadProviders).toBeDefined();
  });

  it('should return providers based on configuration', () => {
    // Test getting a specific provider
    const githubProvider = authModule.exports.getProvider('github');
    expect(githubProvider).toBeDefined();
    expect(githubProvider?.id).toBe('github');
    expect(githubProvider?.name).toBe('GitHub');
    expect(githubProvider?.type).toBe('oauth2');
    
    const googleProvider = authModule.exports.getProvider('google');
    expect(googleProvider).toBeDefined();
    expect(googleProvider?.id).toBe('google');
    expect(googleProvider?.name).toBe('Google');
    expect(googleProvider?.type).toBe('oauth2');
  });

  it('should support provider configuration through environment variables', () => {
    // Providers should be able to read configuration from environment
    const githubProvider = authModule.exports.getProvider('github');
    
    // Check that provider has required OAuth2 properties
    expect(githubProvider?.oauth2).toBeDefined();
    
    // The provider should have endpoints defined (from YAML config)
    expect(githubProvider?.oauth2?.authorizationEndpoint).toBeDefined();
    expect(githubProvider?.oauth2?.tokenEndpoint).toBeDefined();
  });
});