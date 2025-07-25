/**
 * @file Main HTTP server for systemprompt-os.
 * @module server
 */

import express from 'express';
import cors from 'cors';
// Import helmet from 'helmet';
import { CONFIG } from '@/server/config';
import { setupExternalEndpoints } from '@/server/external/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { getModuleLoader } from '@/modules/loader';

const logger = LoggerService.getInstance();

/**
 * Creates and configures the Express application.
 * @returns Promise that resolves to Express application.
 */
export const createApp = async (): Promise<express.Application> => {
  const app = express();

  const moduleLoader = getModuleLoader();

  const authModule = moduleLoader.getModule('auth');
  if (authModule?.start && !authModule.initialized) {
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
export const startServer = async (
  port?: number,
): Promise<ReturnType<express.Application['listen']>> => {
  const app = await createApp();
  const serverPort = port ?? parseInt(CONFIG.PORT, 10);

  const server = app.listen(serverPort, '0.0.0.0', (): void => {
    logger.info(LogSource.SERVER, `🚀 systemprompt-os running on port ${String(serverPort)}`);
    logger.info(LogSource.SERVER, `📡 API endpoint: http://localhost:${String(serverPort)}`);
    logger.info(
      LogSource.SERVER,
      `🔐 OAuth2 discovery: http://localhost:${String(serverPort)}/.well-known/oauth-protected-resource`
    );

    const AUTH_STATUS_DELAY = 2000;
    setTimeout((): void => {
      const moduleLoaderDelayed = getModuleLoader();
      const authModuleDelayed = moduleLoaderDelayed.getModule('auth') as { getTunnelStatus?: () => { active: boolean; url?: string } } | undefined;
      if (authModuleDelayed?.getTunnelStatus) {
        const tunnelStatus = authModuleDelayed.getTunnelStatus();
        if (tunnelStatus.active && tunnelStatus.url) {
          logger.info(LogSource.AUTH, '');
          logger.info(LogSource.AUTH, '🚇 OAuth Tunnel Active');
          logger.info(LogSource.AUTH, `📍 Public URL: ${tunnelStatus.url}`);
          logger.info(LogSource.AUTH, `🔗 OAuth Redirect Base: ${tunnelStatus.url}/oauth2/callback`);
          logger.info(LogSource.AUTH, '');
          logger.info(LogSource.AUTH, 'Configure your OAuth providers with:');
          logger.info(LogSource.AUTH, `  Google: ${tunnelStatus.url}/oauth2/callback/google`);
          logger.info(LogSource.AUTH, `  GitHub: ${tunnelStatus.url}/oauth2/callback/github`);
        } else if (process.env['GOOGLE_CLIENT_ID'] ?? process.env['GITHUB_CLIENT_ID']) {
          logger.info(LogSource.AUTH, '');
          logger.info(LogSource.AUTH, '⚠️  OAuth providers configured but no tunnel active');
          logger.info(LogSource.AUTH, '💡 Set ENABLE_OAUTH_TUNNEL=true to auto-create tunnel');
          logger.info(LogSource.AUTH, '💡 Or set OAUTH_DOMAIN=https://yourdomain.com for permanent URL');
        }
      }
    }, AUTH_STATUS_DELAY);
  });

  return server;
};
