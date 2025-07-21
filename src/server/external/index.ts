/**
 * @fileoverview External REST API configuration for SystemPrompt OS
 * @module server/external
 */

import type { Express } from 'express';
import { Router } from 'express';
import { setupOAuth2Routes } from './rest/oauth2/index.js';
import { CONFIG } from '../config.js';
import { logger } from '../../utils/logger.js';
import { HealthEndpoint } from './rest/health.js';
import { setupRoutes as setupSplashRoutes } from './rest/splash.js';
import { setupRoutes as setupAuthRoutes } from './rest/auth.js';
import { setupRoutes as setupConfigRoutes, setupPublicRoutes as setupPublicConfigRoutes } from './rest/config.js';
import { authMiddleware } from './middleware/auth.js';
import cookieParser from 'cookie-parser';

/**
 * Configures and initializes all external REST API endpoints
 * 
 * Sets up:
 * - OAuth2 authorization endpoints
 * - Public pages (splash, auth, config)
 * - Health check endpoint
 * - Authentication middleware
 * 
 * @param app Express application instance
 * @param router Express router instance
 */
export async function setupExternalEndpoints(app: Express, router: any): Promise<void> {
  logger.info('Setting up external REST endpoints');
  
  app.use(cookieParser());
  
  await setupOAuth2Routes(router, CONFIG.BASEURL);
  
  const healthEndpoint = new HealthEndpoint();
  router.get('/health', (req: any, res: any) => {
    healthEndpoint.getHealth(req, res);
  });
  
  setupSplashRoutes(router);
  setupAuthRoutes(router);
  setupPublicConfigRoutes(router);
  
  const protectedRouter = Router();
  protectedRouter.use(authMiddleware);
  setupConfigRoutes(protectedRouter);
  
  app.use(router);
  app.use(protectedRouter);
  
  if (process.env.NODE_ENV !== 'production') {
    logger.debug('External endpoints configured', {
      routes: router.stack
        .filter((r: any) => r.route)
        .map((r: any) => ({
          path: r.route?.path || 'unknown',
          methods: r.route ? Object.keys(r.route.methods || {}) : []
        }))
    });
  }
}