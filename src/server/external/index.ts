/**
 * @fileoverview External REST API configuration for SystemPrompt OS
 * @module server/external
 */

import type { Express } from 'express';
import { logger } from '../../utils/logger.js';
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
export async function setupExternalEndpoints(app: Express): Promise<void> {
  logger.info('Setting up external REST endpoints');
  
  app.use(cookieParser());
  
  // Use the new centralized route configuration
  const { configureRoutes, getRouteSummary } = await import('./routes.js');
  configureRoutes(app);
  
  if (process.env.NODE_ENV !== 'production') {
    logger.debug('External endpoints configured', {
      routes: getRouteSummary(app)
    });
  }
}