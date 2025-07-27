/**
 * @file External REST API configuration for SystemPrompt OS.
 * @module server/external
 */

import type { Express } from 'express';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';
import cookieParser from 'cookie-parser';

const logger = LoggerService.getInstance();

/**
 * Configures and initializes all external REST API endpoints.
 * Sets up:
 * - OAuth2 authorization endpoints
 * - Public pages (splash, auth, config)
 * - Health check endpoint
 * - Authentication middleware.
 * @param app - Express application instance.
 * @param router - Express router instance.
 */
export async function setupExternalEndpoints(app: Express): Promise<void> {
  logger.info(LogSource.SERVER, 'Setting up external REST endpoints');

  app.use(cookieParser());

  const { configureRoutes } = await import('./routes');
  configureRoutes(app);

  if (process.env.NODE_ENV !== 'production') {
    logger.debug(LogSource.SERVER, 'External endpoints configured', {
      category: 'routes',
      persistToDb: false,
    });
  }
}
