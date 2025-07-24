/**
 * @file Main HTTP server for systemprompt-os.
 * @module server
 */

import express from 'express';
import cors from 'cors';
// Import helmet from 'helmet';
import { CONFIG } from '@/server/config.js';
import { setupExternalEndpoints } from '@/server/external/index.js';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import { getModuleLoader } from '@/modules/loader.js';

const logger = LoggerService.getInstance();

/**
 * Creates and configures the Express application.
 * @returns Promise that resolves to Express application.
 */
export const createApp = async (): Promise<express.Application> => {
  const app = express();

  // Modules are now loaded by bootstrap, just get reference for auth check
  const moduleLoader = getModuleLoader();

  // Ensure auth providers are initialized
  const authModule = moduleLoader.getModule('auth');
  if (authModule?.start && !authModule.initialized) {
    await authModule.start();
  }

  /*
   * Security middleware
   * TODO: Add helmet when available
   * app.use(helmet({
   *   contentSecurityPolicy: false, // We'll configure this per-route
   * }));
   */

  // CORS configuration
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

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Setup REST API endpoints only (MCP is handled by bootstrap)
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
    logger.info(`🚀 systemprompt-os running on port ${String(serverPort)}`);
    logger.info(`📡 API endpoint: http://localhost:${String(serverPort)}`);
    logger.info(
      `🔐 OAuth2 discovery: http://localhost:${String(serverPort)}/.well-known/oauth-protected-resource`,
    );

    // Log OAuth tunnel status after a brief delay to ensure it's initialized
    const AUTH_STATUS_DELAY = 2000;
    setTimeout((): void => {
      const moduleLoaderDelayed = getModuleLoader();
      const authModuleDelayed = moduleLoaderDelayed.getModule('auth') as { getTunnelStatus?: () => { active: boolean; url?: string } } | undefined;
      if (authModuleDelayed?.getTunnelStatus) {
        const tunnelStatus = authModuleDelayed.getTunnelStatus();
        if (tunnelStatus.active && tunnelStatus.url) {
          logger.info('');
          logger.info('🚇 OAuth Tunnel Active');
          logger.info(`📍 Public URL: ${tunnelStatus.url}`);
          logger.info(`🔗 OAuth Redirect Base: ${tunnelStatus.url}/oauth2/callback`);
          logger.info('');
          logger.info('Configure your OAuth providers with:');
          logger.info(`  Google: ${tunnelStatus.url}/oauth2/callback/google`);
          logger.info(`  GitHub: ${tunnelStatus.url}/oauth2/callback/github`);
        } else if (process.env['GOOGLE_CLIENT_ID'] ?? process.env['GITHUB_CLIENT_ID']) {
          logger.info('');
          logger.info('⚠️  OAuth providers configured but no tunnel active');
          logger.info('💡 Set ENABLE_OAUTH_TUNNEL=true to auto-create tunnel');
          logger.info('💡 Or set OAUTH_DOMAIN=https://yourdomain.com for permanent URL');
        }
      }
    }, AUTH_STATUS_DELAY);
  });

  // Server close is now simpler - modules are handled by bootstrap

  return server;
};
