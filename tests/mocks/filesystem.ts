/**
 * @fileoverview Shared mocks for filesystem operations
 * @module tests/mocks/filesystem
 */

import { vi } from 'vitest';

export const mockFs = {
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([])
};

export function setupFilesystemMocks() {
  vi.mock('fs', () => mockFs);
}