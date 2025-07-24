/**
 * MCP Request Context Types.
 */

export interface IRequestContext {
  userId?: string;
  sessionId?: string;
  permissions?: string[];
}

export interface IMCPToolContext extends IRequestContext {
  toolName?: string;
  requestId?: string;
}
