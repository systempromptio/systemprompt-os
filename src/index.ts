#!/usr/bin/env node
/**
 * @fileoverview Main entry point for systemprompt-os
 * @module index
 */

import { startServer } from './server/index.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    const server = await startServer();
    
    // Graceful shutdown handlers
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        process.exit(0);
      });
    });
  } catch ( error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();