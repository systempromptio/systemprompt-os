// eslint-disable-next-line systemprompt-os/no-block-comments
/* eslint-disable systemprompt-os/no-console-with-help */
/**
 * Main entry point for systemprompt-os.
 * Handles the world-class bootstrap process and server startup.
 * @module index
 */

import { type Bootstrap, runBootstrap } from './bootstrap';
import { type Server } from 'http';
import { startServer } from './server/index';
import { EXIT_FAILURE, EXIT_SUCCESS } from './constants/process.constants';
import { type ILogger, LogSource } from './modules/core/logger/types/index';
import { getLoggerService } from './modules/core/logger';
import { FrontendService } from './server/services/frontend.service';

/**
 * Bootstrap instance for shutdown handling.
 */
let bootstrapInstance: Bootstrap | null = null;

/**
 * Handles graceful shutdown of the application.
 * @param server - HTTP server instance.
 * @param logger - Logger service instance.
 */
const handleShutdown = async (server: Server, logger: ILogger): Promise<void> => {
  logger.info(LogSource.BOOTSTRAP, '📢 Shutdown signal received...');

  // Stop frontend service if running
  const frontendService = FrontendService.getInstance();
  if (frontendService.isRunning()) {
    logger.info(LogSource.BOOTSTRAP, 'Stopping frontend service...');
    await frontendService.stop();
    logger.info(LogSource.BOOTSTRAP, '✓ Frontend service stopped');
  }

  await new Promise<void>((resolve): void => {
    server.close((): void => {
      logger.info(LogSource.BOOTSTRAP, '✓ HTTP server closed');
      resolve();
    });
  });

  if (bootstrapInstance !== null) {
    await bootstrapInstance.shutdown();
  }

  logger.info(LogSource.BOOTSTRAP, '👋 SystemPrompt OS shutdown complete');
  process.exit(EXIT_SUCCESS);
};

/**
 * Logs startup summary information.
 * @param logger - Logger service instance.
 * @param bootstrap - Bootstrap instance.
 */
const logStartupSummary = (logger: ILogger, bootstrap: Bootstrap): void => {
  logger.info(LogSource.BOOTSTRAP, '');
  logger.info(LogSource.BOOTSTRAP, '🎉 SystemPrompt OS Ready!');
  logger.info(LogSource.BOOTSTRAP, '📊 System Status:');
  const moduleCount = String(bootstrap.getModules().size);
  logger.info(LogSource.BOOTSTRAP, `  • Core Modules: ${moduleCount} loaded`);
  logger.info(LogSource.BOOTSTRAP, `  • Bootstrap Phase: ${bootstrap.getCurrentPhase()}`);
  logger.info(LogSource.BOOTSTRAP, '');
};

/**
 * Creates a shutdown handler.
 * @param server - HTTP server instance.
 * @param logger - Logger service instance.
 * @returns Shutdown handler function.
 */
const createShutdownHandler = (server: Server, logger: ILogger): (() => void) => {
  return (): void => {
    handleShutdown(server, logger).catch((error: unknown): void => {
      logger.error(LogSource.BOOTSTRAP, 'Error during shutdown:', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(EXIT_FAILURE);
    });
  };
};

/**
 * Handles startup errors.
 * @param error - The error that occurred.
 */
const handleStartupError = (error: unknown): void => {
  if (bootstrapInstance === null) {
    console.error('💥 Failed to start SystemPrompt OS:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  } else {
    const logger = getLoggerService();
    logger.error(LogSource.BOOTSTRAP, '💥 Failed to start SystemPrompt OS:', {
      error: error instanceof Error ? error : new Error(String(error))
    });
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
  process.exit(EXIT_FAILURE);
};

/**
 * Main entry point function.
 */
const main = async (): Promise<void> => {
  try {
    console.log('🌟 SystemPrompt OS Starting...');

    bootstrapInstance = await runBootstrap();

    const logger = getLoggerService();
    
    // Register CLI commands after modules are loaded
    try {
      const cliModule = bootstrapInstance.getModule('cli');
      if (cliModule && cliModule.exports) {
        const modules = bootstrapInstance.getModules();
        const moduleMap = new Map<string, { path: string }>();
        
        // Build module map for CLI registration
        for (const [name, module] of modules) {
          // Use the module's actual path (relative to src/modules/core)
          moduleMap.set(name, { 
            path: `/Users/edward/systemprompt-os/src/modules/core/${name}` 
          });
        }
        
        // Register all module CLI commands
        await (cliModule.exports as any).scanAndRegisterModuleCommands(moduleMap);
        logger.info(LogSource.BOOTSTRAP, 'CLI commands registered');
      }
    } catch (error) {
      logger.warn(LogSource.BOOTSTRAP, 'Failed to register CLI commands', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    const server = await startServer();

    const shutdownHandler = createShutdownHandler(server, logger);

    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);

    logStartupSummary(logger, bootstrapInstance);
  } catch (error) {
    handleStartupError(error);
  }
};

main().catch((error: unknown): void => {
  console.error('💥 Unhandled error in main:', error);
  process.exit(EXIT_FAILURE);
});
