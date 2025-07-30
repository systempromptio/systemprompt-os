/**
 * Main HTTP server for systemprompt-os.
 * @file Main HTTP server for systemprompt-os.
 * @module server
 */

import express from 'express';
import cors from 'cors';
import { CONFIG } from '@/server/config';
import { setupExternalEndpoints } from '@/server/external/setup';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { getModuleRegistry } from '@/modules/core/modules/index';
import { ModuleName } from '@/modules/types/module-names.types';
import { UrlConfigService } from '@/modules/core/system/services/url-config.service';
import type { Server } from 'http';

const logger = LoggerService.getInstance();

/**
 * Creates and configures the Express application.
 * @returns Promise that resolves to Express application.
 */
export const createApp = async function createApp(): Promise<express.Application> {
  console.log('Creating Express app... UPDATED!!!');
  const app = express();

  app.get('/immediate-test', (_req, res) => {
    res.json({ message: 'Immediate test route working' });
  });

  app.use((req, _res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.url}`);
    next();
  });

  let registry;
  try {
    registry = getModuleRegistry();
    console.log('Module registry obtained');
  } catch (error) {
    console.error('Error getting module registry:', error);
    throw error;
  }

  const authModule = registry.get(ModuleName.AUTH);
  if (authModule && 'start' in authModule && 'initialized' in authModule
      && authModule.start !== null && authModule.start !== undefined && authModule.initialized !== true
  ) {
    await authModule.start();
  }

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

  try {
    await setupExternalEndpoints(app);
  } catch (error) {
    console.error('Error setting up external endpoints:', error);
    throw error;
  }

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
  const app = await createApp();
  const serverPort = port ?? parseInt(CONFIG.PORT, 10);

  const urlConfigService = UrlConfigService.getInstance();
  await urlConfigService.initialize();

  const server = app.listen(serverPort, '0.0.0.0', async (): Promise<void> => {
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

  return server;
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
