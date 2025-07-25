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
 * import { handleListPrompts, handleGetPrompt } from './handlers/prompt-handlers.js';
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
import { getModuleLoader } from '../../../../modules/loader.js';

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
  const moduleLoader = getModuleLoader();
  const promptsModule = moduleLoader.getModule('prompts');

  if (!promptsModule?.exports) {
    throw new Error('Prompts module not available');
  }

  const prompts = await promptsModule.exports.listPrompts();
  return { prompts };
}

/**
 * Handles MCP prompt retrieval requests with variable substitution
 *
 * @param request - GetPromptRequest containing prompt name and arguments
 * @returns GetPromptResult with populated prompt messages
 * @throws {Error} If prompt is not found
 *
 * @example
 * ```typescript
 * const result = await handleGetPrompt({
 *   params: {
 *     name: 'bugfix',
 *     arguments: { errormessage: 'TypeError', file_path: 'src/app.ts' }
 *   }
 * });
 * ```
 */
export async function handleGetPrompt(
  request: GetPromptRequest,
): Promise<GetPromptResult> {
  const moduleLoader = getModuleLoader();
  const promptsModule = moduleLoader.getModule('prompts');

  if (!promptsModule?.exports) {
    throw new Error('Prompts module not available');
  }

  const promptWithMessages = await promptsModule.exports.getPrompt(request.params.name);
  if (!promptWithMessages) {
    throw new Error(`Prompt not found: ${request.params.name}`);
  }

  // Process messages with argument substitution
  const messages = promptWithMessages.messages.map((message: PromptMessage) => {
    if (!isTextContent(message.content)) {
      return message;
    }

    let text = String(message.content.text);

    if (request.params.arguments) {
      Object.entries(request.params.arguments).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        text = text.replace(new RegExp(placeholder, 'g'), String(value));
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
    description: promptWithMessages.description,
    messages,
  };
}

/**
 * Type guard to check if prompt content is text type
 *
 * @param content - Prompt message content to check
 * @returns True if content is text type
 */
function isTextContent(content: PromptMessage['content']): content is TextContent {
  return content.type === 'text';
}