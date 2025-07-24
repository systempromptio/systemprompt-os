/**
 * Main entry point for systemprompt-os.
 * Handles the world-class bootstrap process and server startup.
 * @module index
 */

import { type Bootstrap, runBootstrap } from './bootstrap.js';
import { startServer } from './server/index.js';
import { tunnelStatus } from './modules/core/auth/tunnel-status.js';

// Keep bootstrap instance for shutdown
let bootstrapInstance: Bootstrap | null = null;

/**
 * Main entry point function.
 */
const main = async (): Promise<void> => {
  try {
    // World-class bootstrap process
    console.log('🌟 SystemPrompt OS Starting...');

    // Phase 1-3: Core modules, MCP servers, and autodiscovery
    bootstrapInstance = await runBootstrap();

    // Get logger from bootstrap
    const loggerModule = bootstrapInstance.getModules().get('logger');
    const logger = loggerModule?.exports && typeof loggerModule.exports === 'object' && 'service' in loggerModule.exports ? loggerModule.exports['service'] : console;

    // Initialize tunnel status with BASE_URL if available
    if (process.env['BASE_URL']) {
      tunnelStatus.setBaseUrl(process.env['BASE_URL']);
      logger.info(`Initialized tunnel status with BASE_URL: ${process.env['BASE_URL']}`);
    }

    // Start the HTTP server (which now only handles REST endpoints)
    const server = await startServer();

    /**
     * Handle graceful shutdown.
     */
    const shutdown = async (): Promise<void> => {
      logger.info('📢 Shutdown signal received...');

      // Close HTTP server
      await new Promise<void>((resolve): void => {
        server.close((): void => {
          logger.info('✓ HTTP server closed');
          resolve();
        });
      });

      // Shutdown all modules through bootstrap
      if (bootstrapInstance !== null) {
        await bootstrapInstance.shutdown();
      }

      logger.info('👋 SystemPrompt OS shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', (): void => {
      void shutdown();
    });
    process.on('SIGINT', (): void => {
      void shutdown();
    });

    // Log startup summary
    logger.info('');
    logger.info('🎉 SystemPrompt OS Ready!');
    logger.info('📊 System Status:');
    logger.info(`  • Core Modules: ${String(bootstrapInstance.getModules().size)} loaded`);
    logger.info(`  • Bootstrap Phase: ${bootstrapInstance.getCurrentPhase()}`);
    logger.info('');
  } catch (error) {
    console.error('💥 Failed to start SystemPrompt OS:', error);
    process.exit(1);
  }
};

// Start the application
void main();
