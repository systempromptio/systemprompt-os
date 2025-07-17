/**
 * @fileoverview Check status tool definition
 * @module constants/tool/check-status
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool for checking the status of Claude Code SDK and Gemini CLI
 */
export const checkStatus: Tool = {
  name: "check_status",
  description: "Check the status of Claude Code SDK and Gemini CLI availability by attempting to initiate test sessions",
  inputSchema: {
    type: "object",
    properties: {}
  }
};