#!/usr/bin/env node
/**
 * @fileoverview Main entry point for the SystemPrompt Coding Agent MCP server.
 * Initializes the environment and starts the HTTP server on the configured port.
 * @module index
 * 
 * @remarks
 * This is the executable entry point for the SystemPrompt Coding Agent MCP server when run directly.
 * It loads environment variables and starts the HTTP server on the configured port.
 * 
 * The server can be started using:
 * - `npm start` - Production mode
 * - `npm run dev` - Development mode with auto-reload
 * - `node dist/index.js` - Direct execution
 * 
 * @see {@link https://modelcontextprotocol.io} Model Context Protocol Documentation
 */

import dotenv from 'dotenv';
dotenv.config();

import { startServer } from './server.js';
import { CONFIG } from './server/config.js';
import { logger } from './utils/logger.js';

const port = parseInt(CONFIG.PORT, 10);
(async () => {
  try {
    const server = await startServer(port);
    server.on('error', (error) => {
      logger.error('Failed to start server:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
})();
