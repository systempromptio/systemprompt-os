/**
 * @fileoverview Unit tests for Bug Fixing Prompts
 * @module tests/unit/server/mcp/core/handlers/prompts/bug-fixing
 */

import { describe, it, expect } from 'vitest';
import { FIXBUG_PROMPT, BUGFIXING_PROMPTS } from '../../../../../../../src/server/mcp/core/handlers/prompts/bug-fixing';

describe('Bug Fixing Prompts', () => {
  describe('FIXBUG_PROMPT', () => {
    it('should have correct structure', () => {
      expect(FIXBUG_PROMPT).toHaveProperty('name', 'fixbug');
      expect(FIXBUG_PROMPT).toHaveProperty('description', 'Diagnose and fix a bug in the code');
      expect(FIXBUG_PROMPT).toHaveProperty('arguments');
      expect(FIXBUG_PROMPT).toHaveProperty('messages');
    });

    it('should have correct arguments', () => {
      expect(FIXBUG_PROMPT.arguments).toHaveLength(4);
      
      const bugDescArg = FIXBUG_PROMPT.arguments[0];
      expect(bugDescArg).toEqual({
        name: 'bugdescription',
        description: 'Description of the bug or error',
        required: true
      });

      const errorMsgArg = FIXBUG_PROMPT.arguments[1];
      expect(errorMsgArg).toEqual({
        name: 'errormessage',
        description: 'Error message or stack trace if available',
        required: false
      });

      const affectedFilesArg = FIXBUG_PROMPT.arguments[2];
      expect(affectedFilesArg).toEqual({
        name: 'affectedfiles',
        description: 'Files potentially related to the bug',
        required: false
      });

      const reproStepsArg = FIXBUG_PROMPT.arguments[3];
      expect(reproStepsArg).toEqual({
        name: 'reproductionsteps',
        description: 'Steps to reproduce the bug',
        required: false
      });
    });

    it('should have messages array with user role', () => {
      expect(FIXBUG_PROMPT.messages).toHaveLength(1);
      expect(FIXBUG_PROMPT.messages[0]).toHaveProperty('role', 'user');
      expect(FIXBUG_PROMPT.messages[0]).toHaveProperty('content');
    });

    it('should have text content with template variables', () => {
      const content = FIXBUG_PROMPT.messages[0].content;
      expect(content).toHaveProperty('type', 'text');
      expect(content.text).toContain('{{bugdescription}}');
      expect(content.text).toContain('{{errormessage}}');
      expect(content.text).toContain('{{affectedfiles}}');
      expect(content.text).toContain('{{reproductionsteps}}');
    });

    it('should include detailed debugging instructions', () => {
      const text = FIXBUG_PROMPT.messages[0].content.text;
      expect(text).toContain('Error Analysis');
      expect(text).toContain('Root Cause Investigation');
      expect(text).toContain('Debugging Implementation');
      expect(text).toContain('Fix Development');
      expect(text).toContain('Testing & Validation');
      expect(text).toContain('Output Requirements');
    });
  });

  describe('BUGFIXING_PROMPTS', () => {
    it('should export array containing FIXBUG_PROMPT', () => {
      expect(BUGFIXING_PROMPTS).toBeInstanceOf(Array);
      expect(BUGFIXING_PROMPTS).toHaveLength(1);
      expect(BUGFIXING_PROMPTS[0]).toBe(FIXBUG_PROMPT);
    });
  });
});