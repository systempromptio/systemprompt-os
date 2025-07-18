/**
 * @fileoverview Get prompt orchestrator tool handler that retrieves coding prompts
 * from the system's prompt registry for AI-assisted development tasks
 * @module handlers/tools/orchestrator/get-prompt
 */

import type { ToolHandler, CallToolResult, ToolHandlerContext } from "./types.js";
import { formatToolResponse } from "./types.js";
import { logger } from "../../utils/logger.js";
import { CODINGPROMPTS } from "../prompts/index.js";
import type { Prompt } from "@modelcontextprotocol/sdk/types.js";

/**
 * Arguments for the getprompt tool
 */
interface GetPromptArgs {
  promptid?: string;
}

/**
 * Response structure for getprompt tool
 */
interface GetPromptResponse {
  prompts?: Prompt[];
  prompt?: Prompt;
}

/**
 * Gets a specific prompt by ID or returns all prompts if no ID is provided
 *
 * @param args - Get prompt parameters including optional promptid
 * @param context - Execution context containing session information
 * @returns Either a single prompt or all available prompts
 *
 * @example
 * ```typescript
 * // Get a specific prompt
 * await handleGetPrompt({ promptid: "createunit_tests" });
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
      promptId: args.promptid,
    });

    if (!args.promptid) {
      logger.info("Returning all prompts", {
        count: CODINGPROMPTS.length,
      });

      const response: GetPromptResponse = {
        prompts: CODINGPROMPTS,
      };

      return formatToolResponse({
        message: `Found ${CODINGPROMPTS.length} prompts`,
        result: response,
      });
    }

    const prompt = CODINGPROMPTS.find((p) => p.name === args.promptid);

    if (!prompt) {
      logger.warn("Prompt not found", { promptId: args.promptid });

      return formatToolResponse({
        status: "error",
        message: `Prompt not found: ${args.promptid}`,
        error: {
          type: "promptnot_found",
          details: `No prompt with ID '${args.promptid}' exists. Available prompts: ${CODINGPROMPTS.map((p) => p.name).join(", ")}`,
        },
      });
    }

    logger.info("Found prompt", {
      promptId: args.promptid,
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
        type: "getprompt_error",
        details: error instanceof Error ? error.stack : undefined,
      },
    });
  }
};
