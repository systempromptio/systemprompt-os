/**
 * External REST API configuration for SystemPrompt OS.
 * This module sets up and configures all external REST API endpoints including
 * OAuth2 authorization, public pages, health checks, and authentication middleware.
 * @file External REST API configuration for SystemPrompt OS.
 * @module server/external
 */

import type {
  Express,
  Response as ExpressResponse,
  NextFunction
} from 'express';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';
import cookieParser from 'cookie-parser';
import { securityHeaders } from '@/server/external/middleware/security';
import { configureRoutes } from '@/server/external/routes';

const logger = LoggerService.getInstance();

/**
 * Configures and initializes all external REST API endpoints.
 * Sets up:
 * - OAuth2 authorization endpoints
 * - Public pages (splash, auth, config)
 * - Health check endpoint
 * - Authentication middleware.
 * @param app - Express application instance.
 */
export const setupExternalEndpoints = (app: Express): void => {
  logger.info(LogSource.SERVER, 'Setting up external REST endpoints');

  app.use(securityHeaders);
  app.use(cookieParser());

  app.use((err: unknown, res: ExpressResponse, next: NextFunction): void => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid JSON in request body',
        timestamp: new Date().toISOString()
      });
      return;
    }
    next(err);
  });

  configureRoutes(app);

  if (process.env.NODE_ENV !== 'production') {
    logger.debug(LogSource.SERVER, 'External endpoints configured', {
      category: 'routes',
      persistToDb: false,
    });
  }
}
