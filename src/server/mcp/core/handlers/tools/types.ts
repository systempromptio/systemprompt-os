/**
 * @file Core type definitions and interfaces for orchestrator tool handlers.
 * @module handlers/tools/types
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type { CallToolResult };

/**
 * Context passed to individual tool handlers.
 */
export interface IToolHandlerContext {
  userId?: string;
  sessionId?: string;
  progressToken?: string | number;
}

/**
 * Tool handler function type.
 */
export type ToolHandler<T = any> = (
  args: T,
  context?: IToolHandlerContext,
) => Promise<CallToolResult>;

/**
 * Standard response type for all tool handlers.
 */
export interface IToolResponse<T = any> {
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
export const formatToolResponse = <T = any>(
  response: Partial<IToolResponse<T>> & Pick<IToolResponse<T>, "message">,
): CallToolResult => {
  const standardResponse: IToolResponse<T> = {
    status: response.status || "success",
    message: response.message,
    ...response.result && { result: response.result },
    ...response.error && { error: response.error },
  };

  return {
    content: [
      {
        type: "text",
        text: response.message,
      },
    ],
    structuredContent: standardResponse as any,
  };
}
