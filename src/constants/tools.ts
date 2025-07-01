/**
 * @fileoverview MCP tool definitions aggregator
 * @module constants/tools
 * @since 1.0.0
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Core orchestrator tools
import { createTask } from "./tool/create-task.js";
import { updateTask } from "./tool/update-task.js";
import { endTask } from "./tool/end-task.js";
import { reportTask } from "./tool/report-task.js";
import { checkStatus } from "./tool/check-status.js";
import { cleanState } from "./tool/clean-state.js";
import { getPrompt } from "./tool/get-prompt.js";

/**
 * All available tools in the MCP server
 * @since 1.0.0
 */
export const TOOLS: Tool[] = [
  createTask,
  updateTask,
  endTask,
  reportTask,
  checkStatus,
  cleanState,
  getPrompt
];