import type { Tool } from "@modelcontextprotocol/sdk/types.js";

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