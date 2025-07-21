/**
 * @fileoverview Shared mocks for logger
 * @module tests/mocks/logger
 */

import { vi } from 'vitest';

export const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
};

export function setupLoggerMocks() {
  vi.mock('@/utils/logger.js', () => ({
    logger: mockLogger,
    setModuleRegistry: vi.fn()
  }));
}