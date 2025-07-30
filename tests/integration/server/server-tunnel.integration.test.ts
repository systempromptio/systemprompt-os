/**
 * Server Tunnel Integration Test
 * 
 * Tests server integration with tunnel service:
 * - UrlConfigService integration
 * - Tunnel URL discovery and usage
 * - OAuth callback URL configuration
 * 
 * Coverage targets:
 * - src/server/index.ts
 * - src/modules/core/system/services/url-config.service.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Express } from 'express';
import type { Server } from 'http';
import { runBootstrap } from '@/bootstrap';
import { createApp } from '@/server/index';
import { UrlConfigService } from '@/modules/core/system/services/url-config.service';
import { SystemService } from '@/modules/core/system/services/system.service';
import { SystemConfigType } from '@/modules/core/system/types/index';

describe('Server Tunnel Integration Tests', () => {
  let app: Express;
  let server: Server;
  let bootstrap: any;
  let urlConfigService: UrlConfigService;
  let systemService: SystemService;

  beforeAll(async () => {
    // Mock environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_PATH = ':memory:';
    process.env.DISABLE_DB_LOGGING = 'true';
    
    // Bootstrap the application
    bootstrap = await runBootstrap();
    
    // Get service instances
    urlConfigService = UrlConfigService.getInstance();
    systemService = SystemService.getInstance();
  });

  beforeEach(async () => {
    // Clear any cached URL configuration
    urlConfigService.clearCache();
    
    // Clean up any existing tunnel configuration
    try {
      await systemService.deleteConfig('system.url.tunnel');
      await systemService.deleteConfig('system.url.base');
    } catch (error) {
      // Ignore if configs don't exist
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    if (bootstrap?.stop) {
      await bootstrap.stop();
    }
  });

  describe('Basic Server Creation', () => {
    it('should create Express app successfully', async () => {
      app = await createApp();
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    it('should start server on specified port', async () => {
      app = await createApp();
      
      server = await new Promise<Server>((resolve) => {
        const testServer = app.listen(0, () => {
          resolve(testServer);
        });
      });

      expect(server.listening).toBe(true);
      
      const address = server.address();
      expect(address).toBeTruthy();
      expect(typeof address).toBe('object');
      if (address && typeof address === 'object') {
        expect(address.port).toBeGreaterThan(0);
      }
    });
  });

  describe('URL Configuration Service Integration', () => {
    it('should initialize and use UrlConfigService', async () => {
      await urlConfigService.initialize();
      
      const config = await urlConfigService.getUrlConfig();
      expect(config).toBeDefined();
      expect(config.baseUrl).toBeDefined();
      expect(config.oauthCallbackBaseUrl).toBeDefined();
      expect(typeof config.isSecure).toBe('boolean');
      expect(typeof config.isDevelopment).toBe('boolean');
    });

    it('should provide default localhost URLs in test environment', async () => {
      // Ensure no tunnel URL is configured
      await systemService.deleteConfig('system.url.tunnel');
      await systemService.deleteConfig('system.url.base');
      
      urlConfigService.clearCache();
      
      const baseUrl = await urlConfigService.getBaseUrl();
      const oauthUrl = await urlConfigService.getOAuthCallbackBaseUrl();
      
      expect(baseUrl).toBe('http://localhost:3000');
      expect(oauthUrl).toBe('http://localhost:3000');
    });

    it('should use tunnel URL when configured in system settings', async () => {
      const tunnelUrl = 'https://example-tunnel.cloudflareaccess.com';
      
      // Set tunnel URL in system configuration
      await systemService.setConfig(
        'system.url.tunnel',
        tunnelUrl,
        SystemConfigType.STRING,
        'Test tunnel URL'
      );
      
      // Clear cache to force refresh
      urlConfigService.clearCache();
      
      const config = await urlConfigService.getUrlConfig();
      const baseUrl = await urlConfigService.getBaseUrl();
      const oauthUrl = await urlConfigService.getOAuthCallbackBaseUrl();
      
      expect(config.baseUrl).toBe(tunnelUrl);
      expect(config.tunnelUrl).toBe(tunnelUrl);
      expect(baseUrl).toBe(tunnelUrl);
      expect(oauthUrl).toBe(tunnelUrl);
    });

    it('should use environment variable tunnel URL', async () => {
      const tunnelUrl = 'https://env-tunnel.example.com';
      
      // Set tunnel URL via environment variable
      process.env.TUNNEL_URL = tunnelUrl;
      
      try {
        // Clear cache to force refresh
        urlConfigService.clearCache();
        
        const config = await urlConfigService.getUrlConfig();
        const baseUrl = await urlConfigService.getBaseUrl();
        
        expect(config.baseUrl).toBe(tunnelUrl);
        expect(config.tunnelUrl).toBe(tunnelUrl);
        expect(baseUrl).toBe(tunnelUrl);
      } finally {
        delete process.env.TUNNEL_URL;
      }
    });

    it('should prioritize tunnel URL over base URL configuration', async () => {
      const baseUrl = 'https://base-domain.example.com';
      const tunnelUrl = 'https://tunnel-domain.cloudflareaccess.com';
      
      // Set both base and tunnel URLs
      await systemService.setConfig(
        'system.url.base',
        baseUrl,
        SystemConfigType.STRING,
        'Test base URL'
      );
      await systemService.setConfig(
        'system.url.tunnel',
        tunnelUrl,
        SystemConfigType.STRING,
        'Test tunnel URL'
      );
      
      // Clear cache to force refresh
      urlConfigService.clearCache();
      
      const config = await urlConfigService.getUrlConfig();
      
      // Tunnel URL should take priority
      expect(config.baseUrl).toBe(tunnelUrl);
      expect(config.tunnelUrl).toBe(tunnelUrl);
    });
  });

  describe('URL Normalization and Validation', () => {
    it('should normalize tunnel URLs without protocols', async () => {
      const tunnelDomain = 'example-tunnel.cloudflareaccess.com';
      const expectedUrl = `https://${tunnelDomain}`;
      
      // Set tunnel URL without protocol
      await systemService.setConfig(
        'system.url.tunnel',
        tunnelDomain,
        SystemConfigType.STRING,
        'Test tunnel domain'
      );
      
      // Clear cache to force refresh
      urlConfigService.clearCache();
      
      const baseUrl = await urlConfigService.getBaseUrl();
      
      expect(baseUrl).toBe(expectedUrl);
    });

    it('should normalize tunnel URLs with trailing slashes', async () => {
      const tunnelUrl = 'https://example-tunnel.cloudflareaccess.com/';
      const expectedUrl = 'https://example-tunnel.cloudflareaccess.com';
      
      // Set tunnel URL with trailing slash
      await systemService.setConfig(
        'system.url.tunnel',
        tunnelUrl,
        SystemConfigType.STRING,
        'Test tunnel URL with slash'
      );
      
      // Clear cache to force refresh
      urlConfigService.clearCache();
      
      const baseUrl = await urlConfigService.getBaseUrl();
      
      expect(baseUrl).toBe(expectedUrl);
    });

    it('should handle secure vs insecure URLs correctly', async () => {
      const httpUrl = 'http://insecure-tunnel.example.com';
      const httpsUrl = 'https://secure-tunnel.example.com';
      
      // Test HTTP URL
      await systemService.setConfig(
        'system.url.tunnel',
        httpUrl,
        SystemConfigType.STRING,
        'HTTP tunnel URL'
      );
      urlConfigService.clearCache();
      
      let config = await urlConfigService.getUrlConfig();
      expect(config.isSecure).toBe(false);
      
      // Test HTTPS URL
      await systemService.setConfig(
        'system.url.tunnel',
        httpsUrl,
        SystemConfigType.STRING,
        'HTTPS tunnel URL'
      );
      urlConfigService.clearCache();
      
      config = await urlConfigService.getUrlConfig();
      expect(config.isSecure).toBe(true);
    });
  });

  describe('OAuth2 Callback URL Integration', () => {
    it('should provide correct OAuth2 callback URLs with tunnel', async () => {
      const tunnelUrl = 'https://oauth-tunnel.example.com';
      
      // Set tunnel URL
      await systemService.setConfig(
        'system.url.tunnel',
        tunnelUrl,
        SystemConfigType.STRING,
        'OAuth tunnel URL'
      );
      
      // Clear cache to force refresh
      urlConfigService.clearCache();
      
      const callbackBaseUrl = await urlConfigService.getOAuthCallbackBaseUrl();
      const providerCallbackUrl = await urlConfigService.getProviderCallbackUrl('google');
      
      expect(callbackBaseUrl).toBe(tunnelUrl);
      expect(providerCallbackUrl).toBe(`${tunnelUrl}/oauth2/callback/google`);
    });

    it('should use localhost for OAuth callbacks when no tunnel configured', async () => {
      // Ensure no tunnel URL
      await systemService.deleteConfig('system.url.tunnel');
      urlConfigService.clearCache();
      
      const callbackBaseUrl = await urlConfigService.getOAuthCallbackBaseUrl();
      const providerCallbackUrl = await urlConfigService.getProviderCallbackUrl('github');
      
      expect(callbackBaseUrl).toBe('http://localhost:3000');
      expect(providerCallbackUrl).toBe('http://localhost:3000/oauth2/callback/github');
    });
  });

  describe('Configuration Caching', () => {
    it('should cache URL configuration for performance', async () => {
      const tunnelUrl = 'https://cached-tunnel.example.com';
      
      // Set tunnel URL
      await systemService.setConfig(
        'system.url.tunnel',
        tunnelUrl,
        SystemConfigType.STRING,
        'Cached tunnel URL'
      );
      
      // Clear cache and get config multiple times
      urlConfigService.clearCache();
      
      const config1 = await urlConfigService.getUrlConfig();
      const config2 = await urlConfigService.getUrlConfig();
      
      // Should return same object (cached)
      expect(config1).toEqual(config2);
      expect(config1.baseUrl).toBe(tunnelUrl);
      expect(config2.baseUrl).toBe(tunnelUrl);
    });

    it('should refresh cache when explicitly cleared', async () => {
      const initialUrl = 'https://initial-tunnel.example.com';
      const updatedUrl = 'https://updated-tunnel.example.com';
      
      // Set initial tunnel URL
      await systemService.setConfig(
        'system.url.tunnel',
        initialUrl,
        SystemConfigType.STRING,
        'Initial tunnel URL'
      );
      urlConfigService.clearCache();
      
      const config1 = await urlConfigService.getUrlConfig();
      expect(config1.baseUrl).toBe(initialUrl);
      
      // Update tunnel URL
      await systemService.setConfig(
        'system.url.tunnel',
        updatedUrl,
        SystemConfigType.STRING,
        'Updated tunnel URL'
      );
      
      // Should still return cached value
      const config2 = await urlConfigService.getUrlConfig();
      expect(config2.baseUrl).toBe(initialUrl);
      
      // Clear cache and check for updated value
      urlConfigService.clearCache();
      const config3 = await urlConfigService.getUrlConfig();
      expect(config3.baseUrl).toBe(updatedUrl);
    });
  });
});