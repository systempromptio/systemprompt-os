/**
 * @fileoverview Clean state tool definition
 * @module constants/tool/clean-state
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool for cleaning up system state
 */
export const cleanState: Tool = {
  name: "clean_state",
  description: "Clean up system state by removing all tasks",
  inputSchema: {
    type: "object",
    properties: {}
  }
};