/**
 * @file Core type definitions and interfaces for orchestrator tool handlers.
 * @module handlers/types/core
 * @description This module provides essential type definitions for tool handlers,
 * including context interfaces, handler function types, response structures,
 * and utility functions for formatting tool responses.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type { CallToolResult };

/**
 * Context passed to individual tool handlers.
 * @interface IToolHandlerContext
 */
export interface IToolHandlerContext {
  userId?: string;
  sessionId?: string;
  progressToken?: string | number;
}

/**
 * Tool handler function type.
 * @template T - The type of arguments the handler accepts.
 */
export type ToolHandler<T = unknown> = (
  args: T,
  context?: IToolHandlerContext,
) => Promise<CallToolResult>;

/**
 * Standard response type for all tool handlers.
 * @template T - The type of the result data.
 */
export interface IToolResponse<T = unknown> extends Record<string, unknown> {
  status: "success" | "error";
  message: string;
  result?: T;
  error?: {
    type: string;
    details?: unknown;
  };
}

/**
 * Helper function to format tool responses.
 * @template T - The type of the result data.
 * @param response - Partial response object with required message.
 * @returns Formatted CallToolResult with structured content.
 * @example
 * ```typescript
 * return formatToolResponse({
 *   message: "Task created successfully",
 *   result: { taskId: "task_123" }
 * });
 * ```
 */
export const formatToolResponse = <T = unknown>(
  response: Partial<IToolResponse<T>> & Pick<IToolResponse<T>, "message">,
): CallToolResult => {
  const standardResponse: IToolResponse<T> = {
    status: response.status ?? "success",
    message: response.message,
    ...response.result != null && { result: response.result },
    ...response.error != null && { error: response.error },
  };

  return {
    content: [
      {
        type: "text",
        text: response.message,
      },
    ],
    structuredContent: standardResponse,
  };
};
