/**
 * @fileoverview Unit tests for Reddit Post Prompts
 * @module tests/unit/server/mcp/core/handlers/prompts/reddit-post
 */

import { describe, it, expect } from 'vitest';
import { CREATEREDDIT_POST_PROMPT, REDDITPOST_PROMPTS } from '../../../../../../../src/server/mcp/core/handlers/prompts/reddit-post.js';

describe('Reddit Post Prompts', () => {
  describe('CREATEREDDIT_POST_PROMPT', () => {
    it('should have correct structure', () => {
      expect(CREATEREDDIT_POST_PROMPT).toHaveProperty('name', 'createreddit_post');
      expect(CREATEREDDIT_POST_PROMPT).toHaveProperty('description', 'Write a playful Reddit post introducing the Systemprompt Coding Agent project');
      expect(CREATEREDDIT_POST_PROMPT).toHaveProperty('arguments');
      expect(CREATEREDDIT_POST_PROMPT).toHaveProperty('messages');
    });

    it('should have correct arguments', () => {
      expect(CREATEREDDIT_POST_PROMPT.arguments).toHaveLength(2);
      
      const subredditArg = CREATEREDDIT_POST_PROMPT.arguments[0];
      expect(subredditArg).toEqual({
        name: 'subreddit',
        description: 'Target subreddit for the post (e.g., r/programming, r/webdev)',
        required: false
      });

      const toneArg = CREATEREDDIT_POST_PROMPT.arguments[1];
      expect(toneArg).toEqual({
        name: 'tone',
        description: 'Tone of the post (playful, informative, excited)',
        required: false
      });
    });

    it('should have messages array with user role', () => {
      expect(CREATEREDDIT_POST_PROMPT.messages).toHaveLength(1);
      expect(CREATEREDDIT_POST_PROMPT.messages[0]).toHaveProperty('role', 'user');
      expect(CREATEREDDIT_POST_PROMPT.messages[0]).toHaveProperty('content');
    });

    it('should have text content with template variables', () => {
      const content = CREATEREDDIT_POST_PROMPT.messages[0].content;
      expect(content).toHaveProperty('type', 'text');
      expect(content.text).toContain('{{subreddit}}');
      expect(content.text).toContain('{{tone}}');
    });

    it('should include Reddit posting guidelines', () => {
      const text = CREATEREDDIT_POST_PROMPT.messages[0].content.text;
      expect(text).toContain('Title Creation');
      expect(text).toContain('Post Content Structure');
      expect(text).toContain('Formatting Guidelines');
      expect(text).toContain('Tone and Style');
    });

    it('should mention Reddit-specific formatting', () => {
      const text = CREATEREDDIT_POST_PROMPT.messages[0].content.text;
      expect(text).toContain('markdown');
      expect(text).toContain('code blocks');
      expect(text).toContain('TL;DR');
    });
  });

  describe('REDDITPOST_PROMPTS', () => {
    it('should export array containing CREATEREDDIT_POST_PROMPT', () => {
      expect(REDDITPOST_PROMPTS).toBeInstanceOf(Array);
      expect(REDDITPOST_PROMPTS).toHaveLength(1);
      expect(REDDITPOST_PROMPTS[0]).toBe(CREATEREDDIT_POST_PROMPT);
    });
  });
});