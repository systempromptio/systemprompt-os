/**
 * @fileoverview Get prompt tool definition
 * @module constants/tool/get-prompt
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool for retrieving prompts
 */
export const getPrompt: Tool = {
  name: "get_prompt",
  description: "Get a specific prompt by ID or list all available prompts if no ID is provided",
  inputSchema: {
    type: "object",
    properties: {
      prompt_id: {
        type: "string",
        description: "Optional ID of the prompt to retrieve. If not provided, returns all prompts."
      }
    }
  }
};