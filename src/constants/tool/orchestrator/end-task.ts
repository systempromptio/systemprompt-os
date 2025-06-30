import type { Tool } from "@modelcontextprotocol/sdk/types.js";

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