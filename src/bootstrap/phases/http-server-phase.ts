/**
 * HTTP server phase for bootstrap process.
 * Handles setup and initialization of Express HTTP server infrastructure.
 * @module bootstrap/phases/http-server
 */

import type { Express } from 'express';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { setupMcpServers } from '@/server/mcp/index';
import { loadExpressApp } from '@/bootstrap/express-loader';
import type { HttpServerPhaseContext } from '@/types/bootstrap';

/**
 * Execute the HTTP server phase of bootstrap.
 * Sets up Express app and HTTP server infrastructure.
 * @param context - The phase context containing logger and optional mcpApp.
 * @returns Promise resolving to the Express application instance.
 */
export const executeHttpServerPhase = async (
  context: HttpServerPhaseContext
): Promise<Express> => {
  const logger = LoggerService.getInstance();

  logger.debug(LogSource.BOOTSTRAP, 'Setting up HTTP server', {
    category: 'http',
    persistToDb: false
  });

  try {
    const mcpApp = context.mcpApp ?? loadExpressApp();

    await setupMcpServers(mcpApp);

    logger.debug(LogSource.BOOTSTRAP, 'HTTP server initialized', {
      category: 'http',
      persistToDb: false
    });

    return mcpApp;
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, 'Failed to setup HTTP server', {
      category: 'http',
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
};
