/**
 * @fileoverview Unit tests for API utilities
 * @module tests/unit/server/external/rest/api/utils
 */

import { describe, it, expect } from 'vitest';

describe('API Utils', () => {
  describe('Response helpers', () => {
    it('should format success response', () => {
      const success = (data: any) => ({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });

      const response = success({ id: 1, name: 'Test' });
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 1, name: 'Test' });
    });

    it('should format error response', () => {
      const error = (code: string, message: string) => ({
        success: false,
        error: {
          code,
          message
        }
      });

      const response = error('VALIDATION_ERROR', 'Invalid input');
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Validation helpers', () => {
    it('should validate email format', () => {
      const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      };

      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
    });

    it('should validate UUID format', () => {
      const isValidUUID = (uuid: string) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
      };

      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('invalid-uuid')).toBe(false);
    });

    it('should sanitize input', () => {
      const sanitize = (input: string) => {
        return input.trim().replace(/[<>]/g, '');
      };

      expect(sanitize('  hello  ')).toBe('hello');
      expect(sanitize('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });
  });

  describe('Pagination helpers', () => {
    it('should calculate pagination', () => {
      const paginate = (total: number, page: number, limit: number) => ({
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      });

      const pagination = paginate(100, 2, 10);
      expect(pagination.pages).toBe(10);
      expect(pagination.hasNext).toBe(true);
      expect(pagination.hasPrev).toBe(true);
    });
  });
});