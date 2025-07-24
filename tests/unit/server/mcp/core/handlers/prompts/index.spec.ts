/**
 * @fileoverview Unit tests for Prompts Index
 * @module tests/unit/server/mcp/core/handlers/prompts
 */

import { describe, it, expect } from 'vitest';
import { 
  CODINGPROMPTS,
  BUGFIXING_PROMPTS,
  UNITTESTING_PROMPTS,
  REACTCOMPONENT_PROMPTS,
  REDDITPOST_PROMPTS
} from '../../../../../../../src/server/mcp/core/handlers/prompts/index.js';

describe('Prompts Index', () => {
  describe('CODINGPROMPTS', () => {
    it('should export array of all prompts', () => {
      expect(CODINGPROMPTS).toBeInstanceOf(Array);
      expect(CODINGPROMPTS.length).toBeGreaterThan(0);
    });

    it('should include prompts from all categories', () => {
      const promptNames = CODINGPROMPTS.map(p => p.name);
      
      // Check for at least one prompt from each category
      expect(promptNames).toContain('fixbug'); // From bug fixing
      expect(promptNames).toContain('createunit_tests'); // From unit testing
      expect(promptNames).toContain('createreact_component'); // From react components
      expect(promptNames).toContain('createreddit_post'); // From reddit post
    });

    it('should have valid prompt structure for all prompts', () => {
      CODINGPROMPTS.forEach(prompt => {
        expect(prompt).toHaveProperty('name');
        expect(prompt).toHaveProperty('description');
        expect(prompt).toHaveProperty('arguments');
        expect(prompt).toHaveProperty('messages');
        
        expect(typeof prompt.name).toBe('string');
        expect(typeof prompt.description).toBe('string');
        expect(Array.isArray(prompt.arguments)).toBe(true);
        expect(Array.isArray(prompt.messages)).toBe(true);
      });
    });
  });

  describe('Individual prompt exports', () => {
    it('should export BUGFIXING_PROMPTS', () => {
      expect(BUGFIXING_PROMPTS).toBeInstanceOf(Array);
      expect(BUGFIXING_PROMPTS.length).toBeGreaterThan(0);
    });

    it('should export UNITTESTING_PROMPTS', () => {
      expect(UNITTESTING_PROMPTS).toBeInstanceOf(Array);
      expect(UNITTESTING_PROMPTS.length).toBeGreaterThan(0);
    });

    it('should export REACTCOMPONENT_PROMPTS', () => {
      expect(REACTCOMPONENT_PROMPTS).toBeInstanceOf(Array);
      expect(REACTCOMPONENT_PROMPTS.length).toBeGreaterThan(0);
    });

    it('should export REDDITPOST_PROMPTS', () => {
      expect(REDDITPOST_PROMPTS).toBeInstanceOf(Array);
      expect(REDDITPOST_PROMPTS.length).toBeGreaterThan(0);
    });
  });

  describe('Prompt consistency', () => {
    it('should have unique prompt names', () => {
      const names = CODINGPROMPTS.map(p => p.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });

    it('should have all prompts with at least one message', () => {
      CODINGPROMPTS.forEach(prompt => {
        expect(prompt.messages.length).toBeGreaterThan(0);
      });
    });

    it('should have all messages with valid content', () => {
      CODINGPROMPTS.forEach(prompt => {
        prompt.messages.forEach(message => {
          expect(message).toHaveProperty('role');
          expect(message).toHaveProperty('content');
          expect(['user', 'assistant', 'system']).toContain(message.role);
        });
      });
    });
  });
});