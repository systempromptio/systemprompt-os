/**
 * @fileoverview Unit tests for auth singleton
 * @module tests/unit/modules/core/auth/singleton
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthModule } from '@/modules/core/auth/singleton.js';
import { getModuleLoader } from '@/modules/loader.js';
import { setupAuthMocks } from '../../../../mocks/auth.js';
import { setupDatabaseMocks } from '../../../../mocks/database.js';
import { setupFilesystemMocks } from '../../../../mocks/filesystem.js';

// Don't mock the AuthModule itself
setupDatabaseMocks();
setupFilesystemMocks();

// Mock the module loader
const mockAuthModule = {
  name: 'auth',
  initialize: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' })
};

vi.mock('@/modules/loader.js', () => ({
  getModuleLoader: vi.fn(() => ({
    getModule: vi.fn((name) => name === 'auth' ? mockAuthModule : null)
  }))
}));

describe('Auth Singleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the auth module', () => {
    const authModule = getAuthModule();
    expect(authModule).toBe(mockAuthModule);
  });

  it('should throw error when auth module not loaded', () => {
    vi.mocked(getModuleLoader).mockReturnValueOnce({
      getModule: vi.fn().mockReturnValue(null)
    });
    
    expect(() => getAuthModule()).toThrow('Auth module not loaded');
  });

  it('should have auth module methods', () => {
    const authModule = getAuthModule();
    expect(authModule).toHaveProperty('name');
    expect(authModule).toHaveProperty('initialize');
    expect(authModule).toHaveProperty('start');
    expect(authModule).toHaveProperty('stop');
    expect(authModule).toHaveProperty('healthCheck');
  });
});