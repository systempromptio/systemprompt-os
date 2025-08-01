/**
 * MCP protocol handler with session management and per-session server instances.
 * @module server/mcp
 */

import type {
  Application,
  Request,
  Response,
} from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListRootsRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { serverCapabilities, serverConfig } from '@/server/mcp/config';
import {
  rateLimitMiddleware,
  requestSizeLimit,
  validateProtocolVersion,
} from '@/server/middleware';
import { handleGetPrompt, handleListPrompts } from '@/server/mcp/core/handlers/prompt-handlers';
import {
  handleListResources,
  handleResourceCall,
} from '@/server/mcp/core/handlers/resource-handlers';
import {
  handleListResourceTemplates,
} from '@/server/mcp/core/handlers/resource-templates-handler';
import { handleListRoots } from '@/server/mcp/core/handlers/roots-handlers';
import { handleListTools, handleToolCall } from '@/server/mcp/core/handlers/tool-handlers';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/manual';
import {
  type IMcpHandler,
  type ISessionInfo,
  MCP_CONSTANTS,
} from '@/server/types/mcp.types';

const logger = LoggerService.getInstance();

/**
 * MCP Handler with per-session server instances.
 */
export class McpHandler implements IMcpHandler {
  private readonly sessions = new Map<string, ISessionInfo>();
  private readonly cleanupInterval: NodeJS.Timeout;
  private readonly sessionTimeoutMs = MCP_CONSTANTS.sessionTimeoutMs;

  /**
   * Constructor.
   */
  constructor() {
    this.cleanupInterval = setInterval((): void => {
      this.cleanupOldSessions();
    }, MCP_CONSTANTS.sessionCheckIntervalMs);
  }

  /**
   * Sets up routes for the Express app.
   * @param app
   */
  async setupRoutes(app: Application): Promise<void> {
    await Promise.resolve();
    const mcpMiddleware = [
      rateLimitMiddleware(
        MCP_CONSTANTS.rateLimitWindowMs,
        MCP_CONSTANTS.rateLimitMaxRequests,
      ),
      validateProtocolVersion,
      requestSizeLimit(MCP_CONSTANTS.maxRequestSizeMb * MCP_CONSTANTS.bytesPerMb),
    ];

    app.all('/mcp', ...mcpMiddleware, async (req, res): Promise<void> => {
      await this.handleRequest(req, res);
    });
  }

  /**
   * Get the server instance for a specific session.
   * @param sessionId
   */
  getServerForSession(sessionId: string): Server | undefined {
    const sessionInfo = this.sessions.get(sessionId);
    return sessionInfo?.server;
  }

  /**
   * Get all active servers.
   */
  getAllServers(): Server[] {
    return Array.from(this.sessions.values()).map((info): Server => {
      return info.server;
    });
  }

  /**
   * Get any server instance (for compatibility).
   */
  getServer(): Server {
    const iterator = this.sessions.values();
    const { value: firstSession } = iterator.next();
    if (firstSession !== undefined) {
      return firstSession.server;
    }
    return new Server(serverConfig, serverCapabilities);
  }

  /**
   * Clean up a specific session.
   * @param sessionId
   */
  cleanupSession(sessionId: string): void {
    const sessionInfo = this.sessions.get(sessionId);
    if (sessionInfo !== undefined) {
      sessionInfo.server.close().catch((): void => {
        logger.debug(LogSource.MCP, 'Error closing server during cleanup');
      });
      sessionInfo.transport.close().catch((): void => {
        logger.debug(LogSource.MCP, 'Error closing transport during cleanup');
      });
      this.sessions.delete(sessionId);
      logger.debug(LogSource.MCP, `Cleaned up session: ${sessionId}`, { sessionId });
    }
  }

  /**
   * Get active session count.
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Shutdown handler - closes all sessions and cleans up resources.
   */
  shutdown(): void {
    clearInterval(this.cleanupInterval);

    for (const sessionInfo of this.sessions.values()) {
      sessionInfo.server.close().catch((): void => {
        logger.debug(LogSource.MCP, 'Error closing server during shutdown');
      });
      sessionInfo.transport.close().catch((): void => {
        logger.debug(LogSource.MCP, 'Error closing transport during shutdown');
      });
    }
    this.sessions.clear();

    logger.info(LogSource.MCP, 'MCP Handler shut down');
  }

  /**
   * Creates a new server instance with handlers.
   * @param sessionId
   */
  private createServer(sessionId: string): Server {
    const server = new Server(serverConfig, serverCapabilities);

    this.registerToolHandlers(server, sessionId);
    this.registerPromptHandlers(server, sessionId);
    this.registerResourceHandlers(server, sessionId);

    return server;
  }

  /**
   * Register tool handlers.
   * @param server
   * @param sessionId
   */
  private registerToolHandlers(server: Server, sessionId: string): void {
    server.setRequestHandler(
      ListToolsRequestSchema,
      async (request) => {
        logger.debug(LogSource.MCP, `📋 [${sessionId}] Listing tools`, { sessionId });
        return await handleListTools(request);
      },
    );

    server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        logger.debug(LogSource.MCP, `🔧 [${sessionId}] Calling tool: ${request.params.name}`, {
 sessionId,
toolName: request.params.name
});
        logger.info(
          LogSource.MCP,
          'MCP tool request params:',
          {
 sessionId,
params: request.params,
persistToDb: false
}
        );
        logger.info(
          LogSource.MCP,
          'MCP tool request full:',
          {
 sessionId,
request,
persistToDb: false
}
        );
        return await handleToolCall(request, { sessionId });
      },
    );
  }

  /**
   * Register prompt handlers.
   * @param server
   * @param sessionId
   */
  private registerPromptHandlers(server: Server, sessionId: string): void {
    server.setRequestHandler(
      ListPromptsRequestSchema,
      async () => {
        logger.debug(LogSource.MCP, `[${sessionId}] Listing prompts`, { sessionId });
        return await handleListPrompts();
      },
    );

    server.setRequestHandler(
      GetPromptRequestSchema,
      async (request) => {
        logger.debug(LogSource.MCP, `[${sessionId}] Getting prompt: ${request.params.name}`, {
 sessionId,
promptName: request.params.name
});
        return await handleGetPrompt(request);
      },
    );
  }

  /**
   * Register resource handlers.
   * @param server
   * @param sessionId
   */
  private registerResourceHandlers(server: Server, sessionId: string): void {
    server.setRequestHandler(
      ListResourcesRequestSchema,
      async () => {
        logger.debug(LogSource.MCP, `[${sessionId}] Listing resources`, { sessionId });
        return await handleListResources();
      },
    );

    server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        logger.debug(LogSource.MCP, `[${sessionId}] Reading resource: ${request.params.uri}`, {
 sessionId,
resourceUri: request.params.uri
});
        return await handleResourceCall(request);
      },
    );

    server.setRequestHandler(
      ListRootsRequestSchema,
      async (request) => {
        logger.debug(LogSource.MCP, `[${sessionId}] Listing roots`, { sessionId });
        return await handleListRoots(request);
      },
    );

    server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      (request) => {
        logger.debug(LogSource.MCP, `[${sessionId}] Listing resource templates`, { sessionId });
        logger.info(
          LogSource.MCP,
          'Resource templates request:',
          {
 sessionId,
request,
persistToDb: false
}
        );
        return handleListResourceTemplates(request);
      },
    );
  }

  /**
   * Handles incoming MCP requests with proper session management.
   * @param req
   * @param res
   */
  private async handleRequest(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const requestSessionId = this.extractSessionId(req);
      this.logIncomingRequest(req, requestSessionId);
      res.header('Access-Control-Expose-Headers', 'mcp-session-id, x-session-id');

      const sessionResult = await this.getOrCreateSession(req, res);
      if (sessionResult === null) {
        return;
      }

      await this.processSessionRequest({
 sessionResult,
req,
res,
startTime
});
    } catch (error) {
      this.handleRequestError(error, res, startTime);
    }
  }

  /**
   * Extract session ID from request headers.
   * @param req
   */
  private extractSessionId(req: Request): string | undefined {
    const { 'mcp-session-id': mcpSessionId, 'x-session-id': xSessionId } = req.headers;
    if (typeof mcpSessionId === 'string') {
      return mcpSessionId;
    }
    if (typeof xSessionId === 'string') {
      return xSessionId;
    }
    return undefined;
  }

  /**
   * Log incoming request details.
   * @param req
   * @param sessionId
   */
  private logIncomingRequest(req: Request, sessionId: string | undefined): void {
    const { headers, method } = req;
    logger.debug(LogSource.MCP, `MCP ${method} request`, {
      headers,
      sessionId,
      acceptHeader: headers.accept,
    });
  }

  /**
   * Process session request.
   * @param options
   * @param options.sessionResult
   * @param options.sessionResult.sessionId
   * @param options.sessionResult.sessionInfo
   * @param options.req
   * @param options.res
   * @param options.startTime
   */
  private async processSessionRequest(options: {
    sessionResult: { sessionId: string; sessionInfo: ISessionInfo };
    req: Request;
    res: Response;
    startTime: number;
  }): Promise<void> {
    const {
 sessionResult, req, res, startTime
} = options;
    const { sessionId, sessionInfo } = sessionResult;
    sessionInfo.lastAccessed = new Date();
    await sessionInfo.transport.handleRequest(req, res);

    logger.debug(
      LogSource.MCP,
      `MCP request completed in ${String(Date.now() - startTime)}ms for session ${sessionId}`,
      {
        sessionId,
        duration: Date.now() - startTime,
      },
    );
  }

  /**
   * Handle request error.
   * @param error
   * @param res
   * @param startTime
   */
  private handleRequestError(error: unknown, res: Response, startTime: number): void {
    logger.error(LogSource.MCP, 'MCP request failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
    });

    if (!res.headersSent) {
      res.status(MCP_CONSTANTS.internalServerErrorStatus).json({
        jsonrpc: '2.0',
        error: {
          code: MCP_CONSTANTS.jsonrpcInternalErrorCode,
          message: 'Internal error',
        },
        id: null,
      });
    }
  }

  /**
   * Get or create session from request.
   * @param req
   * @param res
   */
  private async getOrCreateSession(
    req: Request,
    res: Response,
  ): Promise<{ sessionId: string; sessionInfo: ISessionInfo } | null> {
    const { headers } = req;
    const { 'mcp-session-id': mcpSessionHeader } = headers;
    const { 'x-session-id': xSessionHeader } = headers;
    const sessionId
      = (typeof mcpSessionHeader === 'string' ? mcpSessionHeader : undefined)
      ?? (typeof xSessionHeader === 'string' ? xSessionHeader : undefined);

    logger.info(
      LogSource.MCP,
      `[SESSION] Request method: ${req.method}, Session ID: ${sessionId ?? 'none'}`,
      {
        sessionId,
        method: req.method,
      },
    );

    if (sessionId === undefined) {
      return await this.createNewSession();
    }

    const sessionInfo = this.sessions.get(sessionId);
    if (sessionInfo === undefined) {
      this.handleSessionNotFound(sessionId, res);
      return null;
    }

    logger.info(
      LogSource.MCP,
      `[SESSION] Found session ${sessionId}, handling ${req.method} request`,
      {
        sessionId,
        method: req.method,
      },
    );
    return {
      sessionId,
      sessionInfo,
    };
  }

  /**
   * Create new session.
   */
  private async createNewSession(): Promise<{ sessionId: string; sessionInfo: ISessionInfo }> {
    const sessionId = `session_${String(Date.now())}_${Math.random()
      .toString(MCP_CONSTANTS.radixBase36)
      .substring(
        MCP_CONSTANTS.sessionIdSubstringStart,
        MCP_CONSTANTS.sessionIdSubstringEnd,
      )}`;
    logger.info(LogSource.MCP, `[SESSION] Creating new session: ${sessionId}`, { sessionId });

    const server = this.createServer(sessionId);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: (): string => {
        return sessionId;
      },
      onsessioninitialized: (sid: string): void => {
        logger.info(LogSource.MCP, `🔗 New session initialized: ${sid}`, { sessionId: sid });
      },
      enableJsonResponse: false,
    });

    await server.connect(transport);

    const sessionInfo: ISessionInfo = {
      server,
      transport,
      createdAt: new Date(),
      lastAccessed: new Date(),
    };
    this.sessions.set(sessionId, sessionInfo);

    logger.debug(
      LogSource.MCP,
      `📝 Created new session with dedicated server: ${sessionId}`,
      { sessionId },
    );
    return {
      sessionId,
      sessionInfo,
    };
  }

  /**
   * Handle session not found error.
   * @param sessionId
   * @param res
   */
  private handleSessionNotFound(sessionId: string, res: Response): void {
    logger.error(LogSource.MCP, `[SESSION] Session not found: ${sessionId}`, { sessionId });
    logger.info(
      LogSource.MCP,
      `[SESSION] Active sessions: ${Array.from(this.sessions.keys()).join(', ')}`,
      { activeSessions: Array.from(this.sessions.keys()) },
    );
    res.status(MCP_CONSTANTS.notFoundStatus).json({
      jsonrpc: '2.0',
      error: {
        code: MCP_CONSTANTS.jsonrpcSessionNotFoundCode,
        message: 'Session not found',
      },
      id: null,
    });
  }

  /**
   * Clean up old sessions that have exceeded the timeout.
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, sessionInfo] of this.sessions.entries()) {
      const age = now - sessionInfo.lastAccessed.getTime();
      if (age > this.sessionTimeoutMs) {
        sessionInfo.server.close().catch((): void => {
          logger.debug(LogSource.MCP, 'Error closing server during cleanup');
        });
        sessionInfo.transport.close().catch((): void => {
          logger.debug(LogSource.MCP, 'Error closing transport during cleanup');
        });
        this.sessions.delete(sessionId);
        cleaned += MCP_CONSTANTS.increment;
      }
    }

    if (cleaned > MCP_CONSTANTS.zero) {
      logger.info(
        LogSource.MCP,
        `Cleaned up ${String(cleaned)} old sessions`,
        { cleanedCount: cleaned },
      );
    }
  }
}

let mcpHandlerInstance: McpHandler | null = null;

/**
 * Set the global MCP handler instance.
 * @param handler
 */
export const setMcpHandlerInstance = (handler: McpHandler): void => {
  mcpHandlerInstance = handler;
};

/**
 * Get the global MCP handler instance.
 */
export const getMcpHandlerInstance = (): McpHandler | null => {
  return mcpHandlerInstance;
};
