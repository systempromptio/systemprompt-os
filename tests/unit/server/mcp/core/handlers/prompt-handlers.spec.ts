/**
 * @fileoverview Unit tests for MCP Prompt Handlers
 * @module tests/unit/server/mcp/core/handlers/prompt-handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GetPromptRequest, Prompt } from '@modelcontextprotocol/sdk/types.js';

// Mock must be hoisted before imports
vi.mock('../../../../../../src/server/mcp/core/handlers/prompts/index', () => ({
  CODINGPROMPTS: [
    {
      name: 'fixbug',
      description: 'Diagnose and fix a bug in the code',
      arguments: [
        {
          name: 'bugdescription',
          description: 'Description of the bug or error',
          required: true
        },
        {
          name: 'errormessage',
          description: 'Error message or stack trace if available',
          required: false
        }
      ],
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Bug: {{bugdescription}}\nError: {{errormessage}}'
          }
        }
      ]
    },
    {
      name: 'unittest',
      description: 'Write unit tests for code',
      arguments: [
        {
          name: 'code',
          description: 'Code to test',
          required: true
        }
      ],
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Test this code: {{code}}'
          }
        }
      ]
    }
  ]
}));

// Import after mock
import { handleListPrompts, handleGetPrompt } from '../../../../../../src/server/mcp/core/handlers/prompt-handlers';

describe('Prompt Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleListPrompts', () => {
    it('should return all available prompts', async () => {
      const result = await handleListPrompts();

      expect(result.prompts).toHaveLength(2);
      expect(result.prompts[0].name).toBe('fixbug');
      expect(result.prompts[1].name).toBe('unittest');
    });
  });

  describe('handleGetPrompt', () => {
    it('should return fixbug prompt with substituted variables', async () => {
      const request: GetPromptRequest = {
        params: {
          name: 'fixbug',
          arguments: {
            bugdescription: 'Application crashes on startup',
            errormessage: 'TypeError: Cannot read property of undefined'
          }
        }
      };

      const result = await handleGetPrompt(request);

      expect(result).toEqual({
        description: 'Diagnose and fix a bug in the code',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Bug: Application crashes on startup\nError: TypeError: Cannot read property of undefined'
            }
          }
        ]
      });
    });

    it('should return unittest prompt with substituted variables', async () => {
      const request: GetPromptRequest = {
        params: {
          name: 'unittest',
          arguments: {
            code: 'function add(a, b) { return a + b; }'
          }
        }
      };

      const result = await handleGetPrompt(request);

      expect(result).toEqual({
        description: 'Write unit tests for code',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Test this code: function add(a, b) { return a + b; }'
            }
          }
        ]
      });
    });

    it('should handle missing optional arguments', async () => {
      const request: GetPromptRequest = {
        params: {
          name: 'fixbug',
          arguments: {
            bugdescription: 'Null pointer exception'
            // errormessage is optional and not provided
          }
        }
      };

      const result = await handleGetPrompt(request);

      expect(result.messages[0].content).toEqual({
        type: 'text',
        text: 'Bug: Null pointer exception\nError: {{errormessage}}'
      });
    });

    it('should throw error for unknown prompt', async () => {
      const request: GetPromptRequest = {
        params: {
          name: 'unknown-prompt',
          arguments: {}
        }
      };

      await expect(handleGetPrompt(request)).rejects.toThrow('Prompt not found: unknown-prompt');
    });

    it('should handle prompts without arguments', async () => {
      const request: GetPromptRequest = {
        params: {
          name: 'fixbug',
          arguments: undefined
        }
      };

      const result = await handleGetPrompt(request);

      // Template variables remain unsubstituted
      expect(result.messages[0].content).toEqual({
        type: 'text',
        text: 'Bug: {{bugdescription}}\nError: {{errormessage}}'
      });
    });

    it('should handle multiple occurrences of the same variable', async () => {
      // Clear modules and reset before setting up mock
      vi.resetModules();
      
      // Create a custom mock for this test
      vi.doMock('../../../../../../src/server/mcp/core/handlers/prompts/index', () => ({
        CODINGPROMPTS: [
          {
            name: 'fixbug',
            description: 'Diagnose and fix a bug in the code',
            arguments: [
              {
                name: 'bugdescription',
                description: 'Description of the bug or error',
                required: true
              }
            ],
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: 'Bug: {{bugdescription}}\nDescription again: {{bugdescription}}'
              }
            }]
          }
        ]
      }));

      // Re-import to use the new mock
      const { handleGetPrompt: handleGetPromptLocal } = await import('../../../../../../src/server/mcp/core/handlers/prompt-handlers');

      const request: GetPromptRequest = {
        params: {
          name: 'fixbug',
          arguments: {
            bugdescription: 'Memory leak'
          }
        }
      };

      const result = await handleGetPromptLocal(request);

      expect(result.messages[0].content).toEqual({
        type: 'text',
        text: 'Bug: Memory leak\nDescription again: Memory leak'
      });

      // Clear the mock and reset modules
      vi.doUnmock('../../../../../../src/server/mcp/core/handlers/prompts/index');
      vi.resetModules();
    });

    it('should handle non-text content messages', async () => {
      // Clear modules and reset before setting up mock
      vi.resetModules();
      
      // Create a custom mock for this test
      vi.doMock('../../../../../../src/server/mcp/core/handlers/prompts/index', () => ({
        CODINGPROMPTS: [
          {
            name: 'fixbug',
            description: 'Diagnose and fix a bug in the code',
            arguments: [],
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: 'Bug: {{bugdescription}}\nError: {{errormessage}}'
              }
            }]
          },
          {
            name: 'special',
            description: 'Special prompt',
            arguments: [],
            messages: [{
              role: 'user',
              content: {
                type: 'image',
                data: 'base64data',
                mimeType: 'image/png'
              }
            }]
          }
        ]
      }));

      // Re-import to use the new mock
      const { handleGetPrompt: handleGetPromptLocal } = await import('../../../../../../src/server/mcp/core/handlers/prompt-handlers');

      const request: GetPromptRequest = {
        params: {
          name: 'special',
          arguments: { test: 'value' }
        }
      };

      const result = await handleGetPromptLocal(request);

      // Non-text content should be returned unchanged
      expect(result.messages[0]).toEqual({
        role: 'user',
        content: {
          type: 'image',
          data: 'base64data',
          mimeType: 'image/png'
        }
      });

      // Clear the mock and reset modules
      vi.doUnmock('../../../../../../src/server/mcp/core/handlers/prompts/index');
      vi.resetModules();
    });

    it('should convert values to strings', async () => {
      const request: GetPromptRequest = {
        params: {
          name: 'unittest',
          arguments: {
            code: 12345 // number instead of string
          }
        }
      };

      const result = await handleGetPrompt(request);

      expect(result.messages[0].content).toEqual({
        type: 'text',
        text: 'Test this code: 12345'
      });
    });
  });
});