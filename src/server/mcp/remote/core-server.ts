/**
 * Core MCP Server implementation with dynamic handler loading.
 * @file Core MCP Server implementation with dynamic handler loading.
 * @module server/mcp/core/server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type CallToolResult,
  type GetPromptRequest,
  GetPromptRequestSchema,
  type GetPromptResult,
  type ListPromptsRequest,
  ListPromptsRequestSchema,
  type ListPromptsResult,
  type ListResourcesRequest,
  ListResourcesRequestSchema,
  type ListResourcesResult,
  type ListToolsRequest,
  ListToolsRequestSchema,
  type ListToolsResult,
  type ReadResourceRequest,
  ReadResourceRequestSchema,
  type ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { LogSource, LoggerService } from '@/modules/core/logger/index';
import { HTTP_INTERNAL_SERVER_ERROR, HTTP_NOT_FOUND } from '@/modules/core/auth/constants/index';
import type { IServerConfig, ISessionInfo } from '@/server/mcp/remote/types';
import { handleListTools, handleToolCall } from '@/server/mcp/core/handlers/tool-handlers';
import { handleGetPrompt, handleListPrompts } from '@/server/mcp/core/handlers/prompt-handlers';
import {
  handleListResources,
  handleResourceCall,
} from '@/server/mcp/core/handlers/resource-handlers';
import type { IMCPToolContext } from '@/server/mcp/core/types/request-context';

const logger = LoggerService.getInstance();

/**
 * Default server configuration values.
 */
const DEFAULT_CONFIG: Required<IServerConfig> = {
  name: 'systemprompt-os-core',
  version: '0.1.0',
  sessionTimeoutMs: 60 * 60 * 1000,
  cleanupIntervalMs: 5 * 60 * 1000,
} as const;

/**
 * Core MCP Server implementation providing tools, resources, and prompts.
 * With session management and dynamic handler loading.
 */
export class CoreMcpServer {
  public readonly name: string;
  public readonly version: string;
  private readonly sessions: Map<string, ISessionInfo>;
  private readonly sessionTimeoutMs: number;
  private cleanupInterval: NodeJS.Timeout | null;

  /**
   * Creates a new MCP server instance.
   * @param config - Optional server configuration.
   */
  constructor(config?: IServerConfig) {
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    const {
 name, version, sessionTimeoutMs
} = mergedConfig;
    this.name = name;
    this.version = version;
    this.sessionTimeoutMs = sessionTimeoutMs;
    this.sessions = new Map();
    this.cleanupInterval = null;

    this.startSessionCleanup(mergedConfig.cleanupIntervalMs);

    logger.info(LogSource.MCP, 'MCP server initialized', {
      name: this.name,
      version: this.version,
      sessionTimeout: this.sessionTimeoutMs,
    });
  }

  /**
   * Handles incoming MCP HTTP requests.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise that resolves when the request is handled.
   */
  async handleRequest(req: ExpressRequest, res: ExpressResponse): Promise<void> {
    try {
      const sessionId = this.extractSessionId(req);

      if (typeof sessionId === 'string' && sessionId.length > 0) {
        await this.handleExistingSession(sessionId, req, res);
      } else {
        await this.handleNewSession(req, res);
      }
    } catch (error) {
      logger.error(LogSource.MCP, 'MCP request error', {
        error: error instanceof Error ? error : String(error),
        metadata: {
          stack: error instanceof Error ? error.stack : undefined
        }
      });

      this.sendErrorResponse(res, error);
    }
  }

  /**
   * Gets the current number of active sessions.
   * @returns Number of active sessions.
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Gets detailed information about active sessions.
   * @returns Array of session statistics.
   */
  getSessionStats(): Array<{
    sessionId: string;
    createdAt: Date;
    lastAccessed: Date;
    age: number;
  }> {
    const now = Date.now();

    return Array.from(this.sessions.entries()).map(
      ([sessionId, info]): {
        sessionId: string;
        createdAt: Date;
        lastAccessed: Date;
        age: number;
      } => {
        return {
          sessionId,
          createdAt: info.createdAt,
          lastAccessed: info.lastAccessed,
          age: now - info.createdAt.getTime(),
        };
      },
    );
  }

  /**
   * Gracefully shuts down the server and all active sessions.
   */
  shutdown(): void {
    logger.info(LogSource.MCP, 'Server shutdown initiated', {
      activeSessions: this.sessions.size,
    });

    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const [sessionId, sessionInfo] of Array.from(this.sessions.entries())) {
      this.terminateSession(sessionId, sessionInfo);
    }

    logger.info(LogSource.MCP, 'Server shutdown completed');
  }

  /**
   * Starts the periodic session cleanup task.
   * @param intervalMs - Cleanup interval in milliseconds.
   */
  private startSessionCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval((): void => {
      this.cleanupExpiredSessions();
    }, intervalMs);
  }

  /**
   * Creates a new MCP server instance with configured handlers.
   * @param sessionId - Unique session identifier.
   * @param userId - Authenticated user ID.
   * @returns Configured server instance.
   */
  private createServer(sessionId: string, userId?: string): Server {
    const server = new Server(
      {
        name: this.name,
        version: this.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      },
    );

    const context: IMCPToolContext = {
      sessionId,
      ...userId !== undefined && { userId },
    };

    this.setupToolHandlers(server, context);
    this.setupResourceHandlers(server, context);
    this.setupPromptHandlers(server, context);

    logger.debug(LogSource.MCP, 'Server instance created', {
      sessionId,
      userId,
    });

    return server;
  }

  /**
   * Configures tool-related request handlers.
   * @param server - MCP server instance.
   * @param context - Request context containing session information.
   */
  private setupToolHandlers(server: Server, context: IMCPToolContext): void {
    server.setRequestHandler(
      ListToolsRequestSchema,
      async (request: ListToolsRequest): Promise<ListToolsResult> => {
        try {
          return await handleListTools(request, context);
        } catch (error) {
          logger.error(LogSource.MCP, 'Failed to list tools', {
            error: error instanceof Error ? error : String(error),
            sessionId: context.sessionId,
          });
          throw error;
        }
      },
    );

    server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest): Promise<CallToolResult> => {
        try {
          return await handleToolCall(request, context);
        } catch (error) {
          logger.error(LogSource.MCP, 'Failed to call tool', {
            error: error instanceof Error ? error : String(error),
            sessionId: context.sessionId,
            metadata: {
              tool: request.params.name,
            },
          });
          throw error;
        }
      },
    );
  }

  /**
   * Configures resource-related request handlers.
   * @param server - MCP server instance.
   * @param context - Request context containing session information.
   */
  private setupResourceHandlers(server: Server, context: IMCPToolContext): void {
    server.setRequestHandler(
      ListResourcesRequestSchema,
      async (_unusedRequest: ListResourcesRequest): Promise<ListResourcesResult> => {
        try {
          return await handleListResources();
        } catch (error) {
          logger.error(LogSource.MCP, 'Failed to list resources', {
            error: error instanceof Error ? error : String(error),
            sessionId: context.sessionId,
          });
          throw error;
        }
      },
    );

    server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request: ReadResourceRequest): Promise<ReadResourceResult> => {
        try {
          return await handleResourceCall(request);
        } catch (error) {
          logger.error(LogSource.MCP, 'Failed to read resource', {
            error: error instanceof Error ? error : String(error),
            sessionId: context.sessionId,
            metadata: {
              uri: request.params.uri,
            },
          });
          throw error;
        }
      },
    );
  }

  /**
   * Configures prompt-related request handlers.
   * @param server - MCP server instance.
   * @param context - Request context containing session information.
   */
  private setupPromptHandlers(server: Server, context: IMCPToolContext): void {
    server.setRequestHandler(
      ListPromptsRequestSchema,
      async (_unusedRequest: ListPromptsRequest): Promise<ListPromptsResult> => {
        try {
          return await handleListPrompts();
        } catch (error) {
          logger.error(LogSource.MCP, 'Failed to list prompts', {
            error: error instanceof Error ? error : String(error),
            sessionId: context.sessionId,
          });
          throw error;
        }
      },
    );

    server.setRequestHandler(
      GetPromptRequestSchema,
      async (request: GetPromptRequest): Promise<GetPromptResult> => {
        try {
          return await handleGetPrompt(request);
        } catch (error) {
          logger.error(LogSource.MCP, 'Failed to get prompt', {
            error: error instanceof Error ? error : String(error),
            sessionId: context.sessionId,
            metadata: {
              prompt: request.params.name,
            },
          });
          throw error;
        }
      },
    );
  }

  /**
   * Extracts session ID from request headers.
   * @param req - Express request object.
   * @returns Session ID if present, undefined otherwise.
   */
  private extractSessionId(req: ExpressRequest): string | undefined {
    const mcpSessionId = req.headers['mcp-session-id'];
    const xSessionId = req.headers['x-session-id'];
    return (typeof mcpSessionId === 'string' ? mcpSessionId : undefined) ?? (typeof xSessionId === 'string' ? xSessionId : undefined);
  }

  /**
   * Handles requests for existing sessions.
   * @param sessionId - Session identifier.
   * @param req - Express request object.
   * @param res - Express response object.
   */
  private async handleExistingSession(
    sessionId: string,
    req: ExpressRequest,
    res: ExpressResponse,
  ): Promise<void> {
    const sessionInfo = this.sessions.get(sessionId);

    if (sessionInfo === undefined) {
      res.status(HTTP_NOT_FOUND).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Session not found',
        },
        id: null,
      });
      return;
    }

    sessionInfo.lastAccessed = new Date();
    await sessionInfo.transport.handleRequest(req, res, req.body);
  }

  /**
   * Creates and handles a new session.
   * @param req - Express request object.
   * @param res - Express response object.
   */
  private async handleNewSession(req: ExpressRequest, res: ExpressResponse): Promise<void> {
    const userId = (req as ExpressRequest & { user?: { sub?: string } }).user?.sub;
    const sessionId = this.generateSessionId();
    const server = this.createServer(sessionId, userId);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: (): string => {
        return sessionId;
      },
    });

    await server.connect(transport);

    const sessionInfo: ISessionInfo = {
      server,
      transport,
      createdAt: new Date(),
      lastAccessed: new Date(),
    };

    this.sessions.set(sessionId, sessionInfo);

    res.setHeader('mcp-session-id', sessionId);
    res.setHeader('x-session-id', sessionId);

    await transport.handleRequest(req, res, req.body);

    logger.info(LogSource.MCP, 'New session created', {
      sessionId,
      userId,
      totalSessions: this.sessions.size,
    });
  }

  /**
   * Generates a unique session identifier.
   * @returns Unique session ID string.
   */
  private generateSessionId(): string {
    return `session_${Date.now().toString()}_${Math.random().toString(36)
.substring(2, 11)}`;
  }

  /**
   * Sends an error response to the client.
   * @param res - Express response object.
   * @param error - Error that occurred.
   */
  private sendErrorResponse(res: ExpressResponse, error: unknown): void {
    if (!res.headersSent) {
      res.status(HTTP_INTERNAL_SERVER_ERROR).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
        id: null,
      });
    }
  }

  /**
   * Removes expired sessions from memory.
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, sessionInfo] of Array.from(this.sessions.entries())) {
      const sessionAge = now - sessionInfo.lastAccessed.getTime();

      if (sessionAge > this.sessionTimeoutMs) {
        this.terminateSession(sessionId, sessionInfo);
        cleanedCount += 1;
      }
    }

    if (cleanedCount > 0) {
      logger.info(LogSource.MCP, 'Session cleanup completed', {
        cleanedSessions: cleanedCount,
        remainingSessions: this.sessions.size,
      });
    }
  }

  /**
   * Terminates a specific session.
   * @param sessionId - Session identifier.
   * @param sessionInfo - Session information object.
   */
  private terminateSession(sessionId: string, sessionInfo: ISessionInfo): void {
    try {
      sessionInfo.server.close().catch((closeError: unknown) => {
        logger.error(LogSource.MCP, 'Failed to close server', {
          error: closeError instanceof Error ? closeError : String(closeError)
        });
      });
      sessionInfo.transport.close().catch((closeError: unknown) => {
        logger.error(LogSource.MCP, 'Failed to close transport', {
          error: closeError instanceof Error ? closeError : String(closeError)
        });
      });
      this.sessions.delete(sessionId);

      logger.debug(LogSource.MCP, 'Session terminated', { sessionId });
    } catch (error) {
      logger.error(LogSource.MCP, 'Error terminating session', {
        error: error instanceof Error ? error : String(error),
        sessionId,
      });
    }
  }
}

/**
 * Factory function to create a new MCP server instance.
 * @param config - Optional server configuration.
 * @returns Configured MCP server instance.
 */
export const createMCPServer = function createMcpServer(config?: IServerConfig): CoreMcpServer {
  return new CoreMcpServer(config);
};
