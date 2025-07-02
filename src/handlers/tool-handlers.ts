/**
 * @fileoverview MCP Tool request handlers for Coding Agent Orchestrator
 * @module handlers/tool-handlers
 * 
 * @remarks
 * This module provides request handlers for MCP tool operations.
 * It handles tool listing and invocation, including validation of
 * tool arguments using Zod schemas derived from JSON Schema definitions.
 * All tool invocations are routed to their specific handlers.
 * 
 * @example
 * ```typescript
 * import { handleListTools, handleToolCall } from './handlers/tool-handlers';
 * 
 * // List available tools
 * const tools = await handleListTools(request);
 * 
 * // Call a specific tool
 * const result = await handleToolCall({
 *   params: {
 *     name: 'create_task',
 *     arguments: { tool: 'CLAUDECODE', instructions: 'Build API' }
 *   }
 * }, context);
 * ```
 */

import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TOOLS } from '../constants/tools.js';
import { logger } from '../utils/logger.js';
import { jsonSchemaToZod } from '../utils/json-schema-to-zod.js';
import type { MCPToolContext } from '../types/request-context.js';

import { createTask } from '../constants/tool/create-task.js';
import { updateTask } from '../constants/tool/update-task.js';
import { endTask } from '../constants/tool/end-task.js';
import { reportTask } from '../constants/tool/report-task.js';
import { checkStatus } from '../constants/tool/check-status.js';
import { cleanState } from '../constants/tool/clean-state.js';
import { getPrompt } from '../constants/tool/get-prompt.js';

import { handleCreateTask } from './tools/create-task.js';
import { handleUpdateTask } from './tools/update-task.js';
import { handleEndTask } from './tools/end-task.js';
import { handleReportTask } from './tools/report-task.js';
import { handleCheckStatus } from './tools/check-status.js';
import { handleCleanState } from './tools/clean-state.js';
import { handleGetPrompt } from './tools/get-prompt.js';

/**
 * Zod schemas derived from tool JSON Schema definitions
 * 
 * @constant
 */
const ToolSchemas = {
  create_task: jsonSchemaToZod(createTask.inputSchema),
  update_task: jsonSchemaToZod(updateTask.inputSchema),
  end_task: jsonSchemaToZod(endTask.inputSchema),
  report: jsonSchemaToZod(reportTask.inputSchema),
  check_status: jsonSchemaToZod(checkStatus.inputSchema),
  clean_state: jsonSchemaToZod(cleanState.inputSchema),
  get_prompt: jsonSchemaToZod(getPrompt.inputSchema)
};

/**
 * Handles MCP tool listing requests
 * 
 * @param _request - The list tools request (unused)
 * @returns List of available tools sorted alphabetically
 * 
 * @example
 * ```typescript
 * const { tools } = await handleListTools({});
 * console.log(`Available tools: ${tools.length}`);
 * ```
 */
export async function handleListTools(_request: ListToolsRequest): Promise<ListToolsResult> {
  try {
    const tools = [...TOOLS].sort((a, b) => a.name.localeCompare(b.name));
    return { tools };
  } catch (error) {
    logger.error("Failed to list tools", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { tools: TOOLS };
  }
}

/**
 * Handles MCP tool invocation requests with validation and routing
 * 
 * @param request - The tool call request with name and arguments
 * @param context - The MCP context including session information
 * @returns The tool execution result
 * @throws {Error} If tool is unknown or arguments are invalid
 * 
 * @remarks
 * This function:
 * 1. Validates that the requested tool exists
 * 2. Validates arguments using the tool's Zod schema
 * 3. Routes to the appropriate handler function
 * 4. Provides comprehensive error handling and logging
 * 
 * @example
 * ```typescript
 * const result = await handleToolCall({
 *   params: {
 *     name: 'check_status',
 *     arguments: { context: 'tasks' }
 *   }
 * }, { sessionId: 'mcp123', sessionConfig: {} });
 * ```
 */
export async function handleToolCall(
  request: CallToolRequest,
  context: MCPToolContext,
): Promise<CallToolResult> {
  
  try {
    logger.info(`🔧 handleToolCall called for tool: ${request.params.name}`);
    logger.debug('Tool arguments:', JSON.stringify(request.params.arguments, null, 2));
    
    if (!request.params.arguments) {
      logger.error("Tool call missing required arguments", { toolName: request.params?.name });
      throw new Error("Arguments are required");
    }

    const tool = TOOLS.find((t) => t.name === request.params.name);
    if (!tool) {
      logger.error("Unknown tool requested", { toolName: request.params.name });
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const toolName = request.params.name as keyof typeof ToolSchemas;
    const schema = ToolSchemas[toolName];
    
    if (!schema) {
      logger.error("No Zod schema found for tool", { toolName });
      throw new Error(`No validation schema found for tool: ${toolName}`);
    }
    
    let args: unknown;
    try {
      args = schema.parse(request.params.arguments);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("Tool argument validation failed", { 
          toolName, 
          errors: error.errors,
          arguments: request.params.arguments 
        });
        throw new Error(`Invalid arguments for tool ${toolName}: ${JSON.stringify(error.errors)}`);
      }
      throw error;
    }

    let result: CallToolResult;

    logger.info(`[HANDLER] Processing ${request.params.name} for session: ${context.sessionId}`);
    
    switch (request.params.name) {
      case "create_task":
        result = await handleCreateTask(args as Parameters<typeof handleCreateTask>[0], context);
        break;
      case "update_task":
        result = await handleUpdateTask(args as Parameters<typeof handleUpdateTask>[0], context);
        break;
      case "end_task":
        result = await handleEndTask(args as Parameters<typeof handleEndTask>[0], context);
        break;
      case "report":
        result = await handleReportTask(args as Parameters<typeof handleReportTask>[0], context);
        break;
      case "check_status":
        result = await handleCheckStatus(args as Parameters<typeof handleCheckStatus>[0], context);
        break;
      case "clean_state":
        result = await handleCleanState(args as Parameters<typeof handleCleanState>[0], context);
        break;
      case "get_prompt":
        result = await handleGetPrompt(args as Parameters<typeof handleGetPrompt>[0], context);
        break;
      default:
        logger.error("Unsupported tool in switch statement", { toolName: request.params.name });
        throw new Error(`Unknown tool: ${request.params.name}`);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Tool call failed", {
      toolName: request.params?.name,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}