/**
 * Main HTTP server for systemprompt-os.
 * @file Main HTTP server for systemprompt-os.
 * @module server
 */

import express, { type Express } from 'express';
import cors from 'cors';
import { CONFIG } from './config';
import { setupExternalEndpoints } from './external/setup';
import { setupHealthEndpoints } from './health';
import { LoggerService } from '../modules/core/logger/services/logger.service';
import { LogSource } from '../modules/core/logger/types/manual';
import { getModuleRegistry } from '../modules/core/modules/index';
import { ModuleName } from '../modules/types/module-names.types';
import { UrlConfigService } from '../modules/core/system/services/url-config.service';
import { ServerCore } from './core/server';
import { HttpProtocolHandler } from './protocols/http/http-protocol';
import { McpProtocolHandlerV2 } from './protocols/mcp/mcp-protocol';
import { ModuleBridge } from './integration/module-bridge';
import { ServerEvents } from './core/types/events.types';
import type { Server } from 'http';

const logger = LoggerService.getInstance();

/**
 * Creates and configures the Express application.
 * For backward compatibility, but now creates an event-driven server and returns the Express app.
 * @returns Promise that resolves to Express application.
 */
export const createApp = async function createApp(): Promise<Express> {
  // Create the event-driven server core with port 0 (for testing)
  const serverCore = new ServerCore({ port: 0 });
  
  // Register HTTP protocol handler
  const httpHandler = new HttpProtocolHandler();
  await serverCore.registerProtocol('http', httpHandler);
  
  // Get the Express app from HTTP handler
  const app = (httpHandler as any).app as Express;
  
  // Configure CORS and middleware
  app.use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cache-Control',
        'Accept',
        'mcp-session-id',
        'x-session-id',
      ],
      exposedHeaders: ['x-session-id', 'mcp-session-id'],
    }),
  );

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({
    extended: true,
    limit: '50mb'
  }));

  // Start the auth module if available
  try {
    const registry = getModuleRegistry();
    const authModule = registry.get(ModuleName.AUTH);
    if (authModule && 'start' in authModule && authModule.start) {
      await (authModule as any).start();
      logger.info(LogSource.SERVER, 'Auth module started successfully');
    }
  } catch (error) {
    logger.warn(LogSource.SERVER, 'Failed to start auth module:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Set up existing endpoints
  try {
    await setupExternalEndpoints(app);
  } catch (error) {
    logger.error(LogSource.SERVER, 'Error setting up external endpoints:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  setupHealthEndpoints(app);

  // Add debug routes
  app.get('/test', (_req, res) => {
    res.json({
      status: 'ok',
      message: 'Test route working'
    });
  });

  app.get('/debug/routes', (_req, res) => {
    const routes: any[] = [];
    app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: middleware.route.methods
        });
      } else if (middleware.name === 'router') {
        routes.push({
          type: 'router',
          regexp: middleware.regexp.toString()
        });
      }
    });
    res.json({
      routes,
      message: 'Available routes'
    });
  });

  return app;
};

/**
 * Starts the HTTP server.
 * @param port - Optional port number.
 * @returns Promise that resolves to server instance.
 */
export const startServer = async function startServer(
  port?: number,
): Promise<Server> {
  const serverPort = port ?? parseInt(CONFIG.PORT, 10);
  
  // Create the event-driven server core
  const serverCore = new ServerCore({ port: serverPort });
  
  // Register protocol handlers
  const httpHandler = new HttpProtocolHandler();
  const mcpHandler = new McpProtocolHandlerV2();
  
  await serverCore.registerProtocol('http', httpHandler);
  await serverCore.registerProtocol('mcp', mcpHandler);
  
  // Create module bridge for integrating existing modules
  const moduleBridge = new ModuleBridge(serverCore.eventBus);
  
  // Get the Express app from HTTP handler for compatibility
  const app = (httpHandler as any).app as Express;
  
  // Configure CORS and middleware
  app.use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cache-Control',
        'Accept',
        'mcp-session-id',
        'x-session-id',
      ],
      exposedHeaders: ['x-session-id', 'mcp-session-id'],
    }),
  );
  
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({
    extended: true,
    limit: '50mb'
  }));
  
  // Set up existing endpoints on the Express app from HTTP handler
  try {
    await setupExternalEndpoints(app);
    logger.info(LogSource.SERVER, 'External endpoints configured');
  } catch (error) {
    logger.error(LogSource.SERVER, 'Failed to setup external endpoints:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  setupHealthEndpoints(app);
  logger.info(LogSource.SERVER, 'Health endpoints configured');
  
  // Add compatibility routes for existing functionality
  app.get('/test', (_req, res) => {
    res.json({
      status: 'ok',
      message: 'Test route working',
      server: 'event-driven'
    });
  });

  app.get('/debug/routes', (_req, res) => {
    const routes: any[] = [];
    app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: middleware.route.methods
        });
      } else if (middleware.name === 'router') {
        routes.push({
          type: 'router',
          regexp: middleware.regexp.toString()
        });
      }
    });
    res.json({
      routes,
      message: 'Available routes',
      server: 'event-driven'
    });
  });
  
  // Start the auth module if available
  try {
    const registry = getModuleRegistry();
    const authModule = registry.get(ModuleName.AUTH);
    if (authModule && 'start' in authModule && authModule.start) {
      await (authModule as any).start();
      logger.info(LogSource.SERVER, 'Auth module started successfully');
    }
  } catch (error) {
    logger.warn(LogSource.SERVER, 'Failed to start auth module:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Initialize URL configuration
  const urlConfigService = UrlConfigService.getInstance();
  await urlConfigService.initialize();
  
  // Finalize routes after all routes have been added
  (httpHandler as any).finalizeRoutes();
  
  // Set up event listener for server started
  serverCore.eventBus.once(ServerEvents.STARTED, async () => {
    try {
      const urlConfig = await urlConfigService.getUrlConfig();
      const {baseUrl} = urlConfig;
      const isTunnel = Boolean(urlConfig.tunnelUrl);

      logger.info(LogSource.SERVER, `🚀 systemprompt-os running on port ${String(serverPort)}`);

      if (isTunnel) {
        logger.info(LogSource.SERVER, `🌐 Public URL (tunnel): ${baseUrl}`);
        logger.info(LogSource.SERVER, `📡 API endpoint: ${baseUrl}`);
        logger.info(LogSource.SERVER, `🔐 OAuth2 discovery: ${baseUrl}/.well-known/oauth-protected-resource`);
      } else {
        logger.info(LogSource.SERVER, `📡 Local endpoint: http://localhost:${String(serverPort)}`);
        logger.info(LogSource.SERVER, `🌐 Public URL: ${baseUrl}`);
        logger.info(LogSource.SERVER, `🔐 OAuth2 discovery: ${baseUrl}/.well-known/oauth-protected-resource`);
      }
    } catch (error) {
      logger.warn(LogSource.SERVER, 'Failed to get URL configuration, using localhost', {
        error: error instanceof Error ? error.message : String(error)
      });
      logger.info(LogSource.SERVER, `📡 Local endpoint: http://localhost:${String(serverPort)}`);
    }
  });
  
  // Start the server
  await serverCore.start();
  
  // Get the actual HTTP server instance for compatibility
  const httpServer = (httpHandler as any).server as Server;
  
  return httpServer;
};

/**
 * Gets the server module with type safety and validation.
 * @returns The server module exports with guaranteed typed functions.
 * @throws {Error} If server functions are not available.
 */
export const getServerModule = function getServerModule(): {
  createApp: typeof createApp;
  startServer: typeof startServer;
} {
  const registry = getModuleRegistry();

  if (!registry) {
    throw new Error('Module registry not available');
  }

  if (typeof createApp !== 'function') {
    throw new Error('Server createApp function not available');
  }

  if (typeof startServer !== 'function') {
    throw new Error('Server startServer function not available');
  }

  return {
    createApp,
    startServer
  };
}

/**
 * Export function to get module instance using the module loader pattern.
 * @returns The server module exports.
 */
export const get = function get(): {
  createApp: typeof createApp;
  startServer: typeof startServer;
} {
  return getServerModule();
}
