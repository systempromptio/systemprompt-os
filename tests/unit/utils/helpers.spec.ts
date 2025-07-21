/**
 * @fileoverview Unit tests for utility helpers
 * @module tests/unit/utils/helpers
 */

import { describe, it, expect } from 'vitest';

describe('Utility Helpers', () => {
  describe('String utilities', () => {
    it('should capitalize strings', () => {
      const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('WORLD')).toBe('WORLD');
      expect(capitalize('')).toBe('');
    });

    it('should trim whitespace', () => {
      const trim = (str: string) => str.trim();
      expect(trim('  hello  ')).toBe('hello');
      expect(trim('\n\tworld\r\n')).toBe('world');
    });

    it('should slugify strings', () => {
      const slugify = (str: string) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Test 123!')).toBe('test-123');
    });
  });

  describe('Array utilities', () => {
    it('should chunk arrays', () => {
      const chunk = <T>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };
      
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunk([], 3)).toEqual([]);
    });

    it('should flatten arrays', () => {
      const flatten = <T>(arr: T[][]): T[] => arr.reduce((acc, val) => acc.concat(val), []);
      expect(flatten([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]);
      expect(flatten([[]])).toEqual([]);
    });

    it('should remove duplicates', () => {
      const unique = <T>(arr: T[]): T[] => [...new Set(arr)];
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      expect(unique(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });
  });

  describe('Object utilities', () => {
    it('should deep clone objects', () => {
      const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
      const original = { a: 1, b: { c: 2 } };
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
    });

    it('should merge objects', () => {
      const merge = (target: any, source: any) => ({ ...target, ...source });
      expect(merge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
      expect(merge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
    });

    it('should pick properties', () => {
      const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
        const result = {} as Pick<T, K>;
        keys.forEach(key => {
          if (key in obj) result[key] = obj[key];
        });
        return result;
      };
      
      expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });
  });

  describe('Date utilities', () => {
    it('should format dates', () => {
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      const testDate = new Date('2024-01-15T12:00:00Z');
      expect(formatDate(testDate)).toBe('2024-01-15');
    });

    it('should calculate date differences', () => {
      const daysBetween = (date1: Date, date2: Date) => {
        const diff = Math.abs(date2.getTime() - date1.getTime());
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
      };
      
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-10');
      expect(daysBetween(date1, date2)).toBe(9);
    });
  });

  describe('Validation utilities', () => {
    it('should validate URLs', () => {
      const isValidUrl = (url: string) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };
      
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('not-a-url')).toBe(false);
    });

    it('should validate JSON', () => {
      const isValidJson = (str: string) => {
        try {
          JSON.parse(str);
          return true;
        } catch {
          return false;
        }
      };
      
      expect(isValidJson('{"valid": true}')).toBe(true);
      expect(isValidJson('invalid json')).toBe(false);
    });
  });
});