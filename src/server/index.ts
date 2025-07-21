/**
 * @fileoverview Main HTTP server for systemprompt-os
 * @module server
 */

import express from 'express';
import cors from 'cors';
// import helmet from 'helmet';
import { CONFIG } from './config.js';
import { setupExternalEndpoints } from './external/index.js';
import { setupMCPServers } from './mcp/index.js';
import { logger } from '../utils/logger.js';
import { getModuleLoader } from '../modules/loader.js';

/**
 * Creates and configures the Express application
 */
export async function createApp(): Promise<express.Application> {
  const app = express();
  
  // Load and initialize system modules
  const moduleLoader = getModuleLoader();
  await moduleLoader.loadModules();
  
  // Start the auth module to initialize providers
  const authModule = moduleLoader.getModule('auth');
  if (authModule && typeof authModule.start === 'function') {
    await authModule.start();
  }
  
  // Security middleware
  // TODO: Add helmet when available
  // app.use(helmet({
  //   contentSecurityPolicy: false, // We'll configure this per-route
  // }));
  
  // CORS configuration
  app.use(cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept', 'mcp-session-id', 'x-session-id'],
    exposedHeaders: ['x-session-id', 'mcp-session-id'],
  }));
  
  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Setup REST API endpoints
  const router = express.Router();
  await setupExternalEndpoints(app, router);
  
  // Setup MCP servers
  await setupMCPServers( app);
  
  
  return app;
}

/**
 * Starts the HTTP server
 */
export async function startServer(port?: number): Promise<ReturnType<express.Application['listen']>> {
  const app = await createApp();
  const serverPort = port || parseInt(CONFIG.PORT, 10);
  
  const server = app.listen(serverPort, '0.0.0.0', async () => {
    logger.info(`🚀 systemprompt-os running on port ${serverPort}`);
    logger.info(`📡 API endpoint: http://localhost:${serverPort}`);
    logger.info(`🔐 OAuth2 discovery: http://localhost:${serverPort}/.well-known/oauth-protected-resource`);
    
    // Log OAuth tunnel status after a brief delay to ensure it's initialized
    setTimeout(() => {
      const moduleLoader = getModuleLoader();
      const authModule = moduleLoader.getModule('auth') as any;
      if (authModule) {
        const tunnelStatus = authModule.getTunnelStatus();
        if (tunnelStatus.active) {
          logger.info('');
          logger.info('🚇 OAuth Tunnel Active');
          logger.info(`📍 Public URL: ${tunnelStatus.url}`);
          logger.info(`🔗 OAuth Redirect Base: ${tunnelStatus.url}/oauth2/callback`);
          logger.info('');
          logger.info('Configure your OAuth providers with:');
          logger.info(`  Google: ${tunnelStatus.url}/oauth2/callback/google`);
          logger.info(`  GitHub: ${tunnelStatus.url}/oauth2/callback/github`);
        } else if (process.env.GOOGLE_CLIENT_ID || process.env.GITHUB_CLIENT_ID) {
          logger.info('');
          logger.info('⚠️  OAuth providers configured but no tunnel active');
          logger.info('💡 Set ENABLE_OAUTH_TUNNEL=true to auto-create tunnel');
          logger.info('💡 Or set OAUTH_DOMAIN=https://yourdomain.com for permanent URL');
        }
      }
    }, 2000);
  });
  
  // Add graceful shutdown for modules
  const originalClose = server.close.bind( server);
  server.close = ((callback?: (err?: Error) => void) => {
    const moduleLoader = getModuleLoader();
    moduleLoader.shutdown().then(() => {
      originalClose( callback);
    }).catch((err: Error) => {
      logger.error('Error shutting down modules:', err);
      originalClose( callback);
    });
    return server;
  }) as typeof server.close;
  
  return server;
}