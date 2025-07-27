/**
 * Main HTTP server for systemprompt-os.
 * @file Main HTTP server for systemprompt-os.
 * @module server
 */

import express from 'express';
import cors from 'cors';
import { CONFIG } from '@/server/config';
import { setupExternalEndpoints } from '@/server/external/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { getModuleLoader } from '@/modules/loader';
import { ModuleName } from '@/modules/types/module-names.types';
import type { ITunnelStatus } from '@/modules/core/auth/types/tunnel.types';
import type { IModuleInstance } from '@/modules/types/loader.types';
import type { Server } from 'http';
import type { ModuleLoader } from '@/modules/loader';

const logger = LoggerService.getInstance();

/**
 * Type guard to check if module has getTunnelStatus method.
 * @param moduleInstance - Module instance to check.
 * @returns True if module has getTunnelStatus method.
 */
const hasGetTunnelStatus = function hasGetTunnelStatus(
  moduleInstance: unknown
): moduleInstance is { getTunnelStatus: () => ITunnelStatus } {
  if (
    moduleInstance === null
    || moduleInstance === undefined
    || typeof moduleInstance !== 'object'
    || !('getTunnelStatus' in moduleInstance)
  ) {
    return false;
  }

  const mod = moduleInstance as object & { getTunnelStatus?: unknown };
  return typeof mod.getTunnelStatus === 'function';
}

/**
 * Logs OAuth tunnel status information.
 * @param tunnelUrl - The tunnel URL if active.
 */
const logActiveTunnelStatus = function logActiveTunnelStatus(tunnelUrl: string): void {
  logger.info(LogSource.AUTH, '');
  logger.info(LogSource.AUTH, '🚇 OAuth Tunnel Active');
  logger.info(LogSource.AUTH, `📍 Public URL: ${tunnelUrl}`);
  logger.info(LogSource.AUTH, `🔗 OAuth Redirect Base: ${tunnelUrl}/oauth2/callback`);
  logger.info(LogSource.AUTH, '');
  logger.info(LogSource.AUTH, 'Configure your OAuth providers with:');
  logger.info(LogSource.AUTH, `  Google: ${tunnelUrl}/oauth2/callback/google`);
  logger.info(LogSource.AUTH, `  GitHub: ${tunnelUrl}/oauth2/callback/github`);
}

/**
 * Logs OAuth configuration warnings when tunnel is not active.
 */
const logInactiveTunnelWarning = function logInactiveTunnelWarning(): void {
  logger.info(LogSource.AUTH, '');
  logger.info(LogSource.AUTH, '⚠️  OAuth providers configured but no tunnel active');
  logger.info(LogSource.AUTH, '💡 Set ENABLE_OAUTH_TUNNEL=true to auto-create tunnel');
  logger.info(
    LogSource.AUTH,
    '💡 Or set OAUTH_DOMAIN=https://yourdomain.com for permanent URL',
  );
}

/**
 * Creates and configures the Express application.
 * @returns Promise that resolves to Express application.
 */
export const createApp = async function createApp(): Promise<express.Application> {
  const app = express();

  const moduleLoader: ModuleLoader = getModuleLoader();

  const authModule: IModuleInstance = moduleLoader.getModule(ModuleName.AUTH);
  if ('start' in authModule && 'initialized' in authModule
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

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  await setupExternalEndpoints(app);

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

  const server = app.listen(serverPort, '0.0.0.0', (): void => {
    logger.info(LogSource.SERVER, `🚀 systemprompt-os running on port ${String(serverPort)}`);
    logger.info(LogSource.SERVER, `📡 API endpoint: http://localhost:${String(serverPort)}`);
    logger.info(
      LogSource.SERVER,
      `🔐 OAuth2 discovery: http://localhost:${String(serverPort)}`
        + '/.well-known/oauth-protected-resource',
    );

    const AUTH_STATUS_DELAY = 2000;
    setTimeout((): void => {
      const moduleLoaderDelayed: ModuleLoader = getModuleLoader();
      const authModuleDelayed: IModuleInstance = moduleLoaderDelayed.getModule(ModuleName.AUTH);

      if (hasGetTunnelStatus(authModuleDelayed)) {
        const tunnelStatus = authModuleDelayed.getTunnelStatus();

        if (tunnelStatus.active && tunnelStatus.url !== null && tunnelStatus.url !== undefined) {
          logActiveTunnelStatus(tunnelStatus.url);
        } else if ((process.env.GOOGLE_CLIENT_ID ?? process.env.GITHUB_CLIENT_ID) !== undefined) {
          logInactiveTunnelWarning();
        }
      }
    }, AUTH_STATUS_DELAY);
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
  const moduleLoader: ModuleLoader = getModuleLoader();

  if (!moduleLoader) {
    throw new Error('Module loader not available');
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
