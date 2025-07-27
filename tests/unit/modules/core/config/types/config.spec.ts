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

    it('should have exactly 4 enum members', () => {
      const enumKeys = Object.keys(ConfigSource).filter(k => isNaN(Number(k)));
      expect(enumKeys).toHaveLength(4);
    });

    it('should have all string type values', () => {
      expect(typeof ConfigSource.DEFAULT).toBe('string');
      expect(typeof ConfigSource.FILE).toBe('string');
      expect(typeof ConfigSource.ENVIRONMENT).toBe('string');
      expect(typeof ConfigSource.RUNTIME).toBe('string');
    });

    it('should provide all values via Object.values()', () => {
      const enumValues = Object.values(ConfigSource);
      expect(enumValues).toEqual(['default', 'file', 'environment', 'runtime']);
      expect(enumValues).toHaveLength(4);
    });

    it('should be iterable and contain all expected values', () => {
      const expectedValues = ['default', 'file', 'environment', 'runtime'];
      const actualValues: string[] = [];
      
      for (const key in ConfigSource) {
        if (ConfigSource.hasOwnProperty(key)) {
          actualValues.push(ConfigSource[key as keyof typeof ConfigSource]);
        }
      }
      
      expect(actualValues.sort()).toEqual(expectedValues.sort());
    });

    it('should handle non-existent enum access gracefully', () => {
      const nonExistentKey = 'NON_EXISTENT' as keyof typeof ConfigSource;
      expect(ConfigSource[nonExistentKey]).toBeUndefined();
    });

    it('should verify enum properties are accessible', () => {
      // Test that enum properties exist and are readable
      expect(ConfigSource.DEFAULT).toBeDefined();
      expect(ConfigSource.FILE).toBeDefined();
      expect(ConfigSource.ENVIRONMENT).toBeDefined();
      expect(ConfigSource.RUNTIME).toBeDefined();
      
      // Test property descriptors (if available)
      const descriptor = Object.getOwnPropertyDescriptor(ConfigSource, 'DEFAULT');
      expect(descriptor).toBeDefined();
      expect(descriptor?.value).toBe('default');
    });

    it('should support switch statement usage', () => {
      const testSource = ConfigSource.FILE;
      let result: string;

      switch (testSource) {
        case ConfigSource.DEFAULT:
          result = 'default-case';
          break;
        case ConfigSource.FILE:
          result = 'file-case';
          break;
        case ConfigSource.ENVIRONMENT:
          result = 'environment-case';
          break;
        case ConfigSource.RUNTIME:
          result = 'runtime-case';
          break;
        default:
          result = 'unknown-case';
      }

      expect(result).toBe('file-case');
    });

    it('should support equality comparisons', () => {
      expect(ConfigSource.DEFAULT === 'default').toBe(true);
      expect(ConfigSource.FILE === 'file').toBe(true);
      expect(ConfigSource.ENVIRONMENT === 'environment').toBe(true);
      expect(ConfigSource.RUNTIME === 'runtime').toBe(true);
      
      // Cross-comparisons should be false
      expect(ConfigSource.DEFAULT === ConfigSource.FILE).toBe(false);
      expect(ConfigSource.ENVIRONMENT === ConfigSource.RUNTIME).toBe(false);
    });

    it('should work with array includes method', () => {
      const validSources = [ConfigSource.DEFAULT, ConfigSource.FILE];
      
      expect(validSources.includes(ConfigSource.DEFAULT)).toBe(true);
      expect(validSources.includes(ConfigSource.FILE)).toBe(true);
      expect(validSources.includes(ConfigSource.ENVIRONMENT)).toBe(false);
      expect(validSources.includes(ConfigSource.RUNTIME)).toBe(false);
    });
  });
});