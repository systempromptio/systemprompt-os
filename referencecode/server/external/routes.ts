/**
 * @fileoverview Centralized route configuration
 * @module server/external/routes
 */

import type { Express } from 'express';
import { Router } from 'express';
import { createAuthMiddleware } from './middleware/auth.js';
import { setupOAuth2Routes } from './rest/oauth2/index.js';
import { HealthEndpoint } from './rest/health.js';
import { setupRoutes as setupSplashRoutes } from './rest/splash.js';
import { setupRoutes as setupAuthRoutes } from './rest/auth.js';
import { setupRoutes as setupConfigRoutes } from './rest/config.js';
import { setupRoutes as setupCallbackRoutes } from './rest/callback.js';
import { setupRoutes as setupUsersAPIRoutes } from './rest/api/users.js';
import { setupRoutes as setupDashboardRoutes } from './rest/dashboard.js';
import { setupRoutes as setupTerminalAPIRoutes } from './rest/api/terminal.js';
import type { Logger } from '@/modules/core/logger/index.js';

/**
 * Configure all application routes
 */
export function configureRoutes(app: Express): void {
  logger.info('Configuring application routes');

  // ===== PUBLIC ROUTES (No authentication required) =====
  const publicRouter = Router();

  // Health check endpoint
  const healthEndpoint = new HealthEndpoint();
  publicRouter.get('/health', async (req, res) => healthEndpoint.getHealth(req, res));

  // Splash page (landing page)
  setupSplashRoutes(publicRouter);

  // OAuth2 endpoints (authorization, token exchange)
  setupOAuth2Routes(publicRouter, process.env['BASE_URL'] || 'http://localhost:3000');

  // OAuth callbacks from providers
  setupCallbackRoutes(publicRouter);

  // Auth page (login/logout) - public but shows different content based on auth status
  setupAuthRoutes(publicRouter);

  // ===== PROTECTED WEB ROUTES (Authentication required, redirects to login) =====
  const webRouter = Router();
  webRouter.use(createAuthMiddleware({ redirectToLogin: true }));

  // Dashboard (home for authenticated users)
  setupDashboardRoutes(webRouter);

  // Configuration pages
  setupConfigRoutes(webRouter);

  // ===== PROTECTED API ROUTES (Authentication required, returns 401) =====
  const apiRouter = Router();
  apiRouter.use('/api', createAuthMiddleware({ redirectToLogin: false }));

  // User management API
  setupUsersAPIRoutes(apiRouter);

  // Terminal execution API
  setupTerminalAPIRoutes(apiRouter);

  // ===== ADMIN ROUTES (Admin role required) =====
  const adminRouter = Router();
  adminRouter.use(
    '/admin',
    createAuthMiddleware({
      redirectToLogin: true,
      requiredRoles: ['admin'],
    }),
  );

  // Admin routes would go here
  // setupAdminRoutes(adminRouter);

  // Apply all routers to the app
  app.use(publicRouter);
  app.use(webRouter);
  app.use(apiRouter);
  app.use(adminRouter);

  logger.info('Routes configured successfully');
}

/**
 * Get route summary for debugging
 */
export function getRouteSummary(
  app: Express,
): Array<{ path: string; methods: string[]; auth: string }> {
  const routes: Array<{ path: string; methods: string[]; auth: string }> = [];

  function extractRoutes(stack: any[], prefix = '', authType = 'public') {
    stack.forEach((layer: any) => {
      if (layer.route) {
        routes.push({
          path: prefix + layer.route.path,
          methods: Object.keys(layer.route.methods),
          auth: authType,
        });
      } else if (layer.name === 'router' && layer.handle.stack) {
        extractRoutes(
          layer.handle.stack,
          prefix + (layer.regexp.source.match(/\\\/([^\\]+)/) || ['', ''])[1],
          authType,
        );
      }
    });
  }

  extractRoutes(app._router.stack);
  return routes;
}
