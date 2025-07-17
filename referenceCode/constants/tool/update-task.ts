/**
 * @fileoverview Update task tool definition
 * @module constants/tool/update-task
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool for sending instructions to active AI processes
 */
export const updateTask: Tool = {
  name: "update_task",
  description: "Send instructions to an active AI process (Claude Code or Gemini CLI)",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The task ID (required). Use the task ID returned from create_task.",
      },
      instructions: {
        type: "string",
        description: "Instructions to send to the AI agent",
      },
    },
    required: ["id", "instructions"],
  },
  _meta: {
    subscription: true,
  },
};
