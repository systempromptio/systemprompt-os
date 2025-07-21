/**
 * @fileoverview Shared mocks for database module
 * @module tests/mocks/database
 */

import { vi } from 'vitest';

export const mockDatabase = {
  query: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  run: vi.fn().mockResolvedValue({ changes: 1 }),
  all: vi.fn().mockResolvedValue([]),
  prepare: vi.fn().mockReturnValue({
    run: vi.fn().mockResolvedValue({ changes: 1 }),
    get: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue([])
  })
};

export function setupDatabaseMocks() {
  vi.mock('@/modules/core/database/index.js', () => ({
    getDatabase: vi.fn().mockReturnValue(mockDatabase),
    initializeDatabase: vi.fn().mockResolvedValue(undefined)
  }));
}