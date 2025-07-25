/**
 * @fileoverview Unit tests for JSON Schema to Zod converter
 * @module tests/unit/utils/json-schema-to-zod
 */

import { describe, it, expect } from 'vitest';
import { jsonSchemaToZod } from '../../../src/utils/json-schema-to-zod';
import { z } from 'zod';

describe('jsonSchemaToZod', () => {
  describe('basic types', () => {
    it('should convert string type', () => {
      const schema = { type: 'string' };
      const zodSchema = jsonSchemaToZod(schema);
      
      expect(zodSchema.parse('hello')).toBe('hello');
      expect(() => zodSchema.parse(123)).toThrow();
    });

    it('should convert number type', () => {
      const schema = { type: 'number' };
      const zodSchema = jsonSchemaToZod(schema);
      
      expect(zodSchema.parse(123)).toBe(123);
      expect(zodSchema.parse(45.67)).toBe(45.67);
      expect(() => zodSchema.parse('123')).toThrow();
    });

    it('should convert boolean type', () => {
      const schema = { type: 'boolean' };
      const zodSchema = jsonSchemaToZod(schema);
      
      expect(zodSchema.parse(true)).toBe(true);
      expect(zodSchema.parse(false)).toBe(false);
      expect(() => zodSchema.parse('true')).toThrow();
    });

    it('should convert array type', () => {
      const schema = { 
        type: 'array',
        items: { type: 'string' }
      };
      const zodSchema = jsonSchemaToZod(schema);
      
      expect(zodSchema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
      expect(zodSchema.parse([])).toEqual([]);
      expect(() => zodSchema.parse(['a', 123])).toThrow();
    });

    it('should handle array without items', () => {
      const schema = { type: 'array' };
      const zodSchema = jsonSchemaToZod(schema);
      
      expect(zodSchema.parse([1, 'two', true])).toEqual([1, 'two', true]);
    });
  });

  describe('enums', () => {
    it('should convert string enums', () => {
      const schema = {
        type: 'string',
        enum: ['active', 'inactive', 'pending']
      };
      const zodSchema = jsonSchemaToZod(schema);
      
      expect(zodSchema.parse('active')).toBe('active');
      expect(zodSchema.parse('pending')).toBe('pending');
      expect(() => zodSchema.parse('unknown')).toThrow();
    });
  });

  describe('objects', () => {
    it('should convert simple object', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };
      const zodSchema = jsonSchemaToZod(schema);
      
      const result = zodSchema.parse({ name: 'John', age: 30 });
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should handle required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        },
        required: ['id']
      };
      const zodSchema = jsonSchemaToZod(schema);
      
      expect(zodSchema.parse({ id: '123' })).toEqual({ id: '123' });
      expect(zodSchema.parse({ id: '123', name: 'Test' })).toEqual({ id: '123', name: 'Test' });
      expect(() => zodSchema.parse({ name: 'Test' })).toThrow();
    });

    it('should handle default values', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number', default: 0 },
          active: { type: 'boolean', default: true }
        }
      };
      const zodSchema = jsonSchemaToZod(schema);
      
      // Optional fields with defaults are still optional, not auto-filled
      expect(zodSchema.parse({})).toEqual({});
      expect(zodSchema.parse({ count: 10 })).toEqual({ count: 10 });
      expect(zodSchema.parse({ count: 10, active: false })).toEqual({ count: 10, active: false });
    });

    it('should handle nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' }
            },
            required: ['name']
          }
        }
      };
      const zodSchema = jsonSchemaToZod(schema);
      
      expect(zodSchema.parse({
        user: { name: 'John', email: 'john@example.com' }
      })).toEqual({
        user: { name: 'John', email: 'john@example.com' }
      });
    });

    it('should handle objects with enum properties', () => {
      const schema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'published', 'archived']
          }
        }
      };
      const zodSchema = jsonSchemaToZod(schema);
      
      expect(zodSchema.parse({ status: 'published' })).toEqual({ status: 'published' });
      expect(() => zodSchema.parse({ status: 'deleted' })).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should return z.any() for null schema', () => {
      const zodSchema = jsonSchemaToZod(null);
      expect(zodSchema.parse('anything')).toBe('anything');
      expect(zodSchema.parse(123)).toBe(123);
    });

    it('should return z.any() for undefined schema', () => {
      const zodSchema = jsonSchemaToZod(undefined);
      expect(zodSchema.parse('anything')).toBe('anything');
    });

    it('should return z.any() for non-object schema', () => {
      const zodSchema = jsonSchemaToZod('string');
      expect(zodSchema.parse('anything')).toBe('anything');
    });

    it('should return z.any() for unknown type', () => {
      const schema = { type: 'unknown' };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema.parse('anything')).toBe('anything');
    });

    it('should handle empty object schema', () => {
      const schema = { type: 'object' };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema.parse({ any: 'thing' })).toEqual({ any: 'thing' });
    });

    it('should handle object without type but with properties', () => {
      const schema = {
        properties: {
          name: { type: 'string' }
        }
      };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema.parse({ name: 'test' })).toEqual({ name: 'test' });
    });
  });

  describe('complex examples', () => {
    it('should handle MCP tool-like schema', () => {
      const schema = {
        type: 'object',
        properties: {
          command: { type: 'string' },
          args: {
            type: 'array',
            items: { type: 'string' }
          },
          options: {
            type: 'object',
            properties: {
              timeout: { type: 'number', default: 30000 },
              cwd: { type: 'string' }
            }
          }
        },
        required: ['command']
      };
      const zodSchema = jsonSchemaToZod(schema);
      
      const result = zodSchema.parse({
        command: 'npm',
        args: ['install', '--save-dev'],
        options: { cwd: '/project' }
      });
      
      expect(result).toEqual({
        command: 'npm',
        args: ['install', '--save-dev'],
        options: { cwd: '/project' } // timeout default is not auto-filled for optional fields
      });
    });
  });
});