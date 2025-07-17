/**
 * @fileoverview MCP Server Registry
 * @module server/mcp/registry
 * 
 * @remarks
 * The MCP Server Registry manages both local embedded servers and remote MCP servers.
 * It handles server registration, routing setup, and provides a unified interface
 * for server status and management.
 * 
 * Server types:
 * - Local: Express handlers that run in-process
 * - Remote: External servers accessed via HTTP proxy
 */

import { Express, Request, Response } from 'express';
import { 
  MCPServer, 
  MCPServerType, 
  LocalMCPServer, 
  RemoteMCPServer, 
  MCPServerStatus 
} from './types.js';

/**
 * MCP Server Registry
 * 
 * @remarks
 * Central registry for all MCP servers in the system. Manages server lifecycle,
 * routing, and provides status information.
 * 
 * @example
 * ```typescript
 * const registry = new MCPServerRegistry();
 * 
 * // Register a local server
 * await registry.registerServer({
 *   id: 'my-server',
 *   type: MCPServerType.LOCAL,
 *   createHandler: () => myMCPHandler
 * });
 * 
 * // Setup routes in Express app
 * await registry.setupRoutes(app);
 * ```
 */
export class MCPServerRegistry {
  /** Map of registered servers by ID */
  private servers = new Map<string, MCPServer>();
  
  /**
   * Register an MCP server
   * 
   * @param server - Server configuration to register
   * @throws Error if server with same ID already exists
   */
  async registerServer(server: MCPServer): Promise<void> {
    if (this.servers.has(server.id)) {
      throw new Error(`Server with ID '${server.id}' is already registered`);
    }

    this.servers.set(server.id, server);
    console.log(`📝 Registered ${server.type} MCP server: ${server.name} (${server.id})`);
  }

  /**
   * Set up Express routes for all registered servers
   * 
   * @param app - Express application instance
   * @returns Promise that resolves when all routes are set up
   */
  async setupRoutes(app: Express): Promise<void> {
    // Set up routes for each registered MCP server
    for (const [id, server] of this.servers) {
      await this.setupServerRoute(app, id, server);
    }

    // Server status endpoint
    app.get('/mcp/status', async (req, res) => {
      const statuses = await this.getServerStatuses();
      res.json({
        servers: Object.fromEntries(statuses),
      });
    });

    console.log(`🛣️  Set up routes for ${this.servers.size} MCP servers`);
  }

  /**
   * Set up route for a single server
   * 
   * @param app - Express application
   * @param id - Server ID
   * @param server - Server configuration
   */
  private async setupServerRoute(app: Express, id: string, server: MCPServer): Promise<void> {
    const endpoint = `/mcp/${id}`;

    if (server.type === MCPServerType.LOCAL) {
      // Local embedded server - use the handler directly
      const localServer = server as LocalMCPServer;
      const handler = localServer.createHandler();
      
      app.all(endpoint, handler);
      console.log(`  ✅ Local server '${server.name}' mounted at ${endpoint}`);
      
      // Also mount core server at /mcp for backwards compatibility
      if (id === 'core') {
        app.all('/mcp', handler);
        console.log(`  ✅ Core server also mounted at /mcp`);
      }
    } else {
      // Remote server - create a proxy handler
      const remoteServer = server as RemoteMCPServer;
      const proxyHandler = this.createProxyHandler(remoteServer);
      
      app.all(endpoint, proxyHandler);
      console.log(`  ✅ Remote server '${server.name}' proxied at ${endpoint} -> ${remoteServer.config.url}`);
    }
  }

  /**
   * Create a proxy handler for remote MCP servers
   * 
   * @param server - Remote server configuration
   * @returns Express request handler that proxies to the remote server
   */
  private createProxyHandler(server: RemoteMCPServer) {
    return async (req: Request, res: Response) => {
      try {
        const { url, auth, headers, timeout } = server.config;
        
        // Build request headers
        const requestHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...headers
        };

        // Add authentication
        if (auth) {
          if (auth.type === 'bearer' && auth.token) {
            requestHeaders['Authorization'] = `Bearer ${auth.token}`;
          } else if (auth.type === 'basic' && auth.username && auth.password) {
            const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            requestHeaders['Authorization'] = `Basic ${credentials}`;
          }
          // OAuth2 would require a more complex flow
        }

        // Forward the request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout || 30000);

        try {
          const response = await fetch(url, {
            method: req.method,
            headers: requestHeaders,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          // Forward response headers
          const responseHeaders = response.headers;
          responseHeaders.forEach((value, key) => {
            // Skip certain headers that shouldn't be forwarded
            if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
              res.setHeader(key, value);
            }
          });

          // Forward status code
          res.status(response.status);

          // Stream the response body
          const body = await response.text();
          res.send(body);
          
        } catch (error: any) {
          if (error.name === 'AbortError') {
            res.status(504).json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: `Request to remote server timed out after ${timeout || 30000}ms`
              },
              id: req.body?.id || null
            });
          } else {
            throw error;
          }
        }
      } catch (error: any) {
        console.error(`❌ Proxy error for ${server.name}:`, error);
        res.status(502).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: `Failed to proxy request to remote server: ${error.message}`
          },
          id: req.body?.id || null
        });
      }
    };
  }

  /**
   * Get status information for all registered servers
   * 
   * @returns Map of server IDs to status information
   */
  async getServerStatuses(): Promise<Map<string, MCPServerStatus>> {
    const statuses = new Map<string, MCPServerStatus>();

    for (const [id, server] of this.servers) {
      const status: MCPServerStatus = {
        id: server.id,
        name: server.name,
        status: 'running', // TODO: Implement health checks
        version: server.version,
        type: server.type,
        transport: 'http',
        sessions: 0
      };

      // Add server-specific information
      if (server.type === MCPServerType.LOCAL) {
        const localServer = server as LocalMCPServer;
        if (localServer.getActiveSessionCount) {
          status.sessions = localServer.getActiveSessionCount();
        }
      } else {
        const remoteServer = server as RemoteMCPServer;
        status.url = remoteServer.config.url;
        // TODO: Implement remote server health checks
      }

      statuses.set(id, status);
    }

    return statuses;
  }

  /**
   * Get a server by ID
   * 
   * @param id - Server ID
   * @returns Server configuration or undefined if not found
   */
  getServer(id: string): MCPServer | undefined {
    return this.servers.get(id);
  }

  /**
   * Get all registered servers
   * 
   * @returns Array of all registered servers
   */
  getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get count of registered servers
   * 
   * @returns Number of registered servers
   */
  getServerCount(): number {
    return this.servers.size;
  }

  /**
   * Shutdown all servers and clean up resources
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down MCP server registry...');
    
    for (const [id, server] of this.servers) {
      if (server.type === MCPServerType.LOCAL) {
        const localServer = server as LocalMCPServer;
        if (localServer.shutdown) {
          try {
            await localServer.shutdown();
            console.log(`  ✅ Shut down local server: ${server.name}`);
          } catch (error) {
            console.error(`  ❌ Error shutting down ${server.name}:`, error);
          }
        }
      }
    }
    
    this.servers.clear();
    console.log('✅ MCP server registry shutdown complete');
  }
}

/** Singleton instance of the registry */
let registry: MCPServerRegistry | null = null;

/**
 * Initialize the MCP Server Registry
 * 
 * @returns The initialized registry instance
 */
export function initializeMCPServerRegistry(): MCPServerRegistry {
  if (!registry) {
    registry = new MCPServerRegistry();
  }
  return registry;
}

/**
 * Get the MCP Server Registry instance
 * 
 * @returns The registry instance
 * @throws Error if registry not initialized
 */
export function getMCPServerRegistry(): MCPServerRegistry {
  if (!registry) {
    throw new Error('MCP Server Registry not initialized');
  }
  return registry;
}