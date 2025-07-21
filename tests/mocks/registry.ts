/**
 * @fileoverview Shared mocks for module registry
 * @module tests/mocks/registry
 */

import { vi } from 'vitest';

export const mockRegistry = {
  register: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
  has: vi.fn().mockReturnValue(false),
  initializeAll: vi.fn().mockResolvedValue(undefined),
  shutdownAll: vi.fn().mockResolvedValue(undefined)
};

export function setupRegistryMocks() {
  vi.mock('@/modules/registry.js', () => ({
    ModuleRegistry: vi.fn().mockImplementation(() => mockRegistry)
  }));
}