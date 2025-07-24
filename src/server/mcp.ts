/**
 * MCP protocol handler with session management and per-session server instances.
 * @file MCP protocol handler with session management and per-session server instances.
 * @module server/mcp
 */

import type express from 'express';
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

import { serverCapabilities, serverConfig } from '@/server/mcp/config.js';
import {
  rateLimitMiddleware,
  requestSizeLimit,
  validateProtocolVersion,
} from '@/server/middleware.js';
import { handleGetPrompt, handleListPrompts } from '@/server/mcp/core/handlers/prompt-handlers.js';
import {
  handleListResources,
  handleResourceCall,
} from '@/server/mcp/core/handlers/resource-handlers.js';
import {
  handleListResourceTemplates,
} from '@/server/mcp/core/handlers/resource-templates-handler.js';
import { handleListRoots } from '@/server/mcp/core/handlers/roots-handlers.js';
import { handleListTools, handleToolCall } from '@/server/mcp/core/handlers/tool-handlers.js';
import { LoggerService } from '@/modules/core/logger/index.js';
import {
  type IMCPHandler,
  type ISessionInfo,
  MCP_CONSTANTS,
} from '@/server/types/mcp.types.js';

/**
 * Logger instance.
 */
const logger = LoggerService.getInstance();

/**
 * MCP Handler with per-session server instances.
 */
export class McpHandler implements IMCPHandler {
  private readonly sessions = new Map<string, ISessionInfo>();
  private readonly cleanupInterval: NodeJS.Timeout;
  private readonly sessionTimeoutMs = MCP_CONSTANTS.SESSION_TIMEOUT_MS;

  /**
   * Constructor.
   */
  constructor() {
    this.cleanupInterval = setInterval((): void => {
      this.cleanupOldSessions();
    }, MCP_CONSTANTS.SESSION_CHECK_INTERVAL_MS);
  }

  /**
   * Sets up routes for the Express app.
   * @param {express.Application} app - Express application instance.
   * @returns {Promise<void>} Promise that resolves when routes are set up.
   */
  async setupRoutes(app: express.Application): Promise<void> {
    await Promise.resolve();
    const mcpMiddleware = [
      rateLimitMiddleware(
        MCP_CONSTANTS.RATE_LIMIT_WINDOW_MS,
        MCP_CONSTANTS.RATE_LIMIT_MAX_REQUESTS,
      ),
      validateProtocolVersion,
      requestSizeLimit(MCP_CONSTANTS.MAX_REQUEST_SIZE_MB * MCP_CONSTANTS.BYTES_PER_MB),
    ];

    app.all('/mcp', ...mcpMiddleware, async (req, res): Promise<void> => {
      await this.handleRequest(req, res);
    });
  }

  /**
   * Get the server instance for a specific session.
   * @param {string} sessionId - The session ID to look up.
   * @returns {Server | undefined} Server instance if found, undefined otherwise.
   */
  getServerForSession(sessionId: string): Server | undefined {
    const sessionInfo = this.sessions.get(sessionId);
    return sessionInfo?.server;
  }

  /**
   * Get all active servers.
   * @returns {Server[]} Array of all active server instances.
   */
  getAllServers(): Server[] {
    return Array.from(this.sessions.values()).map((info): Server => {
      return info.server;
    });
  }

  /**
   * Get any server instance (for compatibility).
   * @returns {Server} A server instance, creating temporary one if needed.
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
   * @param {string} sessionId - The session ID to clean up.
   */
  cleanupSession(sessionId: string): void {
    const sessionInfo = this.sessions.get(sessionId);
    if (sessionInfo !== undefined) {
      sessionInfo.server.close().catch((): void => {
        logger.debug('Error closing server during cleanup');
      });
      sessionInfo.transport.close().catch((): void => {
        logger.debug('Error closing transport during cleanup');
      });
      this.sessions.delete(sessionId);
      logger.debug(`Cleaned up session: ${sessionId}`);
    }
  }

  /**
   * Get active session count.
   * @returns {number} Number of active sessions.
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
        logger.debug('Error closing server during shutdown');
      });
      sessionInfo.transport.close().catch((): void => {
        logger.debug('Error closing transport during shutdown');
      });
    }
    this.sessions.clear();

    logger.info('MCP Handler shut down');
  }

  /**
   * Creates a new server instance with handlers.
   * @param {string} sessionId - The session ID for logging context.
   * @returns {Server} Server instance configured with all handlers.
   * @private
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
   * @param {Server} server - Server instance.
   * @param {string} sessionId - Session ID.
   * @private
   */
  private registerToolHandlers(server: Server, sessionId: string): void {
    server.setRequestHandler(
      ListToolsRequestSchema,
      async (request) => {
        logger.debug(`📋 [${sessionId}] Listing tools`);
        return await handleListTools(request);
      },
    );

    server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        logger.debug(`🔧 [${sessionId}] Calling tool: ${request.params.name}`);
        logger.info(
          'MCP tool request params:',
          JSON.stringify(request.params, null, MCP_CONSTANTS.JSON_STRINGIFY_SPACE),
        );
        logger.info(
          'MCP tool request full:',
          JSON.stringify(request, null, MCP_CONSTANTS.JSON_STRINGIFY_SPACE),
        );
        return await handleToolCall(request, { sessionId });
      },
    );
  }

  /**
   * Register prompt handlers.
   * @param {Server} server - Server instance.
   * @param {string} sessionId - Session ID.
   * @private
   */
  private registerPromptHandlers(server: Server, sessionId: string): void {
    server.setRequestHandler(
      ListPromptsRequestSchema,
      async () => {
        logger.debug(`[${sessionId}] Listing prompts`);
        return await handleListPrompts();
      },
    );

    server.setRequestHandler(
      GetPromptRequestSchema,
      async (request) => {
        logger.debug(`[${sessionId}] Getting prompt: ${request.params.name}`);
        return await handleGetPrompt(request);
      },
    );
  }

  /**
   * Register resource handlers.
   * @param {Server} server - Server instance.
   * @param {string} sessionId - Session ID.
   * @private
   */
  private registerResourceHandlers(server: Server, sessionId: string): void {
    server.setRequestHandler(
      ListResourcesRequestSchema,
      async () => {
        logger.debug(`[${sessionId}] Listing resources`);
        return await handleListResources();
      },
    );

    server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        logger.debug(`[${sessionId}] Reading resource: ${request.params.uri}`);
        return await handleResourceCall(request);
      },
    );

    server.setRequestHandler(
      ListRootsRequestSchema,
      async (request) => {
        logger.debug(`[${sessionId}] Listing roots`);
        return await handleListRoots(request);
      },
    );

    server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async (request) => {
        logger.debug(`[${sessionId}] Listing resource templates`);
        logger.info(
          'Resource templates request:',
          JSON.stringify(request, null, MCP_CONSTANTS.JSON_STRINGIFY_SPACE),
        );
        return await handleListResourceTemplates(request);
      },
    );
  }

  /**
   * Handles incoming MCP requests with proper session management.
   * @param {express.Request} req - Express request object.
   * @param {express.Response} res - Express response object.
   * @returns {Promise<void>} Promise that resolves when request is handled.
   * @private
   */
  private async handleRequest(req: express.Request, res: express.Response): Promise<void> {
    const startTime = Date.now();

    try {
      logger.debug(`MCP ${req.method} request`, {
        headers: req.headers,
        sessionId: req.headers['mcp-session-id'] ?? req.headers['x-session-id'],
        acceptHeader: req.headers.accept,
      });

      res.header('Access-Control-Expose-Headers', 'mcp-session-id, x-session-id');

      const sessionResult = await this.getOrCreateSession(req, res);
      if (sessionResult === null) {
        return;
      }

      const { sessionId, sessionInfo } = sessionResult;
      sessionInfo.lastAccessed = new Date();
      await sessionInfo.transport.handleRequest(req, res);

      logger.debug(
        `MCP request completed in ${String(Date.now() - startTime)}ms for session ${sessionId}`,
      );
    } catch (error) {
      logger.error('MCP request failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });

      if (!res.headersSent) {
        res.status(MCP_CONSTANTS.INTERNAL_SERVER_ERROR_STATUS).json({
          jsonrpc: '2.0',
          error: {
            code: MCP_CONSTANTS.JSONRPC_INTERNAL_ERROR_CODE,
            message: 'Internal error',
          },
          id: null,
        });
      }
    }
  }

  /**
   * Get or create session from request.
   * @param {express.Request} req - Express request.
   * @param {express.Response} res - Express response.
   * @returns {Promise<{ sessionId: string; sessionInfo: ISessionInfo } | null>} Session info.
   * @private
   */
  private async getOrCreateSession(
    req: express.Request,
    res: express.Response,
  ): Promise<{ sessionId: string; sessionInfo: ISessionInfo } | null> {
    const { headers } = req;
    const { 'mcp-session-id': mcpSessionHeader } = headers;
    const { 'x-session-id': xSessionHeader } = headers;
    const sessionId
      = (typeof mcpSessionHeader === 'string' ? mcpSessionHeader : undefined)
      ?? (typeof xSessionHeader === 'string' ? xSessionHeader : undefined);

    logger.info(`[SESSION] Request method: ${req.method}, Session ID: ${sessionId ?? 'none'}`);

    if (sessionId === undefined) {
      return await this.createNewSession();
    }

    const sessionInfo = this.sessions.get(sessionId);
    if (sessionInfo === undefined) {
      this.handleSessionNotFound(sessionId, res);
      return null;
    }

    logger.info(`[SESSION] Found session ${sessionId}, handling ${req.method} request`);
    return {
      sessionId,
      sessionInfo,
    };
  }

  /**
   * Create new session.
   * @returns {Promise<{ sessionId: string; sessionInfo: ISessionInfo }>} Session info.
   * @private
   */
  private async createNewSession(): Promise<{ sessionId: string; sessionInfo: ISessionInfo }> {
    const sessionId = `session_${String(Date.now())}_${Math.random()
      .toString(MCP_CONSTANTS.RADIX_BASE_36)
      .substring(
        MCP_CONSTANTS.SESSION_ID_SUBSTRING_START,
        MCP_CONSTANTS.SESSION_ID_SUBSTRING_END,
      )}`;
    logger.info(`[SESSION] Creating new session: ${sessionId}`);

    const server = this.createServer(sessionId);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: (): string => {
        return sessionId;
      },
      onsessioninitialized: (sid: string): void => {
        logger.info(`🔗 New session initialized: ${sid}`);
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

    logger.debug(`📝 Created new session with dedicated server: ${sessionId}`);
    return {
      sessionId,
      sessionInfo,
    };
  }

  /**
   * Handle session not found error.
   * @param {string} sessionId - Session ID.
   * @param {express.Response} res - Express response.
   * @private
   */
  private handleSessionNotFound(sessionId: string, res: express.Response): void {
    logger.error(`[SESSION] Session not found: ${sessionId}`);
    logger.info(`[SESSION] Active sessions: ${Array.from(this.sessions.keys()).join(', ')}`);
    res.status(MCP_CONSTANTS.NOT_FOUND_STATUS).json({
      jsonrpc: '2.0',
      error: {
        code: MCP_CONSTANTS.JSONRPC_SESSION_NOT_FOUND_CODE,
        message: 'Session not found',
      },
      id: null,
    });
  }

  /**
   * Clean up old sessions that have exceeded the timeout.
   * @private
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, sessionInfo] of this.sessions.entries()) {
      const age = now - sessionInfo.lastAccessed.getTime();
      if (age > this.sessionTimeoutMs) {
        sessionInfo.server.close().catch((): void => {
          logger.debug('Error closing server during cleanup');
        });
        sessionInfo.transport.close().catch((): void => {
          logger.debug('Error closing transport during cleanup');
        });
        this.sessions.delete(sessionId);
        cleaned += MCP_CONSTANTS.INCREMENT;
      }
    }

    if (cleaned > MCP_CONSTANTS.ZERO) {
      logger.info(`Cleaned up ${String(cleaned)} old sessions`);
    }
  }
}

let mcpHandlerInstance: McpHandler | null = null;

/**
 * Set the global MCP handler instance.
 * @param {McpHandler} handler - The MCP handler instance.
 */
export const setMcpHandlerInstance = (handler: McpHandler): void => {
  mcpHandlerInstance = handler;
};

/**
 * Get the global MCP handler instance.
 * @returns {McpHandler | null} The MCP handler instance or null if not set.
 */
export const getMcpHandlerInstance = (): McpHandler | null => {
  return mcpHandlerInstance;
};
