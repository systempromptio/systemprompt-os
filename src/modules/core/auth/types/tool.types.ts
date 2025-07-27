/**
 * Tool definition interface.
 * Defines the structure of a tool in the authentication module.
 */
export interface IToolDefinition {
    name: string;
    description: string;
    inputSchema: {
    type: 'object';
    description?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };

    execute: (input: unknown, context: IToolContext) => Promise<IToolResult>;
}

/**
 * Tool execution context interface.
 * Provides context information for tool execution.
 */
export interface IToolContext {
    userId?: string;
    userEmail?: string;
    role?: string;
    sessionId?: string;
    isLocal?: boolean;
    permissions?: string[];
}

/**
 * Tool execution result interface.
 * Standard response format for tool execution.
 */
export interface IToolResult {
    message: string;

    result: unknown;
}

/**
 * Whoami tool input parameters interface.
 */
export interface IWhoamiParams {
    includePermissions?: boolean;

    includeSession?: boolean;
}

/**
 * Whoami tool result interface.
 */
export interface IWhoamiResult {
    userId: string;
    email: string;
    role: string;
    isAdmin: boolean;
    permissions?: string[];
    session?: {
        id: string;
        isLocal: boolean;
  };
}

/**
 * Type alias for ToolDefinition for compatibility.
 */
export type ToolDefinition = IToolDefinition;
