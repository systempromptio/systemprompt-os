import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ServerConfig } from '../../../src/server/types';

describe('ServerConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('default configuration', () => {
    it('should load default configuration values', async () => {
      // Clear all env vars
      vi.stubEnv('PORT', '');
      vi.stubEnv('NODEENV', '');
      
      const { CONFIG } = await import('../../../src/server/config');

      // Assert
      expect(CONFIG.PORT).toBe('3000');
      expect(CONFIG.NODEENV).toBe('development');
      expect(CONFIG.JWTISSUER).toBe('systemprompt-os');
      expect(CONFIG.SERVERNAME).toBe('systemprompt-os');
      expect(CONFIG.SERVERVERSION).toBe('0.1.0');
    });

    it('should have correct token expiry defaults', async () => {
      const { CONFIG } = await import('../../../src/server/config');
      
      expect(CONFIG.ACCESSTOKEN_EXPIRY).toBe('1h');
      expect(CONFIG.REFRESHTOKEN_EXPIRY).toBe('30d');
      expect(CONFIG.AUTHORIZATIONCODE_EXPIRY).toBe('10m');
    });
  });

  describe('environment variable overrides', () => {
    it('should use environment variables when set', async () => {
      // Set environment variables
      vi.stubEnv('PORT', '8080');
      vi.stubEnv('NODEENV', 'production');
      vi.stubEnv('JWTISSUER', 'my-app');
      vi.stubEnv('JWTAUDIENCE', 'my-audience');
      vi.stubEnv('LOGLEVEL', 'debug');
      
      const { CONFIG } = await import('../../../src/server/config');

      expect(CONFIG.PORT).toBe('8080');
      expect(CONFIG.NODEENV).toBe('production');
      expect(CONFIG.JWTISSUER).toBe('my-app');
      expect(CONFIG.JWTAUDIENCE).toBe('my-audience');
      expect(CONFIG.LOGLEVEL).toBe('debug');
    });

    it('should parse numeric environment variables', async () => {
      vi.stubEnv('BCRYPTROUNDS', '12');
      vi.stubEnv('LOGMAX_FILES', '10');
      
      const { CONFIG } = await import('../../../src/server/config');

      expect(CONFIG.BCRYPTROUNDS).toBe(12);
      expect(CONFIG.LOGMAX_FILES).toBe(10);
    });

    it('should construct BASEURL from PORT', async () => {
      // Clear any existing BASE_URL/BASEURL
      vi.stubEnv('BASE_URL', '');
      vi.stubEnv('BASEURL', '');
      vi.stubEnv('PORT', '4000');
      
      const { CONFIG } = await import('../../../src/server/config');

      expect(CONFIG.BASEURL).toBe('http://localhost:4000');
    });

    it('should use custom BASEURL when provided', async () => {
      vi.stubEnv('BASE_URL', 'https://api.example.com');
      
      const { CONFIG } = await import('../../../src/server/config');

      expect(CONFIG.BASEURL).toBe('https://api.example.com');
    });
  });

  describe('CONFIG proxy behavior', () => {
    it('should always return fresh values', async () => {
      vi.stubEnv('PORT', '3000');
      const { CONFIG } = await import('../../../src/server/config');
      
      expect(CONFIG.PORT).toBe('3000');
      
      // Change environment
      vi.stubEnv('PORT', '4000');
      
      // Should immediately reflect the change
      expect(CONFIG.PORT).toBe('4000');
    });

    it('should prevent modification', async () => {
      const { CONFIG } = await import('../../../src/server/config');
      
      expect(() => {
        (CONFIG as any).PORT = '5000';
      }).toThrow('CONFIG is read-only');
    });
  });

  describe('production validation', () => {
    it('should warn when BASEURL contains localhost in production', async () => {
      const originalWarn = console.warn;
      const warnSpy = vi.fn();
      console.warn = warnSpy;
      
      vi.stubEnv('NODEENV', 'production');
      vi.stubEnv('BASEURL', 'http://localhost:3000');
      
      // Clear module cache to force re-import with new env vars
      vi.resetModules();
      const { validateConfig } = await import('../../../src/server/config');
      validateConfig();
      
      expect(warnSpy).toHaveBeenCalledWith('WARNING: BASEURL contains localhost in production');
      
      console.warn = originalWarn;
    });

    it('should not warn when BASEURL is valid in production', async () => {
      const originalWarn = console.warn;
      const warnSpy = vi.fn();
      console.warn = warnSpy;
      
      vi.stubEnv('NODEENV', 'production');
      vi.stubEnv('BASEURL', 'https://example.com');
      
      // Clear module cache to force re-import with new env vars
      vi.resetModules();
      const { validateConfig } = await import('../../../src/server/config');
      validateConfig();
      
      expect(warnSpy).not.toHaveBeenCalled();
      
      console.warn = originalWarn;
    });
  });

  describe('configuration validation', () => {
    it('should validate required fields are present', async () => {
      const { CONFIG, validateConfig } = await import('../../../src/server/config');
      
      // Should not throw in development
      expect(() => validateConfig()).not.toThrow();
      
      // All required fields should be present
      expect(CONFIG.PORT).toBeDefined();
      expect(CONFIG.JWTISSUER).toBeDefined();
      expect(CONFIG.JWTAUDIENCE).toBeDefined();
      expect(CONFIG.SERVERNAME).toBeDefined();
    });
  });
});