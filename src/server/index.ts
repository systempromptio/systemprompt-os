/**
 * Pure Event-Driven Server for SystemPrompt OS.
 * No backward compatibility - clean architecture only.
 */

import { LoggerService } from '../modules/core/logger/services/logger.service';
import { LogSource } from '../modules/core/logger/types/manual';
import { UrlConfigService } from '../modules/core/system/services/url-config.service';
import { ServerCore } from './core/server';
import { HttpProtocolHandler } from './protocols/http/http-protocol';
import { McpProtocolHandlerV2 } from './protocols/mcp/mcp-protocol';
import { ModuleBridge } from './integration/module-bridge';
import { ServerEvents } from './core/types/events.types';

const logger = LoggerService.getInstance();

/**
 * Starts the event-driven server.
 * @param port - Port number to listen on.
 * @returns Promise that resolves when server is started.
 */
export const startServer = async function startServer(port: number = 3000): Promise<ServerCore> {
  logger.info(LogSource.SERVER, 'Starting event-driven server');
  
  // Create the event-driven server core
  const serverCore = new ServerCore({ port });
  
  // Register protocol handlers
  const httpHandler = new HttpProtocolHandler();
  const mcpHandler = new McpProtocolHandlerV2();
  
  await serverCore.registerProtocol('http', httpHandler);
  await serverCore.registerProtocol('mcp', mcpHandler);
  
  // Create module bridge for dynamic endpoint registration
  new ModuleBridge(serverCore.eventBus);
  
  // Initialize URL configuration
  const urlConfigService = UrlConfigService.getInstance();
  await urlConfigService.initialize();
  
  // Set up server started event handler
  serverCore.eventBus.once(ServerEvents.STARTED, async () => {
    try {
      const urlConfig = await urlConfigService.getUrlConfig();
      const { baseUrl } = urlConfig;
      const isTunnel = Boolean(urlConfig.tunnelUrl);

      logger.info(LogSource.SERVER, `🚀 SystemPrompt OS running on port ${port}`);

      if (isTunnel) {
        logger.info(LogSource.SERVER, `🌐 Public URL (tunnel): ${baseUrl}`);
        logger.info(LogSource.SERVER, `📡 API endpoint: ${baseUrl}`);
        logger.info(LogSource.SERVER, `🔐 OAuth2 discovery: ${baseUrl}/.well-known/oauth-protected-resource`);
      } else {
        logger.info(LogSource.SERVER, `📡 Local endpoint: http://localhost:${port}`);
        logger.info(LogSource.SERVER, `🌐 Public URL: ${baseUrl}`);
        logger.info(LogSource.SERVER, `🔐 OAuth2 discovery: ${baseUrl}/.well-known/oauth-protected-resource`);
      }
    } catch (error) {
      logger.warn(LogSource.SERVER, 'Failed to get URL configuration, using localhost', {
        error: error instanceof Error ? error.message : String(error)
      });
      logger.info(LogSource.SERVER, `📡 Local endpoint: http://localhost:${port}`);
    }
  });
  
  // Start the server
  await serverCore.start();
  
  return serverCore;
};

/**
 * Export the clean server interface.
 */
export { ServerCore } from './core/server';
export { HttpProtocolHandler } from './protocols/http/http-protocol';
export { McpProtocolHandlerV2 } from './protocols/mcp/mcp-protocol';
export { ModuleBridge } from './integration/module-bridge';