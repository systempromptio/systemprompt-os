/**
 * Request Context Types - STUB
 * TODO: Define proper request context types
 */

export interface MCPToolContext {
  requestId?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}