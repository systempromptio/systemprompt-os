/**
 * @fileoverview Unit tests for Unit Testing Prompts
 * @module tests/unit/server/mcp/core/handlers/prompts/unit-testing
 */

import { describe, it, expect } from 'vitest';
import { CREATEUNIT_TESTS_PROMPT, UNITTESTING_PROMPTS } from '../../../../../../../src/server/mcp/core/handlers/prompts/unit-testing';

describe('Unit Testing Prompts', () => {
  describe('CREATEUNIT_TESTS_PROMPT', () => {
    it('should have correct structure', () => {
      expect(CREATEUNIT_TESTS_PROMPT).toHaveProperty('name', 'createunit_tests');
      expect(CREATEUNIT_TESTS_PROMPT).toHaveProperty('description', 'Create and run unit tests until achieving 100% pass rate');
      expect(CREATEUNIT_TESTS_PROMPT).toHaveProperty('arguments');
      expect(CREATEUNIT_TESTS_PROMPT).toHaveProperty('messages');
    });

    it('should have correct arguments', () => {
      expect(CREATEUNIT_TESTS_PROMPT.arguments).toHaveLength(3);
      
      const filepathArg = CREATEUNIT_TESTS_PROMPT.arguments[0];
      expect(filepathArg).toEqual({
        name: 'filepath',
        description: 'Path to the file or module to test',
        required: true
      });

      const frameworkArg = CREATEUNIT_TESTS_PROMPT.arguments[1];
      expect(frameworkArg).toEqual({
        name: 'testframework',
        description: 'Testing framework to use (e.g., jest, mocha, pytest, junit)',
        required: false
      });

      const coverageArg = CREATEUNIT_TESTS_PROMPT.arguments[2];
      expect(coverageArg).toEqual({
        name: 'coveragetarget',
        description: 'Target code coverage percentage ( default: 80)',
        required: false
      });
    });

    it('should have messages array with user role', () => {
      expect(CREATEUNIT_TESTS_PROMPT.messages).toHaveLength(1);
      expect(CREATEUNIT_TESTS_PROMPT.messages[0]).toHaveProperty('role', 'user');
      expect(CREATEUNIT_TESTS_PROMPT.messages[0]).toHaveProperty('content');
    });

    it('should have text content with template variables', () => {
      const content = CREATEUNIT_TESTS_PROMPT.messages[0].content;
      expect(content).toHaveProperty('type', 'text');
      expect(content.text).toContain('{{filepath}}');
      expect(content.text).toContain('{{testframework}}');
      expect(content.text).toContain('{{coveragetarget}}');
    });

    it('should include comprehensive testing guidelines', () => {
      const text = CREATEUNIT_TESTS_PROMPT.messages[0].content.text;
      expect(text).toContain('Code Analysis Phase');
      expect(text).toContain('Test Planning');
      expect(text).toContain('Mock Strategy');
      expect(text).toContain('Test Implementation Requirements');
      expect(text).toContain('Edge Cases to Cover');
      expect(text).toContain('Async Testing Patterns');
      expect(text).toContain('Test Execution & Iteration');
    });

    it('should mention test categories', () => {
      const text = CREATEUNIT_TESTS_PROMPT.messages[0].content.text;
      expect(text).toContain('Happy Path Tests');
      expect(text).toContain('Edge Cases');
      expect(text).toContain('Error Cases');
      expect(text).toContain('Integration Points');
      expect(text).toContain('Async Operations');
      expect(text).toContain('State Management');
    });
  });

  describe('UNITTESTING_PROMPTS', () => {
    it('should export array containing CREATEUNIT_TESTS_PROMPT', () => {
      expect(UNITTESTING_PROMPTS).toBeInstanceOf(Array);
      expect(UNITTESTING_PROMPTS).toHaveLength(1);
      expect(UNITTESTING_PROMPTS[0]).toBe(CREATEUNIT_TESTS_PROMPT);
    });
  });
});