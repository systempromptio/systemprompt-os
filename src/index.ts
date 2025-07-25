// eslint-disable-next-line systemprompt-os/no-block-comments
/* eslint-disable systemprompt-os/no-console-with-help */
/**
 * Main entry point for systemprompt-os.
 * Handles the world-class bootstrap process and server startup.
 * @module index
 */

import { type Bootstrap, runBootstrap } from './bootstrap.js';
import { type Server } from 'http';
import { startServer } from './server/index.js';
import { tunnelStatus } from './modules/core/auth/tunnel-status.js';
import { EXIT_FAILURE, EXIT_SUCCESS } from './constants/process.constants.js';

/**
 * Bootstrap instance for shutdown handling.
 */
let bootstrapInstance: Bootstrap | null = null;

/**
 * Type guard for logger module exports.
 * @param moduleExports - Module exports to check.
 * @returns True if exports contains service property.
 */
const hasLoggerService = (moduleExports: unknown): moduleExports is { service: Console } => {
  return typeof moduleExports === 'object' && moduleExports !== null && 'service' in moduleExports;
};

/**
 * Gets the logger service from the bootstrap modules.
 * @param modules - Map of loaded modules.
 * @returns Logger service or console fallback.
 */
const getLoggerService = (modules: Map<string, unknown>): Console => {
  const loggerModule = modules.get('logger');

  if (
    typeof loggerModule === 'object'
    && loggerModule !== null
    && 'exports' in loggerModule
    && hasLoggerService(loggerModule.exports)
  ) {
    return loggerModule.exports.service;
  }

  return console;
};

/**
 * Initializes tunnel status from environment variables.
 * @param logger - Logger service instance.
 */
const initializeTunnelStatus = (logger: Console): void => {
  const { env } = process;
  const { BASE_URL: baseUrl } = env;
  const BASE_URL_EMPTY = 0;

  if (typeof baseUrl === 'string' && baseUrl.length > BASE_URL_EMPTY) {
    tunnelStatus.setBaseUrl(baseUrl);
    logger.info(`Initialized tunnel status with BASE_URL: ${baseUrl}`);
  }
};

/**
 * Handles graceful shutdown of the application.
 * @param server - HTTP server instance.
 * @param logger - Logger service instance.
 */
const handleShutdown = async (server: Server, logger: Console): Promise<void> => {
  logger.info('📢 Shutdown signal received...');

  await new Promise<void>((resolve): void => {
    server.close((): void => {
      logger.info('✓ HTTP server closed');
      resolve();
    });
  });

  if (bootstrapInstance !== null) {
    await bootstrapInstance.shutdown();
  }

  logger.info('👋 SystemPrompt OS shutdown complete');
  process.exit(EXIT_SUCCESS);
};

/**
 * Logs startup summary information.
 * @param logger - Logger service instance.
 * @param bootstrap - Bootstrap instance.
 */
const logStartupSummary = (logger: Console, bootstrap: Bootstrap): void => {
  logger.info('');
  logger.info('🎉 SystemPrompt OS Ready!');
  logger.info('📊 System Status:');
  logger.info(`  • Core Modules: ${String(bootstrap.getModules().size)} loaded`);
  logger.info(`  • Bootstrap Phase: ${bootstrap.getCurrentPhase()}`);
  logger.info('');
};

/**
 * Creates a shutdown handler.
 * @param server - HTTP server instance.
 * @param logger - Logger service instance.
 * @returns Shutdown handler function.
 */
const createShutdownHandler = (server: Server, logger: Console): (() => void) => {
  return (): void => {
    handleShutdown(server, logger).catch((error: unknown): void => {
      logger.error('Error during shutdown:', error);
      process.exit(EXIT_FAILURE);
    });
  };
};

/**
 * Main entry point function.
 */
const main = async (): Promise<void> => {
  try {
    console.log('🌟 SystemPrompt OS Starting...');

    bootstrapInstance = await runBootstrap();

    const logger = getLoggerService(bootstrapInstance.getModules());

    initializeTunnelStatus(logger);

    const server = await startServer();

    const shutdownHandler = createShutdownHandler(server, logger);

    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);

    logStartupSummary(logger, bootstrapInstance);
  } catch (error) {
    if (bootstrapInstance === null) {
      console.error('💥 Failed to start SystemPrompt OS:', error);
    } else {
      const logger = getLoggerService(bootstrapInstance.getModules());
      logger.error('💥 Failed to start SystemPrompt OS:', error);
    }
    process.exit(EXIT_FAILURE);
  }
};

main().catch((error: unknown): void => {
  console.error('💥 Unhandled error in main:', error);
  process.exit(EXIT_FAILURE);
});
