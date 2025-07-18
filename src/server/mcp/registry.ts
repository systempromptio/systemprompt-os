/**
 * @fileoverview MCP Server Registry - Manages registration, routing, and lifecycle of MCP servers
 * @module server/mcp/registry
 */

import { Express, Request, Response, RequestHandler } from 'express';
import { 
  MCPServer, 
  MCPServerType, 
  LocalMCPServer, 
  RemoteMCPServer, 
  MCPServerStatus,
  RemoteMCPConfig
} from './types.js';
import { mcpAuthAdapter } from './auth-adapter.js';
import { logger } from '../../utils/logger.js';

/**
 * Headers that should not be forwarded from proxy responses
 */
const NON_FORWARDABLE_HEADERS = new Set([
  'content-encoding',
  'content-length', 
  'transfer-encoding'
]);

/**
 * Default timeout for proxy requests in milliseconds
 */
const DEFAULT_PROXY_TIMEOUT = 30000;

/**
 * Registry for managing MCP servers within the application
 * 
 * @class MCPServerRegistry
 * @description Provides centralized management for both local (in-process) and remote (proxied) MCP servers.
 * Handles server registration, route setup, status monitoring, and graceful shutdown.
 * 
 * @example
 * ```typescript
 * const registry = new MCPServerRegistry();
 * 
 * await registry.registerServer({
 *   id: 'my-server',
 *   name: 'My MCP Server',
 *   type: MCPServerType.LOCAL,
 *   version: '1.0.0',
 *   description: 'My custom MCP server',
 *   createHandler: () => myMCPHandler
 * });
 * 
 * await registry.setupRoutes(app);
 * ```
 */
export class MCPServerRegistry {
  /**
   * Map storing registered servers indexed by their unique IDs
   */
  private readonly servers = new Map<string, MCPServer>();
  
  /**
   * Registers a new MCP server in the registry
   * 
   * @param {MCPServer} server - Server configuration object to register
   * @returns {Promise<void>} Resolves when registration is complete
   * @throws {Error} Thrown when a server with the same ID is already registered
   * 
   * @example
   * ```typescript
   * await registry.registerServer({
   *   id: 'custom-tools',
   *   name: 'Custom Tools Server',
   *   type: MCPServerType.LOCAL,
   *   version: '2.0.0',
   *   description: 'Provides custom tool implementations',
   *   createHandler: () => customToolsHandler
   * });
   * ```
   */
  public async registerServer(server: MCPServer): Promise<void> {
    if (this.servers.has(server.id)) {
      throw new Error(`Server with ID '${server.id}' is already registered`);
    }

    this.servers.set(server.id, server);
    logger.info(`Registered ${server.type} MCP server: ${server.name} (${server.id})`);
  }

  /**
   * Configures Express routes for all registered MCP servers
   * 
   * @param {Express} app - Express application instance to configure routes on
   * @returns {Promise<void>} Resolves when all routes are configured
   * 
   * @description Sets up individual routes for each registered server and creates
   * a global status endpoint at `/mcp/status` for monitoring all servers
   */
  public async setupRoutes(app: Express): Promise<void> {
    await Promise.all(
      Array.from(this.servers.entries()).map(([id, server]) => 
        this.setupServerRoute(app, id, server)
      )
    );

    app.get('/mcp/status', this.createStatusHandler());

    logger.info(`Configured routes for ${this.servers.size} MCP servers`);
  }

  /**
   * Creates the status endpoint handler
   * 
   * @returns {RequestHandler} Express request handler for the status endpoint
   */
  private createStatusHandler(): RequestHandler {
    return async (_req: Request, res: Response): Promise<void> => {
      const statuses = await this.getServerStatuses();
      res.json({
        servers: Object.fromEntries(statuses),
      });
    };
  }

  /**
   * Configures routing for an individual MCP server
   * 
   * @param {Express} app - Express application instance
   * @param {string} id - Unique identifier of the server
   * @param {MCPServer} server - Server configuration object
   * @returns {Promise<void>} Resolves when route setup is complete
   */
  private async setupServerRoute(app: Express, id: string, server: MCPServer): Promise<void> {
    const endpoint = `/mcp/${id}`;
    const handler = this.createServerHandler(server);
    
    app.all(endpoint, mcpAuthAdapter, handler);
    
    if (server.type === MCPServerType.LOCAL) {
      logger.info(`Local server '${server.name}' mounted at ${endpoint} (auth enabled)`);
      
      if (id === 'core') {
        app.all('/mcp', mcpAuthAdapter, handler);
        logger.info(`Core server also mounted at /mcp (auth enabled)`);
      }
    } else {
      const remoteServer = server as RemoteMCPServer;
      logger.info(`Remote server '${server.name}' proxied at ${endpoint} -> ${remoteServer.config.url} (auth enabled)`);
    }
  }

  /**
   * Creates appropriate request handler based on server type
   * 
   * @param {MCPServer} server - Server configuration
   * @returns {RequestHandler} Express request handler
   */
  private createServerHandler(server: MCPServer): RequestHandler {
    if (server.type === MCPServerType.LOCAL) {
      const localServer = server as LocalMCPServer;
      return localServer.createHandler();
    }
    
    return this.createProxyHandler(server as RemoteMCPServer);
  }

  /**
   * Creates a proxy handler for forwarding requests to remote MCP servers
   * 
   * @param {RemoteMCPServer} server - Remote server configuration
   * @returns {RequestHandler} Express request handler that proxies to the remote server
   * 
   * @description Handles request forwarding, authentication, timeout management,
   * and error handling for remote MCP server communication
   */
  private createProxyHandler(server: RemoteMCPServer): RequestHandler {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const response = await this.forwardRequest(req, server);
        await this.forwardResponse(response, res, req);
      } catch (error) {
        this.handleProxyError(error, server, req, res);
      }
    };
  }

  /**
   * Forwards a request to a remote MCP server
   * 
   * @param {Request} req - Incoming Express request
   * @param {RemoteMCPServer} server - Remote server configuration
   * @returns {Promise<Response>} Fetch API response from the remote server
   */
  private async forwardRequest(req: Request, server: RemoteMCPServer): Promise<globalThis.Response> {
    const { url, auth, headers, timeout } = server.config;
    const requestHeaders = this.buildRequestHeaders(headers, auth);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(), 
      timeout || DEFAULT_PROXY_TIMEOUT
    );

    try {
      const response = await fetch(url, {
        method: req.method,
        headers: requestHeaders,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Builds request headers for proxy forwarding
   * 
   * @param {Record<string, string>} customHeaders - Custom headers from server config
   * @param {RemoteMCPConfig['auth']} auth - Authentication configuration
   * @returns {Record<string, string>} Complete headers object
   */
  private buildRequestHeaders(
    customHeaders?: Record<string, string>, 
    auth?: RemoteMCPConfig['auth']
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    if (auth) {
      headers['Authorization'] = this.buildAuthorizationHeader(auth);
    }

    return headers;
  }

  /**
   * Constructs the Authorization header based on auth configuration
   * 
   * @param {RemoteMCPConfig['auth']} auth - Authentication configuration
   * @returns {string} Authorization header value
   */
  private buildAuthorizationHeader(auth: RemoteMCPConfig['auth']): string {
    if (!auth) {
      return '';
    }
    
    if (auth.type === 'bearer' && auth.token) {
      return `Bearer ${auth.token}`;
    }
    
    if (auth.type === 'basic' && auth.username && auth.password) {
      const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      return `Basic ${credentials}`;
    }
    
    return '';
  }

  /**
   * Forwards the remote server response back to the client
   * 
   * @param {globalThis.Response} response - Response from remote server
   * @param {Response} res - Express response object
   * @param {Request} _req - Original request (for error context)
   * @returns {Promise<void>}
   */
  private async forwardResponse(
    response: globalThis.Response, 
    res: Response, 
    _req: Request
  ): Promise<void> {
    response.headers.forEach((value, key) => {
      if (!NON_FORWARDABLE_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(response.status);
    const body = await response.text();
    res.send(body);
  }

  /**
   * Handles proxy errors with appropriate error responses
   * 
   * @param {unknown} error - Error that occurred during proxying
   * @param {RemoteMCPServer} server - Server configuration
   * @param {Request} req - Original request
   * @param {Response} res - Express response object
   */
  private handleProxyError(
    error: unknown, 
    server: RemoteMCPServer, 
    req: Request, 
    res: Response
  ): void {
    const errorObj = error as Error;
    
    if (errorObj.name === 'AbortError') {
      const timeout = server.config.timeout || DEFAULT_PROXY_TIMEOUT;
      res.status(504).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: `Request to remote server timed out after ${timeout}ms`
        },
        id: req.body?.id || null
      });
      return;
    }

    logger.error(`Proxy error for ${server.name}:`, errorObj);
    res.status(502).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: `Failed to proxy request to remote server: ${errorObj.message}`
      },
      id: req.body?.id || null
    });
  }

  /**
   * Retrieves status information for all registered servers
   * 
   * @returns {Promise<Map<string, MCPServerStatus>>} Map of server IDs to their current status
   * 
   * @description Collects runtime information including session counts for local servers
   * and connection details for remote servers
   */
  public async getServerStatuses(): Promise<Map<string, MCPServerStatus>> {
    const statuses = new Map<string, MCPServerStatus>();

    for (const [id, server] of this.servers) {
      statuses.set(id, await this.getServerStatus(server));
    }

    return statuses;
  }

  /**
   * Gets status for a single server
   * 
   * @param {MCPServer} server - Server to get status for
   * @returns {Promise<MCPServerStatus>} Server status information
   */
  private async getServerStatus(server: MCPServer): Promise<MCPServerStatus> {
    const status: MCPServerStatus = {
      id: server.id,
      name: server.name,
      status: 'running',
      version: server.version,
      type: server.type,
      transport: 'http',
      sessions: 0
    };

    if (server.type === MCPServerType.LOCAL) {
      const localServer = server as LocalMCPServer;
      if (localServer.getActiveSessionCount) {
        status.sessions = localServer.getActiveSessionCount();
      }
    } else {
      const remoteServer = server as RemoteMCPServer;
      status.url = remoteServer.config.url;
    }

    return status;
  }

  /**
   * Retrieves a server configuration by its ID
   * 
   * @param {string} id - Unique identifier of the server
   * @returns {MCPServer | undefined} Server configuration if found, undefined otherwise
   */
  public getServer(id: string): MCPServer | undefined {
    return this.servers.get(id);
  }

  /**
   * Retrieves all registered servers
   * 
   * @returns {MCPServer[]} Array containing all registered server configurations
   */
  public getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Gets the total count of registered servers
   * 
   * @returns {number} Number of servers currently registered
   */
  public getServerCount(): number {
    return this.servers.size;
  }

  /**
   * Performs graceful shutdown of all servers and cleans up resources
   * 
   * @returns {Promise<void>} Resolves when shutdown is complete
   * 
   * @description Attempts to shut down each local server gracefully, logging any errors
   * that occur during the shutdown process. Remote servers do not require shutdown.
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down MCP server registry...');
    
    const shutdownPromises = Array.from(this.servers.values())
      .filter((server): server is LocalMCPServer => server.type === MCPServerType.LOCAL)
      .filter(server => server.shutdown !== undefined)
      .map(server => this.shutdownServer(server));
    
    await Promise.allSettled(shutdownPromises);
    
    this.servers.clear();
    logger.info('MCP server registry shutdown complete');
  }

  /**
   * Shuts down an individual local server
   * 
   * @param {LocalMCPServer} server - Server to shut down
   * @returns {Promise<void>}
   */
  private async shutdownServer(server: LocalMCPServer): Promise<void> {
    try {
      await server.shutdown!();
      logger.info(`Shut down local server: ${server.name}`);
    } catch (error) {
      logger.error(`Error shutting down ${server.name}:`, error);
    }
  }
}

/**
 * Singleton instance of the MCP Server Registry
 */
let registry: MCPServerRegistry | null = null;

/**
 * Initializes or retrieves the singleton MCP Server Registry instance
 * 
 * @returns {MCPServerRegistry} The registry instance
 * 
 * @description Creates a new registry instance on first call, returns existing instance
 * on subsequent calls (singleton pattern)
 */
export function initializeMCPServerRegistry(): MCPServerRegistry {
  if (!registry) {
    registry = new MCPServerRegistry();
  }
  return registry;
}

/**
 * Retrieves the existing MCP Server Registry instance
 * 
 * @returns {MCPServerRegistry} The registry instance
 * @throws {Error} Thrown when attempting to access registry before initialization
 * 
 * @description Use this function when you need to access the registry after it has been
 * initialized. For initial setup, use initializeMCPServerRegistry instead.
 */
export function getMCPServerRegistry(): MCPServerRegistry {
  if (!registry) {
    throw new Error('MCP Server Registry not initialized');
  }
  return registry;
}