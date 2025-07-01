/**
 * @fileoverview Request context types for MCP handlers
 * @module types/request-context
 * @since 1.0.0
 * 
 * @remarks
 * This module defines the context types passed to MCP handler functions.
 * These types ensure type safety for session information throughout
 * the request lifecycle.
 */


/**
 * Authentication information for request context
 * @interface
 * @since 1.0.0
 */
export interface AuthInfo {
  /**
   * Authenticated user ID
   * @since 1.0.0
   */
  readonly userId?: string;
  
  /**
   * Authentication token
   * @since 1.0.0
   */
  readonly token?: string;
  
  /**
   * User roles
   * @since 1.0.0
   */
  readonly roles?: string[];
  
  /**
   * User permissions
   * @since 1.0.0
   */
  readonly permissions?: string[];
  
  /**
   * Additional auth metadata
   * @since 1.0.0
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Context passed from MCP server to tool handler functions
 * @interface
 * @since 1.0.0
 * 
 * @remarks
 * This context provides session information for handlers to track state.
 * 
 * @example
 * ```typescript
 * export async function handleTool(
 *   args: ToolArgs,
 *   context: MCPToolContext
 * ): Promise<ToolResult> {
 *   const { sessionId } = context;
 *   // Use context for session tracking
 * }
 * ```
 */
export interface MCPToolContext {
  /**
   * Unique session identifier for the current MCP connection.
   * Used to track per-session state and route notifications.
   * @since 1.0.0
   */
  sessionId: string;
  
  /**
   * Optional authentication information for future use.
   * @since 1.0.0
   */
  authInfo?: AuthInfo;
}

