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
  NextFunction,
  Request
} from 'express';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/manual';
import cookieParser from 'cookie-parser';
import { securityHeaders } from '@/server/external/middleware/security';
import { sessionMiddleware } from '@/server/external/middleware/session';
import { configureRoutes } from '@/server/external/routes';
import { ServerAuthAdapter } from '@/server/services/auth-adapter.service';

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

  try {
    const authAdapter = ServerAuthAdapter.getInstance();
    authAdapter.initialize();
    logger.info(LogSource.SERVER, 'ServerAuthAdapter initialized successfully');
  } catch (error) {
    logger.error(LogSource.SERVER, 'Failed to initialize ServerAuthAdapter', {
      error: error instanceof Error ? error : new Error(String(error))
    });
  }

  app.use(securityHeaders);
  app.use(cookieParser());
  app.use(sessionMiddleware)

  app.get('/setup-test', (_req: Request, res: ExpressResponse) => {
    res.json({ message: 'Setup test route working' });
  });

  configureRoutes(app);

  app.use((err: unknown, _req: Request, res: ExpressResponse, next: NextFunction): void => {
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

  app.use((err: unknown, req: Request, res: ExpressResponse, next: NextFunction): void => {
    console.error('ERROR CAUGHT:', err);
    console.error('Stack:', err instanceof Error ? err.stack : 'No stack');

    logger.error(LogSource.SERVER, 'Unhandled error', {
      error: err instanceof Error ? err : new Error(String(err)),
      path: req.path,
      method: req.method,
      stack: err instanceof Error ? err.stack : undefined
    });

    if (res.headersSent) {
      next(err); return;
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.debug(LogSource.SERVER, 'External endpoints configured', {
      category: 'routes',
      persistToDb: false,
    });
  }
}
