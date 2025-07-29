/**
 * MCP Server Registry - Manages registration, routing, and lifecycle of MCP servers.
 * @file MCP Server Registry - Manages registration, routing, and lifecycle of MCP servers.
 * @module server/mcp/registry
 */

import type {
 Express, Request as ExpressRequest, Response as ExpressResponse, RequestHandler
} from 'express';
import {
  type ILocalMcpServer,
  type IMcpServerStatus,
  type IRemoteMcpConfig,
  type IRemoteMcpServer,
  type McpServer,
  McpServerTypeEnum,
} from '@/server/mcp/types';
import { mcpAuthAdapter } from '@/server/mcp/auth-adapter';
import { LogSource, LoggerService } from '@/modules/core/logger/index';
import { DEFAULT_PROXY_TIMEOUT } from '@/server/constants/mcp.constants';

const logger = LoggerService.getInstance();

/**
 * Headers that should not be forwarded from proxy responses.
 */
const NON_FORWARDABLE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
]);

/**
 * Registry for managing MCP servers within the application.
 * @class McpServerRegistry
 * @description Provides centralized management for both local (in-process) and
 * remote (proxied) MCP servers.
 * Handles server registration, route setup, status monitoring, and graceful shutdown.
 * @example
 * ```typescript
 * const registry = new McpServerRegistry();
 * await registry.registerServer({
 *   id: 'my-server',
 *   name: 'My MCP Server',
 *   type: McpServerTypeEnum.LOCAL,
 *   version: '1.0.0',
 *   description: 'My custom MCP server',
 *   createHandler: () => myMCPHandler
 * });
 * await registry.setupRoutes(app);
 * ```
 */
export class McpServerRegistry {
  /**
   * Map storing registered servers indexed by their unique IDs.
   */
  private readonly servers = new Map<string, McpServer>();

  /**
   * Registers a new MCP server in the registry.
   * @param {McpServer} server - Server configuration object to register.
   * @throws {Error} Thrown when a server with the same ID is already registered.
   */
  public registerServer(server: McpServer): void {
    if (this.servers.has(server.id)) {
      throw new Error(`Server with ID '${server.id}' is already registered`);
    }

    this.servers.set(server.id, server);
    logger.debug(
      LogSource.MCP,
      `Registered ${server.type} MCP server: ${server.name} (${server.id})`
    );
  }

  /**
   * Configures Express routes for all registered MCP servers.
   * @param {Express} app - Express application instance to configure routes on.
   */
  public setupRoutes(app: Express): void {
    Array.from(this.servers.entries()).forEach(([id, server]): void => {
      this.setupServerRoute(app, id, server);
    });

    app.get('/mcp/status', this.createStatusHandler());

    logger.debug(
      LogSource.MCP,
      `Configured routes for ${String(this.servers.size)} MCP servers`
    );
  }

  /**
   * Retrieves status information for all registered servers.
   * @returns {Map<string, IMcpServerStatus>} Map of server IDs to their current status.
   */
  public getServerStatuses(): Map<string, IMcpServerStatus> {
    const statuses = new Map<string, IMcpServerStatus>();

    for (const [id, server] of Array.from(this.servers.entries())) {
      statuses.set(id, this.getServerStatus(server));
    }

    return statuses;
  }

  /**
   * Retrieves a server configuration by its ID.
   * @param {string} id - Unique identifier of the server.
   * @returns {McpServer | undefined} Server configuration if found, undefined otherwise.
   */
  public getServer(id: string): McpServer | undefined {
    return this.servers.get(id);
  }

  /**
   * Retrieves all registered servers.
   * @returns {McpServer[]} Array containing all registered server configurations.
   */
  public getAllServers(): McpServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Gets the total count of registered servers.
   * @returns {number} Number of servers currently registered.
   */
  public getServerCount(): number {
    return this.servers.size;
  }

  /**
   * Performs graceful shutdown of all servers and cleans up resources.
   * @returns {Promise<void>} Resolves when shutdown is complete.
   */
  public async shutdown(): Promise<void> {
    logger.debug(LogSource.MCP, 'Shutting down MCP server registry...');

    const shutdownPromises = Array.from(this.servers.values())
      .filter((server): server is ILocalMcpServer => {
        return server.type === McpServerTypeEnum.LOCAL;
      })
      .filter((server): boolean => {
        return server.shutdown !== undefined;
      })
      .map(async (server): Promise<void> => {
        await this.shutdownServer(server);
      });

    await Promise.allSettled(shutdownPromises);

    this.servers.clear();
    logger.debug(LogSource.MCP, 'MCP server registry shutdown complete');
  }

  /**
   * Creates the status endpoint handler.
   * @returns {RequestHandler} Express request handler for the status endpoint.
   */
  private createStatusHandler(): RequestHandler {
    return (_request: ExpressRequest, res: ExpressResponse): void => {
      const statuses = this.getServerStatuses();
      res.json({
        servers: Object.fromEntries(statuses),
      });
    };
  }

  /**
   * Configures routing for an individual MCP server.
   * @param {Express} app - Express application instance.
   * @param {string} id - Unique identifier of the server.
   * @param {McpServer} server - Server configuration object.
   * @returns {void} Completes when route setup is done.
   */
  private setupServerRoute(app: Express, id: string, server: McpServer): void {
    const endpoint = `/mcp/${id}`;
    const handler = this.createServerHandler(server);

    app.all(endpoint, mcpAuthAdapter, handler);

    if (server.type === McpServerTypeEnum.LOCAL) {
      logger.debug(
        LogSource.MCP,
        `Local server '${server.name}' mounted at ${endpoint} (auth enabled)`
      );

      if (id === 'core') {
        app.all('/mcp', mcpAuthAdapter, handler);
        logger.debug(
          LogSource.MCP,
          'Core server also mounted at /mcp (auth enabled)'
        );
      }
    } else {
      const remoteServer = server;
      logger.debug(
        LogSource.MCP,
        `Remote server '${server.name}' proxied at ${endpoint} -> `
        + `${remoteServer.config.url} (auth enabled)`,
        {
          context: {
            serverName: server.name,
            endpoint,
            targetUrl: remoteServer.config.url
          }
        }
      );
    }
  }

  /**
   * Creates appropriate request handler based on server type.
   * @param {McpServer} server - Server configuration.
   * @returns {RequestHandler} Express request handler.
   */
  private createServerHandler(server: McpServer): RequestHandler {
    if (server.type === McpServerTypeEnum.LOCAL) {
      const localServer = server;
      return localServer.createHandler();
    }

    return this.createProxyHandler(server);
  }

  /**
   * Creates a proxy handler for forwarding requests to remote MCP servers.
   * @param {IRemoteMcpServer} server - Remote server configuration.
   * @returns {RequestHandler} Express request handler that proxies to the remote server.
   */
  private createProxyHandler(server: IRemoteMcpServer): RequestHandler {
    return async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
      try {
        const response = await this.forwardRequest(req, server);
        await this.forwardResponse(response, res, req);
      } catch (error) {
        this.handleProxyError(error, server, res);
      }
    };
  }

  /**
   * Forwards a request to a remote MCP server.
   * @param {Request} req - Incoming Express request.
   * @param {RemoteMcpServer} server - Remote server configuration.
   * @returns {Promise<Response>} Fetch API response from the remote server.
   */
  private async forwardRequest(
    req: ExpressRequest,
    server: IRemoteMcpServer,
  ): Promise<globalThis.Response> {
    const {
      config
    } = server;
    const {
      url,
      auth,
      headers,
      timeout
    } = config;
    const requestHeaders = this.buildRequestHeaders(headers, auth);

    const controller = new AbortController();
    const timeoutId = setTimeout((): void => {
      controller.abort();
    }, timeout ?? DEFAULT_PROXY_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: req.method,
        headers: requestHeaders,
        ...req.method !== 'GET' && { body: JSON.stringify(req.body) },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Builds request headers for proxy forwarding.
   * @param {Record<string, string>} customHeaders - Custom headers from server config.
   * @param {RemoteMCPConfig['auth']} auth - Authentication configuration.
   * @returns {Record<string, string>} Complete headers object.
   */
  private buildRequestHeaders(
    customHeaders?: Record<string, string>,
    auth?: IRemoteMcpConfig['auth'],
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...customHeaders,
    };

    if (auth !== undefined) {
      headers.Authorization = this.buildAuthorizationHeader(auth);
    }

    return headers;
  }

  /**
   * Constructs the Authorization header based on auth configuration.
   * @param {RemoteMCPConfig['auth']} auth - Authentication configuration.
   * @returns {string} Authorization header value.
   */
  private buildAuthorizationHeader(auth: IRemoteMcpConfig['auth']): string {
    if (auth === undefined) {
      return '';
    }

    if (auth.type === 'bearer') {
      return this.buildBearerToken(auth.token);
    }

    if (auth.type === 'basic') {
      return this.buildBasicToken(auth.username, auth.password);
    }

    return '';
  }

  /**
   * Builds a Bearer token authorization header.
   * @param {string} token - Bearer token.
   * @returns {string} Authorization header value.
   */
  private buildBearerToken(token?: string): string {
    if (token !== undefined && token !== '') {
      return `Bearer ${token}`;
    }
    return '';
  }

  /**
   * Builds a Basic token authorization header.
   * @param {string} username - Username for basic auth.
   * @param {string} password - Password for basic auth.
   * @returns {string} Authorization header value.
   */
  private buildBasicToken(username?: string, password?: string): string {
    if (username !== undefined && username !== ''
        && password !== undefined && password !== '') {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      return `Basic ${credentials}`;
    }
    return '';
  }

  /**
   * Forwards the remote server response back to the client.
   * @param {globalThis.Response} response - Response from remote server.
   * @param {ExpressResponse} res - Express response object.
   * @param {ExpressRequest} requestObject - Express request object.
   * @param _requestObject
   * @returns {Promise<void>}
   */
  private async forwardResponse(
    response: globalThis.Response,
    res: ExpressResponse,
    _requestObject: ExpressRequest,
  ): Promise<void> {
    response.headers.forEach((value, key): void => {
      if (!NON_FORWARDABLE_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(response.status);
    const body = await response.text();
    res.send(body);
  }

  /**
   * Handles proxy errors with appropriate error responses.
   * @param {unknown} error - Error that occurred during proxying.
   * @param {IRemoteMcpServer} server - Server configuration.
   * @param {ExpressResponse} res - Express response object.
   */
  private handleProxyError(
    error: unknown,
    server: IRemoteMcpServer,
    res: ExpressResponse,
  ): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    if (errorObj.name === 'AbortError') {
      const timeout = server.config.timeout ?? DEFAULT_PROXY_TIMEOUT;
      res.status(504).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: `Request to remote server timed out after ${String(timeout)}ms`,
        },
        id: null,
      });
      return;
    }

    logger.error(LogSource.MCP, `Proxy error for ${server.name}`, {
      error: errorObj instanceof Error ? errorObj : String(errorObj),
      data: {
        serverName: server.name
      }
    });
    res.status(502).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: `Failed to proxy request to remote server: ${errorObj.message}`,
      },
      id: null,
    });
  }

  /**
   * Gets status for a single server.
   * @param {McpServer} server - Server to get status for.
   * @returns {IMcpServerStatus} Server status information.
   */
  private getServerStatus(server: McpServer): IMcpServerStatus {
    const status: IMcpServerStatus = {
      id: server.id,
      name: server.name,
      status: 'running',
      version: server.version,
      type: server.type,
      transport: 'http',
      sessions: 0,
    };

    if (server.type === McpServerTypeEnum.LOCAL) {
      const { getActiveSessionCount } = server;
      if (getActiveSessionCount !== undefined) {
        status.sessions = getActiveSessionCount();
      }
    } else {
      const { config: { url } } = server;
      status.url = url;
    }

    return status;
  }

  /**
   * Shuts down an individual local server.
   * @param {ILocalMcpServer} server - Server to shut down.
   * @returns {Promise<void>}
   */
  private async shutdownServer(server: ILocalMcpServer): Promise<void> {
    try {
      if (server.shutdown !== undefined) {
        await server.shutdown();
      }
      logger.debug(
        LogSource.MCP,
        `Shut down local server: ${server.name}`,
        { data: { serverName: server.name } }
      );
    } catch (error) {
      logger.error(LogSource.MCP, `Error shutting down ${server.name}`, {
        error: error instanceof Error ? error : String(error),
        context: {
          serverName: server.name
        }
      });
    }
  }
}

/**
 * Singleton instance of the MCP Server Registry.
 */
let registry: McpServerRegistry | null = null;

/**
 * Initializes or retrieves the singleton MCP Server Registry instance.
 * @returns {McpServerRegistry} The registry instance.
 * @description Creates a new registry instance on first call, returns existing instance
 * on subsequent calls (singleton pattern).
 */
export const initializeMcpServerRegistry = (): McpServerRegistry => {
  registry ??= new McpServerRegistry();
  return registry;
};

/**
 * Retrieves the existing MCP Server Registry instance.
 * @returns {McpServerRegistry} The registry instance.
 * @throws {Error} Thrown when attempting to access registry before initialization.
 * @description Use this function when you need to access the registry after it has been
 * initialized. For initial setup, use initializeMcpServerRegistry instead.
 */
export const getMcpServerRegistry = (): McpServerRegistry => {
  if (registry === null) {
    throw new Error('MCP Server Registry not initialized');
  }
  return registry;
};
