/**
 * @fileoverview Unit tests for validation utilities
 * @module tests/unit/server/mcp/core/handlers/tools/utils/validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { 
  validateInput, 
  validateWithResponse, 
  createSafeValidator,
  isToolAvailable,
  sanitizeForLogging
} from '../../../../../../../../src/server/mcp/core/handlers/tools/utils/validation.js';
import { ValidationError } from '../../../../../../../../src/server/mcp/core/handlers/tools/utils/types.js';

// Mock formatToolResponse
vi.mock('../../../../../../../../src/server/mcp/core/handlers/tools/types', () => ({
  formatToolResponse: vi.fn((success, message, data) => ({
    content: [{ 
      type: 'text', 
      text: JSON.stringify({ success, message, data }) 
    }]
  }))
}));

describe('validation utilities', () => {
  describe('validateInput', () => {
    it('validates and returns parsed input for valid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      
      const input = { name: 'John', age: 30 };
      const result = validateInput(schema, input);
      
      expect(result).toEqual(input);
    });
    
    it('throws ValidationError for invalid input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      
      const input = { name: 'John', age: 'thirty' };
      
      expect(() => validateInput(schema, input))
        .toThrow(ValidationError);
    });
    
    it('includes field path in error', () => {
      const schema = z.object({
        user: z.object({
          email: z.string().email()
        })
      });
      
      const input = { user: { email: 'invalid-email' } };
      
      try {
        validateInput(schema, input);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).field).toBe('user.email');
      }
    });
    
    it('handles array validation errors', () => {
      const schema = z.object({
        items: z.array(z.number())
      });
      
      const input = { items: [1, 'two', 3] };
      
      expect(() => validateInput(schema, input))
        .toThrow(ValidationError);
    });
  });
  
  describe('validateWithResponse', () => {
    it('returns validated data for valid input', () => {
      const schema = z.object({ id: z.string() });
      const input = { id: 'test-123' };
      
      const result = validateWithResponse(schema, input);
      
      expect(result).toEqual({ id: 'test-123' });
    });
    
    it('returns error response for invalid input', () => {
      const schema = z.object({ id: z.number() });
      const input = { id: 'not-a-number' };
      
      const result = validateWithResponse(schema, input);
      
      expect(result).toHaveProperty('content');
      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toHaveProperty('status', 'error');
    });
  });
  
  describe('sanitizeForLogging', () => {
    it('masks API keys starting with sk-', () => {
      // sk- keys need exactly 48 characters after sk-
      const input = 'sk-abcd1234567890abcd1234567890abcd1234567890abcd12';
      expect(sanitizeForLogging(input)).toBe('sk-***');
    });
    
    it('masks fields with key in the name', () => {
      const input = 'API key: sk-shortkey';
      expect(sanitizeForLogging(input)).toBe('API key=***');
    });
    
    it('masks Google API keys', () => {
      // AIza keys need exactly 35 characters after AIza
      const input = 'key=AIzaSyD-a9IF8KKYgoC3cpgS-Al7hLQDbugrDcw';
      expect(sanitizeForLogging(input)).toBe('key=***'); // The key pattern masks it as key=***
    });
    
    it('masks password fields', () => {
      expect(sanitizeForLogging('password: mysecret123')).toBe('password=***');
      expect(sanitizeForLogging('password="mysecret123"')).toBe('password=***');
      expect(sanitizeForLogging("password='mysecret123'")).toBe('password=***');
    });
    
    it('masks token fields', () => {
      expect(sanitizeForLogging('token: abc123xyz')).toBe('token=***');
      expect(sanitizeForLogging('secret=mySecretValue')).toBe('secret=***');
    });
    
    it('masks Bearer tokens', () => {
      expect(sanitizeForLogging('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'))
        .toBe('Authorization: Bearer ***');
    });
    
    it('handles multiple sensitive values', () => {
      const input = 'password: pass123 token: tok456';
      expect(sanitizeForLogging(input)).toBe('password=*** token=***');
    });
  });
  
  describe('createSafeValidator', () => {
    it('creates a validator that returns validated data', () => {
      const schema = z.object({ value: z.number() });
      const validator = createSafeValidator(schema);
      
      const result = validator({ value: 42 });
      expect(result).toEqual({ success: true, data: { value: 42 } });
    });
    
    it('returns error for invalid input', () => {
      const schema = z.object({ value: z.number() });
      const validator = createSafeValidator(schema);
      
      const result = validator({ value: 'not-a-number' });
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect((result as any).error).toBeInstanceOf(ValidationError);
    });
    
    it('handles complex schemas', () => {
      const schema = z.object({ 
        user: z.object({
          name: z.string(),
          age: z.number().optional()
        })
      });
      const validator = createSafeValidator(schema);
      
      const validResult = validator({ user: { name: 'John' } });
      expect(validResult).toEqual({ success: true, data: { user: { name: 'John' } } });
      
      const invalidResult = validator({ user: { name: 123 } });
      expect(invalidResult).toHaveProperty('success', false);
      expect(invalidResult).toHaveProperty('error');
    });
  });
  
  describe('isToolAvailable', () => {
    let originalEnv: any;
    
    beforeEach(() => {
      originalEnv = process.env.CLAUDEAVAILABLE;
    });
    
    afterEach(() => {
      process.env.CLAUDEAVAILABLE = originalEnv;
    });
    
    it('returns true when CLAUDEAVAILABLE env is set to true', () => {
      process.env.CLAUDEAVAILABLE = 'true';
      expect(isToolAvailable('CLAUDECODE')).toBe(true);
    });
    
    it('returns false when CLAUDEAVAILABLE env is not set', () => {
      delete process.env.CLAUDEAVAILABLE;
      expect(isToolAvailable('CLAUDECODE')).toBe(false);
    });
    
    it('returns false when CLAUDEAVAILABLE env is set to false', () => {
      process.env.CLAUDEAVAILABLE = 'false';
      expect(isToolAvailable('CLAUDECODE')).toBe(false);
    });
  });
});