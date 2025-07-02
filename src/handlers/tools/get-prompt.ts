/**
 * @fileoverview Get prompt orchestrator tool handler that retrieves coding prompts
 * from the system's prompt registry for AI-assisted development tasks
 * @module handlers/tools/orchestrator/get-prompt
 */

import type { ToolHandler, CallToolResult, ToolHandlerContext } from "./types.js";
import { formatToolResponse } from "./types.js";
import { logger } from "../../utils/logger.js";
import { CODING_PROMPTS } from "../../handlers/prompts/index.js";
import type { Prompt } from "@modelcontextprotocol/sdk/types.js";

/**
 * Arguments for the get_prompt tool
 */
interface GetPromptArgs {
  prompt_id?: string;
}

/**
 * Response structure for get_prompt tool
 */
interface GetPromptResponse {
  prompts?: Prompt[];
  prompt?: Prompt;
}

/**
 * Gets a specific prompt by ID or returns all prompts if no ID is provided
 *
 * @param args - Get prompt parameters including optional prompt_id
 * @param context - Execution context containing session information
 * @returns Either a single prompt or all available prompts
 *
 * @example
 * ```typescript
 * // Get a specific prompt
 * await handleGetPrompt({ prompt_id: "create_unit_tests" });
 * 
 * // Get all prompts
 * await handleGetPrompt({});
 * ```
 */
export const handleGetPrompt: ToolHandler<GetPromptArgs> = async (
  args: GetPromptArgs,
  context?: ToolHandlerContext,
): Promise<CallToolResult> => {
  try {
    logger.info("Getting prompt(s)", {
      sessionId: context?.sessionId,
      promptId: args.prompt_id,
    });

    if (!args.prompt_id) {
      logger.info("Returning all prompts", {
        count: CODING_PROMPTS.length,
      });

      const response: GetPromptResponse = {
        prompts: CODING_PROMPTS,
      };

      return formatToolResponse({
        message: `Found ${CODING_PROMPTS.length} prompts`,
        result: response,
      });
    }

    const prompt = CODING_PROMPTS.find(p => p.name === args.prompt_id);
    
    if (!prompt) {
      logger.warn("Prompt not found", { promptId: args.prompt_id });
      
      return formatToolResponse({
        status: "error",
        message: `Prompt not found: ${args.prompt_id}`,
        error: {
          type: "prompt_not_found",
          details: `No prompt with ID '${args.prompt_id}' exists. Available prompts: ${CODING_PROMPTS.map(p => p.name).join(", ")}`,
        },
      });
    }

    logger.info("Found prompt", {
      promptId: args.prompt_id,
      promptName: prompt.name,
    });

    const response: GetPromptResponse = {
      prompt: prompt,
    };

    return formatToolResponse({
      message: `Found prompt: ${prompt.name}`,
      result: response,
    });
  } catch (error) {
    logger.error("Failed to get prompt", { error, args });

    return formatToolResponse({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to get prompt",
      error: {
        type: "get_prompt_error",
        details: error instanceof Error ? error.stack : undefined,
      },
    });
  }
};