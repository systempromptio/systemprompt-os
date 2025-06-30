import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const checkStatus: Tool = {
  name: "check_status",
  description: "Check the status of Claude Code SDK and Gemini CLI availability by attempting to initiate test sessions",
  inputSchema: {
    type: "object",
    properties: {}
  }
};