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
import { tunnelStatus } from './modules/core/auth/tunnel-status';
import { EXIT_FAILURE, EXIT_SUCCESS } from './constants/process.constants';
import { type ILogger, LogSource } from './modules/core/logger/types/index';

/**
 * Bootstrap instance for shutdown handling.
 */
let bootstrapInstance: Bootstrap | null = null;

/**
 * Type guard for logger module exports.
 * @param moduleExports - Module exports to check.
 * @returns True if exports contains service property.
 */
const hasLoggerService = (
  moduleExports: unknown
): moduleExports is { service: ILogger | (() => ILogger) } => {
  return typeof moduleExports === 'object' && moduleExports !== null && 'service' in moduleExports;
};

/**
 * Console fallback logger that implements ILogger interface.
 */
const consoleFallback: ILogger = {
  debug: (source: LogSource, message: string, args?: unknown): void => {
    void source;
    void args;
    console.debug(message);
  },
  info: (source: LogSource, message: string, args?: unknown): void => {
    void source;
    void args;
    console.info(message);
  },
  warn: (source: LogSource, message: string, args?: unknown): void => {
    void source;
    void args;
    console.warn(message);
  },
  error: (source: LogSource, message: string, args?: unknown): void => {
    void source;
    void args;
    console.error(message);
  },
  log: (level: string, source: LogSource, message: string): void => {
    void level;
    void source;
    console.log(message);
  },
  access: (message: string): void => { console.log(message); },
  clearLogs: async (): Promise<void> => {
  },
  getLogs: async (): Promise<string[]> => {
    return await Promise.resolve([]);
  }
};

/**
 * Gets the logger service from the bootstrap modules.
 * @param modules - Map of loaded modules.
 * @returns Logger service or console fallback.
 */
const getLoggerService = (modules: Map<string, unknown>): ILogger => {
  const loggerModule = modules.get('logger');

  if (
    typeof loggerModule === 'object'
    && loggerModule !== null
    && 'exports' in loggerModule
    && hasLoggerService(loggerModule.exports)
  ) {
    const {service} = loggerModule.exports;
    return typeof service === 'function' ? service() : service;
  }

  return consoleFallback;
};

/**
 * Initializes tunnel status from environment variables.
 * @param logger - Logger service instance.
 */
const initializeTunnelStatus = (logger: ILogger): void => {
  const { env } = process;
  const { BASE_URL: baseUrl } = env;
  const BASE_URL_EMPTY = 0;

  if (typeof baseUrl === 'string' && baseUrl.length > BASE_URL_EMPTY) {
    tunnelStatus.setBaseUrl(baseUrl);
    logger.info(LogSource.BOOTSTRAP, `Initialized tunnel status with BASE_URL: ${baseUrl}`);
  }
};

/**
 * Handles graceful shutdown of the application.
 * @param server - HTTP server instance.
 * @param logger - Logger service instance.
 */
const handleShutdown = async (server: Server, logger: ILogger): Promise<void> => {
  logger.info(LogSource.BOOTSTRAP, '📢 Shutdown signal received...');

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
    const logger = getLoggerService(bootstrapInstance.getModules());
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

    const logger = getLoggerService(bootstrapInstance.getModules());

    initializeTunnelStatus(logger);

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
