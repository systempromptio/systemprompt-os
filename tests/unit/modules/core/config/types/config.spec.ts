/**
 * @fileoverview Unit tests for configuration types
 * @module tests/unit/modules/core/config/types
 */

import { describe, it, expect } from 'vitest';
import { ConfigSource } from '@/modules/core/config/types/config.js';

describe('Configuration Types', () => {
  describe('ConfigSource Enum', () => {
    it('should have correct enum values', () => {
      expect(ConfigSource.DEFAULT).toBe('default');
      expect(ConfigSource.FILE).toBe('file');
      expect(ConfigSource.ENVIRONMENT).toBe('environment');
      expect(ConfigSource.RUNTIME).toBe('runtime');
    });

    it('should have all expected enum keys', () => {
      const expectedKeys = ['DEFAULT', 'FILE', 'ENVIRONMENT', 'RUNTIME'];
      const actualKeys = Object.keys(ConfigSource).filter(k => isNaN(Number(k)));
      expect(actualKeys).toEqual(expectedKeys);
    });

    it('should have correct string values', () => {
      // TypeScript enums don't support reverse lookup for string enums
      // We can only check the values
      expect(ConfigSource.DEFAULT).toBe('default');
      expect(ConfigSource.FILE).toBe('file');
      expect(ConfigSource.ENVIRONMENT).toBe('environment');
      expect(ConfigSource.RUNTIME).toBe('runtime');
    });
  });
});