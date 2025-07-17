import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Server Config', () => {
  beforeEach(() => {
    // Reset modules and environment before each test
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('should load default configuration values', async () => {
    // Import config dynamically to ensure fresh module
    const { CONFIG } = await import('../../src/server/config.js');
    
    expect(CONFIG.PORT).toBe('3000');
    expect(CONFIG.NODE_ENV).toBeDefined();
    expect(CONFIG.JWT_ISSUER).toBe('systemprompt-os');
    expect(CONFIG.JWT_AUDIENCE).toBe('systemprompt-os-clients');
    expect(CONFIG.BCRYPT_ROUNDS).toBe(10);
  });

  it('should use environment variables when set', async () => {
    // Set environment variables
    vi.stubEnv('PORT', '8080');
    vi.stubEnv('JWT_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('BCRYPT_ROUNDS', '12');
    
    // Import config after setting env vars
    const { CONFIG } = await import('../../src/server/config.js');
    
    expect(CONFIG.PORT).toBe('8080');
    expect(CONFIG.JWT_SECRET).toBe('test-secret');
    expect(CONFIG.NODE_ENV).toBe('test');
    expect(CONFIG.BCRYPT_ROUNDS).toBe(12);
  });

  it('should construct BASE_URL from PORT', async () => {
    vi.stubEnv('PORT', '4000');
    
    const { CONFIG } = await import('../../src/server/config.js');
    
    expect(CONFIG.BASE_URL).toBeDefined();
  });

  it('should throw error in production without JWT_SECRET', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'change-this-in-production');
    
    await expect(async () => {
      await import('../../src/server/config.js');
    }).rejects.toThrow('JWT_SECRET must be set in production');
  });

  it('should have correct token expiry defaults', async () => {
    const { CONFIG } = await import('../../src/server/config.js');
    
    expect(CONFIG.ACCESS_TOKEN_EXPIRY).toBe('1h');
    expect(CONFIG.REFRESH_TOKEN_EXPIRY).toBe('30d');
    expect(CONFIG.AUTHORIZATION_CODE_EXPIRY).toBe('10m');
  });
});