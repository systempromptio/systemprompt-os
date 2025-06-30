import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const cleanState: Tool = {
  name: "clean_state",
  description: "Clean up system state by removing all tasks",
  inputSchema: {
    type: "object",
    properties: {}
  }
};