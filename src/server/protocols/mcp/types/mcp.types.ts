/**
 * MCP Protocol Types.
 */

export interface McpContext {
  moduleId: string;
  context: string;
  capabilities: {
    tools?: Array<{
      name: string;
      description: string;
      inputSchema?: any;
    }>;
    resources?: Array<{
      uri: string;
      name: string;
      description: string;
      mimeType?: string;
    }>;
    prompts?: Array<{
      name: string;
      description: string;
      arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
      }>;
    }>;
  };
  metadata?: {
    name: string;
    version: string;
    description?: string;
  };
  auth?: {
    required: boolean;
    scopes?: string[];
  };
}

export interface McpSession {
  id: string;
  context: string;
  userId?: string;
  createdAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}
