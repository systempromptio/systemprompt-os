/**
 * MCP Request Context Types.
 */

export interface RequestContext {
  userId?: string;
  sessionId?: string;
  permissions?: string[];
}

export interface MCPToolContext extends RequestContext {
  toolName?: string;
  requestId?: string;
}
