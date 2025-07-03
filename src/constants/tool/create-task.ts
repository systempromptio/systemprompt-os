/**
 * @fileoverview Create task tool definition
 * @module constants/tool/create-task
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool for creating and starting new tasks
 */
export const createTask: Tool = {
  name: "create_task",
  description: "Create a new task and start it immediately with Claude Code",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Brief title or summary of the task (max 255 chars)",
      },
      instructions: {
        type: "string",
        description: "Detailed instructions of what needs to be done",
      },
    },
    required: ["title", "instructions"],
  },
  _meta: {
    subscription: true,
  },
};
