/**
 * @fileoverview Shared mocks for auth module
 * @module tests/mocks/auth
 */

import { vi } from 'vitest';

export const mockProviderRegistry = {
  initialize: vi.fn().mockResolvedValue(undefined),
  listProviderIds: vi.fn().mockReturnValue([]),
  getAllProviders: vi.fn().mockReturnValue([]),
  getProvider: vi.fn().mockReturnValue(undefined),
  hasProvider: vi.fn().mockReturnValue(false),
  reload: vi.fn().mockResolvedValue(undefined)
};

export const mockTunnelService = {
  start: vi.fn().mockResolvedValue('https://example.com'),
  stop: vi.fn().mockResolvedValue(undefined),
  getStatus: vi.fn().mockReturnValue({ active: false, type: 'none' }),
  getPublicUrl: vi.fn().mockReturnValue('http://localhost:3000'),
  updateOAuthProviders: vi.fn().mockResolvedValue(undefined)
};

export const mockAuthModule = {
  name: 'auth',
  version: '1.0.0',
  type: 'service',
  initialize: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
  getProviderRegistry: vi.fn().mockReturnValue(mockProviderRegistry),
  getProvider: vi.fn().mockReturnValue(undefined),
  getAllProviders: vi.fn().mockReturnValue([]),
  hasProvider: vi.fn().mockReturnValue(false),
  reloadProviders: vi.fn().mockResolvedValue(undefined),
  getPublicUrl: vi.fn().mockReturnValue('http://localhost:3000'),
  getTunnelStatus: vi.fn().mockReturnValue({ active: false, type: 'none' })
};

export function setupAuthMocks(includeAuthModule = true) {
  vi.mock('@/modules/core/auth/providers/registry.js', () => ({
    ProviderRegistry: vi.fn().mockImplementation(() => mockProviderRegistry)
  }));

  vi.mock('@/modules/core/auth/services/tunnel-service.js', () => ({
    TunnelService: vi.fn().mockImplementation(() => mockTunnelService)
  }));

  if (includeAuthModule) {
    vi.mock('@/modules/core/auth/index.js', () => ({
      AuthModule: vi.fn().mockImplementation(() => mockAuthModule)
    }));
  }

  vi.mock('@/modules/core/auth/singleton.js', () => ({
    getAuthModule: vi.fn().mockReturnValue(mockAuthModule)
  }));
}