/**
 * Integrated server that combines the event-driven core with Express modules.
 * This bridges the new architecture with existing module endpoints.
 */

import { ServerCore } from './core/server';
import { HttpProtocolHandler } from './protocols/http/http-protocol';
import { McpProtocolHandlerV2 } from './protocols/mcp/mcp-protocol';
import { ModuleBridge } from './integration/module-bridge';
import { ServerEvents } from './core/types/events.types';
import { setupExternalEndpoints } from './external/setup';
import { setupHealthEndpoints } from './health';
import { getModuleRegistry } from '@/modules/core/modules/index';
import { ModuleName } from '@/modules/types/module-names.types';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { MCPEventBridge } from './mcp/handlers/mcp-event-bridge';
import type { Server } from 'http';
import type { Application } from 'express';

const logger = LoggerService.getInstance();

/**
 * Start the integrated server combining event-driven core and Express modules.
 * @param port - Optional port number.
 * @returns Promise that resolves to server instance.
 */
export async function startIntegratedServer(port?: number): Promise<Server> {
  const serverPort = port ?? parseInt(process.env.PORT || '3000', 10);
  
  // Create the event-driven server core
  const serverCore = new ServerCore({ port: serverPort });
  
  // Register protocol handlers
  const httpHandler = new HttpProtocolHandler();
  const mcpHandler = new McpProtocolHandlerV2();
  
  await serverCore.registerProtocol('http', httpHandler);
  await serverCore.registerProtocol('mcp', mcpHandler);
  
  // Create module bridge for integrating existing modules
  const moduleBridge = new ModuleBridge(serverCore.eventBus);
  
  // Initialize MCP event bridge
  const mcpEventBridge = MCPEventBridge.getInstance();
  mcpEventBridge.initialize(serverCore.eventBus);
  
  // Set up module endpoint registration
  setupModuleEndpoints(serverCore, moduleBridge);
  
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
  
  // Start the server
  await serverCore.start();
  
  // Get the actual HTTP server instance for compatibility
  const httpServer = (httpHandler as any).server as Server;
  
  return httpServer;
}

/**
 * Set up module endpoint registration.
 * Maps existing Express routes to event-driven endpoints.
 */
function setupModuleEndpoints(serverCore: ServerCore, moduleBridge: ModuleBridge): void {
  // Get the Express app from HTTP handler
  const httpHandler = serverCore.getProtocolHandler('http') as any;
  const app = httpHandler.app as Application;
  
  if (!app) {
    logger.error(LogSource.SERVER, 'Express app not available from HTTP handler');
    return;
  }
  
  // Set up existing external endpoints
  setupExternalEndpoints(app).catch((error) => {
    logger.error(LogSource.SERVER, 'Failed to setup external endpoints:', {
      error: error instanceof Error ? error.message : String(error)
    });
  });
  
  // Set up health endpoints
  setupHealthEndpoints(app);
  
  // Register all Express routes as event-driven endpoints
  serverCore.eventBus.on(ServerEvents.PROTOCOL_STARTED, (event) => {
    if (event.name === 'http') {
      // Express routes are now available via the HTTP protocol handler
      logger.info(LogSource.SERVER, 'HTTP protocol started, Express routes available');
    }
  });
}

/**
 * Create integrated app for testing.
 * Combines event-driven server with Express compatibility.
 */
export async function createIntegratedApp(): Promise<Application> {
  const serverCore = new ServerCore({ port: 0 });
  const httpHandler = new HttpProtocolHandler();
  
  await serverCore.registerProtocol('http', httpHandler);
  
  // Get Express app from handler
  const app = (httpHandler as any).app as Application;
  
  // Set up routes
  await setupExternalEndpoints(app);
  setupHealthEndpoints(app);
  
  return app;
}