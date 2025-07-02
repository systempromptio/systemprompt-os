#!/usr/bin/env node
/**
 * @fileoverview Main HTTP server for Coding Agent MCP
 * @module server
 * 
 * @remarks
 * This module provides the Express.js HTTP server that handles:
 * - MCP protocol endpoints (no authentication)
 * - Health checks and metadata endpoints
 * - CORS configuration for cross-origin requests
 * - Graceful shutdown handling
 * 
 * @example
 * ```typescript
 * import { startServer } from './server';
 * 
 * // Start server on default port
 * const server = await startServer();
 * 
 * // Start server on custom port
 * const server = await startServer(8080);
 * ```
 */

import express from 'express';
import cors from 'cors';
import { CONFIG } from './server/config.js';
import { MCPHandler } from './server/mcp.js';
import { setMCPHandlerInstance } from './server/mcp.js';
import { TaskStore } from './services/task-store.js';
import { logger } from './utils/logger.js';


/**
 * Creates and configures the Express application
 * 
 * @returns Configured Express application with MCP endpoint
 * 
 * @remarks
 * This function:
 * 1. Initializes the MCP handler
 * 2. Configures CORS for cross-origin support
 * 3. Sets up selective body parsing (skips MCP endpoint)
 * 4. Registers all routes
 */
export async function createApp(): Promise<express.Application> {
  const app = express();
  
  const mcpHandler = new MCPHandler();
  setMCPHandlerInstance(mcpHandler);

  app.use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept'],
      exposedHeaders: ['mcp-session-id', 'x-session-id'],
    })
  );

  app.use((req, res, next) => {
    if (req.path === '/mcp') {
      next();
    } else {
      express.json()(req, res, (err) => {
        if (err) return next(err);
        express.urlencoded({ extended: true })(req, res, next);
      });
    }
  });

  await mcpHandler.setupRoutes(app);
  setupUtilityRoutes(app);

  return app;
}

/**
 * Sets up utility routes for health checks and metadata
 * 
 * @param app - Express application instance
 */
function setupUtilityRoutes(app: express.Application): void {
  app.get('/health', (_, res) => {
    res.json({
      status: 'ok',
      service: 'coding-agent-mcp-server',
      transport: 'http',
      capabilities: {
        mcp: true,
      },
    });
  });

  app.get('/', (req, res) => {
    const protocol =
      req.get('x-forwarded-proto') ||
      (req.get('host')?.includes('systemprompt.io') ? 'https' : req.protocol);
    const baseUrl = `${protocol}://${req.get('host')}`;
    const basePath = req.baseUrl || '';
    
    res.json({
      service: 'Coding Agent MCP Server',
      version: '1.0.0',
      transport: 'http',
      endpoints: {
        mcp: `${baseUrl}${basePath}/mcp`,
        health: `${baseUrl}${basePath}/health`,
      },
    });
  });
}

/**
 * Starts the HTTP server
 * 
 * @param port - Port number to listen on (defaults to CONFIG.PORT)
 * @returns Server instance
 * 
 * @example
 * ```typescript
 * const server = await startServer(3000);
 * ```
 */
export async function startServer(port?: number): Promise<ReturnType<express.Application['listen']>> {
  const app = await createApp();
  const serverPort = port || parseInt(CONFIG.PORT, 10);
  TaskStore.getInstance();
  
  return app.listen(serverPort, '0.0.0.0', () => {
    logger.info(`🚀 Coding Agent MCP Server running on port ${serverPort}`);
    logger.info(`📡 MCP endpoint: http://localhost:${serverPort}/mcp`);
    logger.info(`❤️  Health: http://localhost:${serverPort}/health`);
  });
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});