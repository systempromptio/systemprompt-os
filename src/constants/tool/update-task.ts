/**
 * @fileoverview Update task tool definition
 * @module constants/tool/update-task
 * @since 1.0.0
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool for sending instructions to active AI processes
 * @since 1.0.0
 */
export const updateTask: Tool = {
  name: "update_task",
  description: "Send instructions to an active AI process (Claude Code or Gemini CLI)",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The task ID or session ID. If a task ID is provided, it will automatically find the associated session"
      },
      instructions: {
        type: "string",
        description: "Instructions to send to the AI agent"
      }
    },
    required: ["id", "instructions"]
  }
};