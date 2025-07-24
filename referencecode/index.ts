/**
 * @fileoverview Main entry point for systemprompt-os
 * @module index
 */

import 'reflect-metadata';
import { runBootstrap } from './bootstrap.js';
import { startServer } from './server/index.js';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';

const logger = LoggerService.getInstance();

async function main() {
  try {
    // Bootstrap core modules first
    logger.info('Bootstrapping core modules...');
    const coreModules = await runBootstrap();
    logger.info(`Bootstrapped ${coreModules.size} core modules`);

    // Start the server
    const server = await startServer();

    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info('Shutdown signal received, closing server...');

      await new Promise<void>((resolve) => {
        server.close(() => {
          logger.info('Server closed');
          resolve();
        });
      });

      // Shutdown bootstrap modules
      logger.info('Shutting down modules...');
      const { Bootstrap } = await import('./bootstrap.js');
      const bootstrap = new Bootstrap();
      await bootstrap.shutdown();

      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
