/**
 * @fileoverview MCP protocol handler with session management and per-session server instances.
 * Implements the Model Context Protocol SDK patterns for handling multiple concurrent sessions
 * without authentication requirements.
 * @module server/mcp
 *
 * @remarks
 * This implementation handles multiple concurrent sessions per MCP SDK design:
 * - One Server instance per session
 * - Each Server has its own StreamableHTTPServerTransport
 * - Session isolation and management
 * - No authentication required
 */

import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListRootsRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { serverConfig, serverCapabilities } from "../constants/server/server-config.js";
import { handleListTools, handleToolCall } from "../handlers/tool-handlers.js";
import { handleListPrompts, handleGetPrompt } from "../handlers/prompt-handlers.js";
import { handleListResources, handleResourceCall } from "../handlers/resource-handlers.js";
import { handleListRoots } from "../handlers/roots-handlers.js";
import { handleListResourceTemplates } from "../handlers/resource-templates-handler.js";
import { logger } from "../utils/logger.js";
import { rateLimitMiddleware, validateProtocolVersion, requestSizeLimit } from "./middleware.js";

interface SessionInfo {
  server: Server;
  transport: StreamableHTTPServerTransport;
  createdAt: Date;
  lastAccessed: Date;
}

export interface IMCPHandler {
  setupRoutes(app: express.Application): Promise<void>;
  getServerForSession(sessionId: string): Server | undefined;
  getAllServers(): Server[];
  getServer(): Server;
  cleanupSession(sessionId: string): void;
  getActiveSessionCount(): number;
  shutdown(): void;
}

/**
 * MCP Handler with per-session server instances
 */
export class MCPHandler implements IMCPHandler {
  private sessions = new Map<string, SessionInfo>();

  private cleanupInterval: NodeJS.Timeout;
  private readonly SESSION_TIMEOUT_MS = 60 * 60 * 1000;

  constructor() {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldSessions();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Creates a new server instance with handlers
   * @param sessionId - The session ID for logging context
   * @returns Server instance configured with all handlers
   * @private
   */
  private createServer(sessionId: string): Server {
    const server = new Server(serverConfig, serverCapabilities);

    server.setRequestHandler(ListToolsRequestSchema, (request) => {
      logger.debug(`📋 [${sessionId}] Listing tools`);
      return handleListTools(request);
    });

    server.setRequestHandler(CallToolRequestSchema, (request) => {
      logger.debug(`🔧 [${sessionId}] Calling tool: ${request.params.name}`);
      logger.info(`MCP tool request params:`, JSON.stringify(request.params, null, 2));
      logger.info(`MCP tool request full:`, JSON.stringify(request, null, 2));
      return handleToolCall(request, { sessionId });
    });

    server.setRequestHandler(ListPromptsRequestSchema, () => {
      logger.debug(`📋 [${sessionId}] Listing prompts`);
      return handleListPrompts();
    });

    server.setRequestHandler(GetPromptRequestSchema, (request) => {
      logger.debug(`📝 [${sessionId}] Getting prompt: ${request.params.name}`);
      return handleGetPrompt(request);
    });

    server.setRequestHandler(ListResourcesRequestSchema, () => {
      logger.debug(`📋 [${sessionId}] Listing resources`);
      return handleListResources();
    });

    server.setRequestHandler(ReadResourceRequestSchema, (request) => {
      logger.debug(`📖 [${sessionId}] Reading resource: ${request.params.uri}`);
      return handleResourceCall(request);
    });

    server.setRequestHandler(ListRootsRequestSchema, (request) => {
      logger.debug(`📁 [${sessionId}] Listing roots`);
      return handleListRoots(request);
    });

    server.setRequestHandler(ListResourceTemplatesRequestSchema, (request) => {
      logger.debug(`📋 [${sessionId}] Listing resource templates`);
      logger.info(`Resource templates request:`, JSON.stringify(request, null, 2));
      return handleListResourceTemplates(request);
    });

    return server;
  }

  /**
   * Sets up routes for the Express app
   * @param app - Express application instance
   * @example
   * ```typescript
   * const app = express();
   * const handler = new MCPHandler();
   * await handler.setupRoutes(app);
   * ```
   */
  async setupRoutes(app: express.Application): Promise<void> {
    const mcpMiddleware = [
      rateLimitMiddleware(60000, 100),
      validateProtocolVersion,
      requestSizeLimit(10 * 1024 * 1024),
    ];

    app.all("/mcp", ...mcpMiddleware, (req, res) => this.handleRequest(req, res));
  }

  /**
   * Handles incoming MCP requests with proper session management
   * @param req - Express request object
   * @param res - Express response object
   * @private
   */
  private async handleRequest(req: express.Request, res: express.Response): Promise<void> {
    const startTime = Date.now();

    try {
      logger.debug(`MCP ${req.method} request`, {
        headers: req.headers,
        sessionId: req.headers["mcp-session-id"] || req.headers["x-session-id"],
        acceptHeader: req.headers.accept,
      });

      res.header("Access-Control-Expose-Headers", "mcp-session-id, x-session-id");

      let sessionId =
        (req.headers["mcp-session-id"] as string) || (req.headers["x-session-id"] as string);

      logger.info(`[SESSION] Request method: ${req.method}, Session ID: ${sessionId || "none"}`);

      const isInitRequest = !sessionId;

      let sessionInfo: SessionInfo | undefined;

      if (isInitRequest) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        logger.info(`[SESSION] Creating new session: ${sessionId}`);

        const server = this.createServer(sessionId);

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId!,
          onsessioninitialized: (sid) => {
            logger.info(`🔗 New session initialized: ${sid}`);
          },
          enableJsonResponse: false,
        });

        await server.connect(transport);

        sessionInfo = {
          server,
          transport,
          createdAt: new Date(),
          lastAccessed: new Date(),
        };
        this.sessions.set(sessionId, sessionInfo);

        logger.debug(`📝 Created new session with dedicated server: ${sessionId}`);

        await transport.handleRequest(req, res);
      } else {
        if (!sessionId) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32600,
              message: "Invalid Request: Missing session ID",
            },
            id: null,
          });
          return;
        }

        sessionInfo = this.sessions.get(sessionId);
        if (!sessionInfo) {
          logger.error(`[SESSION] Session not found: ${sessionId}`);
          logger.info(`[SESSION] Active sessions: ${Array.from(this.sessions.keys()).join(", ")}`);
          res.status(404).json({
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: "Session not found",
            },
            id: null,
          });
          return;
        }

        logger.info(`[SESSION] Found session ${sessionId}, handling ${req.method} request`);
        sessionInfo.lastAccessed = new Date();

        await sessionInfo.transport.handleRequest(req, res);
      }

      logger.debug(`MCP request completed in ${Date.now() - startTime}ms for session ${sessionId}`);
    } catch (error) {
      logger.error("MCP request failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error",
          },
          id: null,
        });
      }
    }
  }

  /**
   * Clean up old sessions that have exceeded the timeout
   * @private
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, sessionInfo] of this.sessions.entries()) {
      const age = now - sessionInfo.lastAccessed.getTime();
      if (age > this.SESSION_TIMEOUT_MS) {
        sessionInfo.server.close();
        sessionInfo.transport.close();
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`🧹 Cleaned up ${cleaned} old sessions`);
    }
  }

  /**
   * Get the server instance for a specific session
   * @param sessionId - The session ID to look up
   * @returns Server instance if found, undefined otherwise
   */
  getServerForSession(sessionId: string): Server | undefined {
    const sessionInfo = this.sessions.get(sessionId);
    return sessionInfo?.server;
  }

  /**
   * Get all active servers
   * @returns Array of all active server instances
   */
  getAllServers(): Server[] {
    return Array.from(this.sessions.values()).map((info) => info.server);
  }

  /**
   * Get any server instance (for compatibility)
   * @returns A server instance, creating temporary one if needed
   */
  getServer(): Server {
    const firstSession = this.sessions.values().next().value;
    if (firstSession) {
      return firstSession.server;
    }
    return new Server(serverConfig, serverCapabilities);
  }

  /**
   * Clean up a specific session
   * @param sessionId - The session ID to clean up
   */
  cleanupSession(sessionId: string): void {
    const sessionInfo = this.sessions.get(sessionId);
    if (sessionInfo) {
      sessionInfo.server.close();
      sessionInfo.transport.close();
      this.sessions.delete(sessionId);
      logger.debug(`🧹 Cleaned up session: ${sessionId}`);
    }
  }

  /**
   * Get active session count
   * @returns Number of active sessions
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Shutdown handler - closes all sessions and cleans up resources
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const sessionInfo of this.sessions.values()) {
      sessionInfo.server.close();
      sessionInfo.transport.close();
    }
    this.sessions.clear();

    logger.info("🛑 MCP Handler shut down");
  }
}

let mcpHandlerInstance: MCPHandler | null = null;

/**
 * Set the global MCP handler instance
 * @param handler - The MCP handler instance
 */
export function setMCPHandlerInstance(handler: MCPHandler): void {
  mcpHandlerInstance = handler;
}

/**
 * Get the global MCP handler instance
 * @returns The MCP handler instance or null if not set
 */
export function getMCPHandlerInstance(): MCPHandler | null {
  return mcpHandlerInstance;
}
