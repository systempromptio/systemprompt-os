import { describe, it, expect } from 'vitest';
import { 
  isValidUUID, 
  validateTaskId,
  sanitizeTaskId 
} from '../../../src/utils/id-validation.js';

describe('ID Validation Utils', () => {
  describe('isValidUUID', () => {
    it.each([
      // Valid UUIDs
      ['550e8400-e29b-41d4-a716-446655440000', true, 'standard UUID'],
      ['6ba7b810-9dad-11d1-80b4-00c04fd430c8', true, 'UUID v1'],
      ['00000000-0000-0000-0000-000000000000', true, 'nil UUID'],
      ['c9f57622-bb3f-11ed-afa1-0242ac120002', true, 'UUID v1'],
      ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', true, 'UUID v4'],
      ['a6fa3124-d8f5-5e45-8b5b-73e524d7c2f2', true, 'UUID v5'],
      ['550E8400-E29B-41D4-A716-446655440000', true, 'uppercase UUID'],
      ['550e8400-E29B-41d4-A716-446655440000', true, 'mixed case UUID'],
      // Invalid UUIDs
      ['not-a-uuid', false, 'invalid format'],
      ['550e8400-e29b-41d4-a716', false, 'too short'],
      ['550e8400-e29b-41d4-a716-446655440000-extra', false, 'too long'],
      ['550e8400-e29b-41d4-a716-44665544000g', false, 'invalid character'],
      ['', false, 'empty string'],
      ['   ', false, 'whitespace only'],
      ['\t\n', false, 'special whitespace'],
      [123, false, 'number input'],
      [{}, false, 'object input'],
      [[], false, 'array input'],
      [true, false, 'boolean input'],
      [null, false, 'null input'],
      [undefined, false, 'undefined input']
    ])('validates %s as %s (%s)', (input, expected, description) => {
      expect(isValidUUID(input as any)).toBe(expected);
    });
  });

  describe('validateTaskId', () => {
    it.each([
      // Valid task IDs
      ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'returns valid UUID unchanged'],
      ['task_550e8400-e29b-41d4-a716-446655440000', 'task_550e8400-e29b-41d4-a716-446655440000', 'accepts task_ prefix'],
      // Invalid task IDs
      ['', 'Invalid task ID', 'rejects empty string'],
      ['invalid-id', 'Invalid task ID', 'rejects invalid format'],
      ['123', 'Invalid task ID', 'rejects non-UUID'],
      ['task_invalid', 'Invalid task ID', 'rejects invalid with prefix'],
      ['   ', 'Invalid task ID', 'rejects whitespace'],
      [null, 'Invalid task ID', 'rejects null'],
      [undefined, 'Invalid task ID', 'rejects undefined']
    ])('handles %s correctly', (input, expected, description) => {
      if (expected.includes('Invalid')) {
        expect(() => validateTaskId(input as any)).toThrow(expected);
      } else {
        expect(validateTaskId(input)).toBe(expected);
      }
    });
  });

  describe('sanitizeTaskId', () => {
    it.each([
      // Valid cases
      ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'returns valid ID unchanged'],
      ['task_550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'removes task_ prefix'],
      ['  550e8400-e29b-41d4-a716-446655440000  ', '550e8400-e29b-41d4-a716-446655440000', 'trims whitespace'],
      ['  task_550e8400-e29b-41d4-a716-446655440000  ', '550e8400-e29b-41d4-a716-446655440000', 'trims and removes prefix'],
      ['550E8400-E29B-41D4-A716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'converts to lowercase'],
      // Invalid cases
      ['invalid', 'Invalid task ID', 'rejects invalid format'],
      ['task_invalid', 'Invalid task ID', 'rejects invalid with prefix'],
      ['', 'Invalid task ID', 'rejects empty string'],
      ['   ', 'Invalid task ID', 'rejects whitespace only'],
      ['task_task_550e8400-e29b-41d4-a716-446655440000', 'Invalid task ID', 'rejects multiple prefixes'],
      ['user_550e8400-e29b-41d4-a716-446655440000', 'Invalid task ID', 'rejects wrong prefix']
    ])('sanitizes %s correctly', (input, expected, description) => {
      if (expected.includes('Invalid')) {
        expect(() => sanitizeTaskId(input)).toThrow(expected);
      } else {
        expect(sanitizeTaskId(input)).toBe(expected);
      }
    });
  });
});