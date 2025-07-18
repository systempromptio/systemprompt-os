import { describe, it, expect } from 'vitest';
import { 
  isValidUUID, 
  validateTaskId,
  sanitizeTaskId 
} from '../../../src/utils/id-validation';

describe('ID Validation Utils', () => {
  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false); // too short
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false); // too long
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false); // invalid char
      expect(isValidUUID('')).toBe(false);
    });

    it('should handle different UUID versions', () => {
      // v1
      expect(isValidUUID('c9f57622-bb3f-11ed-afa1-0242ac120002')).toBe(true);
      // v4
      expect(isValidUUID('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')).toBe(true);
      // v5
      expect(isValidUUID('a6fa3124-d8f5-5e45-8b5b-73e524d7c2f2')).toBe(true);
    });

    it('should handle case insensitive UUIDs', () => {
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
      expect(isValidUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
    });
  });

  describe('validateTaskId', () => {
    it('should return valid task IDs unchanged', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      expect(validateTaskId(validId)).toBe(validId);
    });

    it('should accept task_ prefixed IDs', () => {
      const taskId = 'task_550e8400-e29b-41d4-a716-446655440000';
      expect(validateTaskId(taskId)).toBe(taskId);
    });

    it('should throw error for invalid task IDs', () => {
      expect(() => validateTaskId('')).toThrow('Invalid task ID');
      expect(() => validateTaskId('invalid-id')).toThrow('Invalid task ID');
      expect(() => validateTaskId('123')).toThrow('Invalid task ID');
      expect(() => validateTaskId('task_invalid')).toThrow('Invalid task ID');
    });

    it('should throw error for null or undefined', () => {
      expect(() => validateTaskId(null as any)).toThrow('Invalid task ID');
      expect(() => validateTaskId(undefined as any)).toThrow('Invalid task ID');
    });
  });

  describe('sanitizeTaskId', () => {
    it('should return valid IDs unchanged', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      expect(sanitizeTaskId(validId)).toBe(validId);
    });

    it('should remove task_ prefix if present', () => {
      expect(sanitizeTaskId('task_550e8400-e29b-41d4-a716-446655440000'))
        .toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should handle IDs without prefix', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';
      expect(sanitizeTaskId(id)).toBe(id);
    });

    it('should trim whitespace', () => {
      expect(sanitizeTaskId('  550e8400-e29b-41d4-a716-446655440000  '))
        .toBe('550e8400-e29b-41d4-a716-446655440000');
      
      expect(sanitizeTaskId('  task_550e8400-e29b-41d4-a716-446655440000  '))
        .toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should convert to lowercase', () => {
      expect(sanitizeTaskId('550E8400-E29B-41D4-A716-446655440000'))
        .toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should throw error for invalid IDs after sanitization', () => {
      expect(() => sanitizeTaskId('invalid')).toThrow('Invalid task ID');
      expect(() => sanitizeTaskId('task_invalid')).toThrow('Invalid task ID');
      expect(() => sanitizeTaskId('')).toThrow('Invalid task ID');
    });
  });

  describe('Edge cases', () => {
    it('should handle non-string inputs', () => {
      expect(isValidUUID(123 as any)).toBe(false);
      expect(isValidUUID({} as any)).toBe(false);
      expect(isValidUUID([] as any)).toBe(false);
      expect(isValidUUID(true as any)).toBe(false);
    });

    it('should handle whitespace-only strings', () => {
      expect(isValidUUID('   ')).toBe(false);
      expect(isValidUUID('\t\n')).toBe(false);
      expect(() => validateTaskId('   ')).toThrow();
      expect(() => sanitizeTaskId('   ')).toThrow();
    });

    it('should handle special task ID formats', () => {
      // Multiple prefixes
      expect(() => sanitizeTaskId('task_task_550e8400-e29b-41d4-a716-446655440000')).toThrow();
      
      // Wrong prefix
      expect(() => sanitizeTaskId('user_550e8400-e29b-41d4-a716-446655440000')).toThrow();
    });
  });
});