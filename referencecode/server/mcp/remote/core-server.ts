/**
 * @fileoverview Core MCP Server implementation with dynamic handler loading
 * @module server/mcp/core/server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type GetPromptRequest,
  type ReadResourceRequest,
  type ListToolsRequest,
  type ListPromptsRequest,
  type ListResourcesRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';
import type { Logger } from '@/modules/core/logger/index.js';
import { handleListTools, handleToolCall } from '../core/handlers/tool-handlers.js';
import { handleListPrompts, handleGetPrompt } from '../core/handlers/prompt-handlers.js';
import { handleListResources, handleResourceCall } from '../core/handlers/resource-handlers.js';
import type { MCPToolContext } from '../core/types/request-context.js';

/**
 * Represents an active MCP session with its associated server and transport
 */
interface SessionInfo {
  /** MCP server instance for this session */
  server: Server;
  /** HTTP transport layer for the session */
  transport: StreamableHTTPServerTransport;
  /** Session creation timestamp */
  createdAt: Date;
  /** Last access timestamp for session timeout management */
  lastAccessed: Date;
}

/**
 * Configuration options for the MCP server
 */
interface ServerConfig {
  /** Server name exposed to clients */
  name?: string;
  /** Server version string */
  version?: string;
  /** Session timeout duration in milliseconds */
  sessionTimeoutMs?: number;
  /** Interval for cleaning up expired sessions in milliseconds */
  cleanupIntervalMs?: number;
}

/**
 * Default server configuration values
 */
const DEFAULT_CONFIG: Required<ServerConfig> = {
  name: 'systemprompt-os-core',
  version: '0.1.0',
  sessionTimeoutMs: 60 * 60 * 1000, // 1 hour
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
} as const;

/**
 * Core MCP Server implementation providing tools, resources, and prompts
 * with session management and dynamic handler loading
 */
export class CoreMCPServer {
  public readonly name: string;
  public readonly version: string;

  private readonly sessions: Map<string, SessionInfo>;
  private readonly sessionTimeoutMs: number;
  private cleanupInterval: NodeJS.Timeout | null;

  /**
   * Creates a new MCP server instance
   *
   * @param config - Optional server configuration
   */
  constructor(config?: ServerConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    this.name = mergedConfig.name;
    this.version = mergedConfig.version;
    this.sessionTimeoutMs = mergedConfig.sessionTimeoutMs;
    this.sessions = new Map();
    this.cleanupInterval = null;

    this.startSessionCleanup(mergedConfig.cleanupIntervalMs);

    logger.info('MCP server initialized', {
      name: this.name,
      version: this.version,
      sessionTimeout: this.sessionTimeoutMs,
    });
  }

  /**
   * Starts the periodic session cleanup task
   *
   * @param intervalMs - Cleanup interval in milliseconds
   */
  private startSessionCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, intervalMs);
  }

  /**
   * Creates a new MCP server instance with configured handlers
   *
   * @param sessionId - Unique session identifier
   * @param userId - Authenticated user ID
   * @returns Configured server instance
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

    const context: MCPToolContext = {
      sessionId,
      ...(userId !== undefined && { userId }),
    };

    this.setupToolHandlers(server, context);
    this.setupResourceHandlers(server, context);
    this.setupPromptHandlers(server, context);

    logger.debug('Server instance created', { sessionId, userId });

    return server;
  }

  /**
   * Configures tool-related request handlers
   *
   * @param server - MCP server instance
   * @param context - Request context containing session information
   */
  private setupToolHandlers(server: Server, context: MCPToolContext): void {
    server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest) => {
      try {
        return await handleListTools(request, context);
      } catch (error) {
        logger.error('Failed to list tools', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: context.sessionId,
        });
        throw error;
      }
    });

    server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      try {
        return await handleToolCall(request, context);
      } catch (error) {
        logger.error('Failed to call tool', {
          tool: request.params.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: context.sessionId,
        });
        throw error;
      }
    });
  }

  /**
   * Configures resource-related request handlers
   *
   * @param server - MCP server instance
   * @param context - Request context containing session information
   */
  private setupResourceHandlers(server: Server, context: MCPToolContext): void {
    server.setRequestHandler(ListResourcesRequestSchema, async (_request: ListResourcesRequest) => {
      try {
        return await handleListResources();
      } catch (error) {
        logger.error('Failed to list resources', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: context.sessionId,
        });
        throw error;
      }
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
      try {
        return await handleResourceCall(request);
      } catch (error) {
        logger.error('Failed to read resource', {
          uri: request.params.uri,
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: context.sessionId,
        });
        throw error;
      }
    });
  }

  /**
   * Configures prompt-related request handlers
   *
   * @param server - MCP server instance
   * @param context - Request context containing session information
   */
  private setupPromptHandlers(server: Server, context: MCPToolContext): void {
    server.setRequestHandler(ListPromptsRequestSchema, async (_request: ListPromptsRequest) => {
      try {
        return await handleListPrompts();
      } catch (error) {
        logger.error('Failed to list prompts', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: context.sessionId,
        });
        throw error;
      }
    });

    server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
      try {
        return await handleGetPrompt(request);
      } catch (error) {
        logger.error('Failed to get prompt', {
          prompt: request.params.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: context.sessionId,
        });
        throw error;
      }
    });
  }

  /**
   * Handles incoming MCP HTTP requests
   *
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise that resolves when the request is handled
   */
  async handleRequest(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = this.extractSessionId(req);

      if (sessionId) {
        await this.handleExistingSession(sessionId, req, res);
      } else {
        await this.handleNewSession(req, res);
      }
    } catch (error) {
      logger.error('MCP request error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      this.sendErrorResponse(res, error);
    }
  }

  /**
   * Extracts session ID from request headers
   *
   * @param req - Express request object
   * @returns Session ID if present, undefined otherwise
   */
  private extractSessionId(req: Request): string | undefined {
    return (req.headers['mcp-session-id'] as string) || (req.headers['x-session-id'] as string);
  }

  /**
   * Handles requests for existing sessions
   *
   * @param sessionId - Session identifier
   * @param req - Express request object
   * @param res - Express response object
   */
  private async handleExistingSession(
    sessionId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const sessionInfo = this.sessions.get(sessionId);

    if (!sessionInfo) {
      res.status(404).json({
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
   * Creates and handles a new session
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  private async handleNewSession(req: Request, res: Response): Promise<void> {
    const userId = req.user?.sub;
    const sessionId = this.generateSessionId();
    const server = this.createServer(sessionId, userId);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
    });

    await server.connect(transport);

    const sessionInfo: SessionInfo = {
      server,
      transport,
      createdAt: new Date(),
      lastAccessed: new Date(),
    };

    this.sessions.set(sessionId, sessionInfo);

    res.setHeader('mcp-session-id', sessionId);
    res.setHeader('x-session-id', sessionId);

    await transport.handleRequest(req, res, req.body);

    logger.info('New session created', {
      sessionId,
      userId,
      totalSessions: this.sessions.size,
    });
  }

  /**
   * Generates a unique session identifier
   *
   * @returns Unique session ID string
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Sends an error response to the client
   *
   * @param res - Express response object
   * @param error - Error that occurred
   */
  private sendErrorResponse(res: Response, error: unknown): void {
    if (!res.headersSent) {
      res.status(500).json({
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
   * Removes expired sessions from memory
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, sessionInfo] of this.sessions.entries()) {
      const sessionAge = now - sessionInfo.lastAccessed.getTime();

      if (sessionAge > this.sessionTimeoutMs) {
        this.terminateSession(sessionId, sessionInfo);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Session cleanup completed', {
        cleanedSessions: cleanedCount,
        remainingSessions: this.sessions.size,
      });
    }
  }

  /**
   * Terminates a specific session
   *
   * @param sessionId - Session identifier
   * @param sessionInfo - Session information object
   */
  private terminateSession(sessionId: string, sessionInfo: SessionInfo): void {
    try {
      sessionInfo.server.close();
      sessionInfo.transport.close();
      this.sessions.delete(sessionId);

      logger.debug('Session terminated', { sessionId });
    } catch (error) {
      logger.error('Error terminating session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Gets the current number of active sessions
   *
   * @returns Number of active sessions
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Gets detailed information about active sessions
   *
   * @returns Array of session statistics
   */
  getSessionStats(): Array<{
    sessionId: string;
    createdAt: Date;
    lastAccessed: Date;
    age: number;
  }> {
    const now = Date.now();

    return Array.from(this.sessions.entries()).map(([sessionId, info]) => ({
      sessionId,
      createdAt: info.createdAt,
      lastAccessed: info.lastAccessed,
      age: now - info.createdAt.getTime(),
    }));
  }

  /**
   * Gracefully shuts down the server and all active sessions
   */
  shutdown(): void {
    logger.info('Server shutdown initiated', {
      activeSessions: this.sessions.size,
    });

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const [sessionId, sessionInfo] of this.sessions.entries()) {
      this.terminateSession(sessionId, sessionInfo);
    }

    logger.info('Server shutdown completed');
  }
}

/**
 * Factory function to create a new MCP server instance
 *
 * @param config - Optional server configuration
 * @returns Configured MCP server instance
 */
export function createMCPServer(config?: ServerConfig): CoreMCPServer {
  return new CoreMCPServer(config);
}
