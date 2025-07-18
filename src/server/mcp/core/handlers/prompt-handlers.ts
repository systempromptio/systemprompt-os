/**
 * @fileoverview MCP Prompt request handlers for coding assistant prompts
 * @module handlers/prompt-handlers
 * 
 * @remarks
 * This module provides handlers for MCP prompt operations including:
 * - Listing available coding prompts
 * - Retrieving prompts with variable substitution
 * 
 * @example
 * ```typescript
 * import { handleListPrompts, handleGetPrompt } from './handlers/prompt-handlers';
 * 
 * // List available prompts
 * const { prompts } = await handleListPrompts();
 * 
 * // Get a specific prompt with variables
 * const result = await handleGetPrompt({
 *   params: {
 *     name: 'bugfix',
 *     arguments: { errormessage: 'TypeError', file_path: 'src/app.ts' }
 *   }
 * });
 * ```
 */

import type {
  ListPromptsResult,
  GetPromptRequest,
  GetPromptResult,
  PromptMessage,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { CODINGPROMPTS } from './prompts/index.js';

/**
 * Handles MCP prompt listing requests
 * 
 * @returns List of available coding prompts
 * 
 * @example
 * ```typescript
 * const { prompts } = await handleListPrompts();
 * console.log(`Available prompts: ${prompts.length}`);
 * ```
 */
export async function handleListPrompts(): Promise<ListPromptsResult> {
  return { prompts: CODINGPROMPTS };
}

/**
 * Handles MCP prompt retrieval requests with variable substitution
 * 
 * @param request - The prompt retrieval request with name and arguments
 * @returns The processed prompt with variables replaced
 * @throws {Error} If the requested prompt is not found
 * 
 * @remarks
 * This function:
 * 1. Looks up the prompt by name
 * 2. Replaces template variables ({{variable}}) with provided arguments
 * 3. Returns the processed prompt messages
 * 
 * @example
 * ```typescript
 * const result = await handleGetPrompt({
 *   params: {
 *     name: 'reactcomponent',
 *     arguments: {
 *       componentname: 'UserProfile',
 *       requirements: 'Display user avatar and bio'
 *     }
 *   }
 * });
 * ```
 */
export async function handleGetPrompt(
  request: GetPromptRequest,
): Promise<GetPromptResult> {
  const prompt = CODINGPROMPTS.find(p => p.name === request.params.name);
  if (!prompt) {
    throw new Error(`Prompt not found: ${request.params.name}`);
  }

  /**
   * Type guard to check if prompt content is text type
   * 
   * @param content - Prompt message content to check
   * @returns True if content is text type
   */
  function isTextContent( content: PromptMessage['content']): content is TextContent {
    return content.type === 'text';
  }

  const promptWithMessages = prompt as unknown as { messages: PromptMessage[] };
  const messages = promptWithMessages.messages.map(( message: PromptMessage) => {
    if (!isTextContent(message.content)) {
      return message;
    }

    let text = String(message.content.text);

    if (request.params.arguments) {
      Object.entries(request.params.arguments).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        text = text.replace(new RegExp(placeholder, 'g'), String( value));
      });
    }
    
    return {
      role: message.role,
      content: {
        type: 'text' as const,
        text: text,
      },
    };
  });

  return {
    description: prompt.description,
    messages: messages,
  };
}
