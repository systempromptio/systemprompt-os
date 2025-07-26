/**
 * MCP Prompt request handlers for coding assistant prompts.
 * @file MCP Prompt request handlers for coding assistant prompts.
 * @module handlers/prompt-handlers
 * This module provides handlers for MCP prompt operations including:
 * - Listing available coding prompts
 * - Retrieving prompts with variable substitution
 * @example
 * ```typescript
 * import { handleListPrompts, handleGetPrompt } from './handlers/prompt-handlers.js';
 * // List available prompts
 * const { prompts } = await handleListPrompts();
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
  GetPromptRequest,
  GetPromptResult,
  ListPromptsResult,
} from '@modelcontextprotocol/sdk/types.js';
import { getMCPModule } from '@/modules/core/mcp';

/**
 * Handles MCP prompt listing requests.
 * @returns List of available coding prompts.
 * @example
 * ```typescript
 * const { prompts } = await handleListPrompts();
 * console.log(`Available prompts: ${prompts.length}`);
 * ```
 */
export const handleListPrompts = async function handleListPrompts(): Promise<ListPromptsResult> {
  const mcpModule = getMCPModule();
  const prompts = await mcpModule.exports.prompts.listPrompts();
  return { prompts };
}

/**
 * Handles MCP prompt retrieval requests with variable substitution.
 * @param request - GetPromptRequest containing prompt name and arguments.
 * @returns GetPromptResult with populated prompt messages.
 * @throws {Error} If prompt is not found.
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
export const handleGetPrompt = async function handleGetPrompt(
  request: GetPromptRequest
): Promise<GetPromptResult> {
  const mcpModule = getMCPModule();
  const prompt = await mcpModule.exports.prompts.getPrompt(request.params.name);

  if (prompt === null) {
    throw new Error(`Prompt not found: ${request.params.name}`);
  }

  return {
    description: prompt.description ?? '',
    messages: prompt.arguments === undefined ? [] : [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: JSON.stringify(prompt.arguments)
      }
    }]
  };
}
