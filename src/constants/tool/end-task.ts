/**
 * @fileoverview End task tool definition
 * @module constants/tool/end-task
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool for ending tasks and cleaning up sessions
 */
export const endTask: Tool = {
  name: "end_task",
  description: "End a task and clean up the AI model session",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The ID of the task to end"
      }
    },
    required: ["id"]
  }
};