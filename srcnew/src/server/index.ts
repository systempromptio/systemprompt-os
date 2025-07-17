/**
 * @fileoverview Main HTTP server for systemprompt-os
 * @module server
 */

import express from 'express';
import cors from 'cors';
// import helmet from 'helmet';
import { CONFIG } from './config.js';
import { setupExternalAPI } from './external/index.js';
import { setupMCPServers } from './mcp/index.js';
import { logger } from '../utils/logger.js';
import { getModuleLoader } from '../core/modules/loader.js';

/**
 * Creates and configures the Express application
 */
export async function createApp(): Promise<express.Application> {
  const app = express();
  
  // Load and initialize system modules
  const moduleLoader = getModuleLoader();
  await moduleLoader.loadModules();
  
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
  await setupExternalAPI(app);
  
  // Setup MCP servers
  await setupMCPServers(app);
  
  // Root endpoint
  app.get('/', (req, res) => {
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;
    
    res.json({
      service: 'systemprompt-os',
      version: '0.1.0',
      description: 'An operating system for autonomous agents',
      endpoints: {
        health: `${baseUrl}/health`,
        status: `${baseUrl}/status`,
        oauth2: {
          discovery: `${baseUrl}/.well-known/openid-configuration`,
          authorize: `${baseUrl}/oauth2/authorize`,
          token: `${baseUrl}/oauth2/token`,
          userinfo: `${baseUrl}/oauth2/userinfo`,
        },
        mcp: {
          core: `${baseUrl}/mcp/core`,
          custom: `${baseUrl}/mcp/custom/*`,
        },
      },
    });
  });
  
  return app;
}

/**
 * Starts the HTTP server
 */
export async function startServer(port?: number): Promise<ReturnType<express.Application['listen']>> {
  const app = await createApp();
  const serverPort = port || parseInt(CONFIG.PORT, 10);
  
  const server = app.listen(serverPort, '0.0.0.0', () => {
    logger.info(`🚀 systemprompt-os running on port ${serverPort}`);
    logger.info(`📡 API endpoint: http://localhost:${serverPort}`);
    logger.info(`🔐 OAuth2 discovery: http://localhost:${serverPort}/.well-known/openid-configuration`);
  });
  
  // Add graceful shutdown for modules
  const originalClose = server.close.bind(server);
  server.close = ((callback?: (err?: Error) => void) => {
    const moduleLoader = getModuleLoader();
    moduleLoader.shutdown().then(() => {
      originalClose(callback);
    }).catch((err) => {
      logger.error('Error shutting down modules:', err);
      originalClose(callback);
    });
    return server;
  }) as typeof server.close;
  
  return server;
}