/**
 * Centralized route configuration module.
 * @file Centralized route configuration.
 * @module server/external/routes
 */

import {
 type Express, type Request, type Response, Router
} from 'express';
import { HTTP_STATUS } from '@/server/external/constants/http.constants';
import { createAuthMiddleware } from '@/server/external/middleware/auth';
import { setupOAuth2Routes } from '@/server/external/rest/oauth2/index';
import { HealthEndpoint } from '@/server/external/rest/health';
import { StatusEndpoint } from '@/server/external/rest/status';
import { setupRoutes as splashSetup } from '@/server/external/rest/splash';
import { setupRoutes as authSetup } from '@/server/external/rest/auth';
import { setupRoutes as configSetup } from '@/server/external/rest/config';
import { setupRoutes as callbackSetup } from '@/server/external/rest/callback';
import { setupRoutes as usersApiSetup } from '@/server/external/rest/api/users';
import { setupRoutes as dashboardSetup } from '@/server/external/rest/dashboard';
import { setupRoutes as terminalApiSetup } from '@/server/external/rest/api/terminal';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type {
  IExpressLayer,
  IRouteContext,
  IRouteInfo,
} from '@/server/external/types/routes.types';

/**
 * Logger instance.
 */
const logger = LoggerService.getInstance();

/**
 * Setup public routes that don't require authentication.
 * @param {Router} publicRouter - Express router for public routes.
 * @returns {void} Nothing.
 */
const setupPublicRoutes = (publicRouter: Router): void => {
  publicRouter.get('/debug', (req: Request, res: Response): void => {
    res.json({
 message: 'Debug route working',
timestamp: new Date().toISOString()
});
  });

  const healthEndpoint = new HealthEndpoint();
  const statusEndpoint = new StatusEndpoint();

  publicRouter.get('/health', (req: Request, res: Response): void => {
    try {
      healthEndpoint.getHealth(req, res);
    } catch (error: unknown) {
      logger.error(LogSource.SERVER, 'Health endpoint error', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'health',
        persistToDb: false
      });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
    }
  });

  publicRouter.get('/api/status', (req: Request, res: Response): void => {
    try {
      statusEndpoint.getStatus(req, res);
    } catch (error: unknown) {
      logger.error(LogSource.SERVER, 'Status endpoint error', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'status',
        persistToDb: false
      });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
    }
  });

  splashSetup(publicRouter);

  setupOAuth2Routes(publicRouter);

  callbackSetup(publicRouter);
  authSetup(publicRouter);
};

/**
 * Setup protected web routes that require authentication.
 * @param {Router} webRouter - Express router for web routes.
 * @returns {void} Nothing.
 */
const setupProtectedWebRoutes = (webRouter: Router): void => {
  const authMiddleware = createAuthMiddleware({ redirectToLogin: true });

  webRouter.use('/dashboard', authMiddleware);
  dashboardSetup(webRouter);

  webRouter.use('/config', authMiddleware);
  configSetup(webRouter);
};

/**
 * Setup protected API routes that require authentication.
 * @param {Router} apiRouter - Express router for API routes.
 * @returns {void} Nothing.
 */
const setupProtectedApiRoutes = (apiRouter: Router): void => {
  const apiAuthMiddleware = createAuthMiddleware({ redirectToLogin: false });

  apiRouter.use('/api/users', apiAuthMiddleware);
  apiRouter.use('/api/terminal', apiAuthMiddleware);

  usersApiSetup(apiRouter);
  terminalApiSetup(apiRouter);
};

/**
 * Setup admin routes that require admin role.
 * @param {Router} adminRouter - Express router for admin routes.
 * @returns {void} Nothing.
 */
const setupAdminRoutes = (adminRouter: Router): void => {
  const adminAuthMiddleware = createAuthMiddleware({
    redirectToLogin: true,
    requiredRoles: ['admin'],
  });

  adminRouter.use('/admin', adminAuthMiddleware);
};

/**
 * Configure all application routes.
 * @param {Express} app - Express application instance.
 * @returns {void} Nothing.
 */
export const configureRoutes = (app: Express): void => {
  logger.info(LogSource.SERVER, 'Configuring application routes', {
    category: 'routes',
    action: 'configure',
    persistToDb: false
  });

  const publicRouter = Router();
  const webRouter = Router();
  const apiRouter = Router();
  const adminRouter = Router();

  setupPublicRoutes(publicRouter);
  setupProtectedWebRoutes(webRouter);
  setupProtectedApiRoutes(apiRouter);
  setupAdminRoutes(adminRouter);

  app.use(publicRouter);
  app.use(webRouter);
  app.use(apiRouter);
  app.use(adminRouter);

  app.use((req: Request, res: Response, next: Function): void => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        timestamp: new Date().toISOString()
      });
    } else {
      next();
    }
  });

  app.use((req: Request, res: Response): void => {
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>404 - Not Found</title>
      </head>
      <body>
        <h1>404 - Not Found</h1>
        <p>The requested page does not exist.</p>
        <p><a href="/">Go to homepage</a></p>
      </body>
      </html>
    `);
  });

  logger.info(LogSource.SERVER, 'Routes configured successfully', {
    category: 'routes',
    action: 'configure',
    persistToDb: false
  });
};

/**
 * Process single layer in the stack.
 * @param {IExpressLayer} layer - Express layer to process.
 * @param {IRouteContext} context - Route extraction context.
 * @param {Function} extractFn - Extract routes function.
 * @returns {void} Nothing.
 */
const processLayer = (
  layer: IExpressLayer,
  context: IRouteContext,
  extractFn: (stack: IExpressLayer[], ctx: IRouteContext) => void,
): void => {
  if (layer.route !== undefined) {
    context.routes.push({
      path: context.prefix + layer.route.path,
      methods: Object.keys(layer.route.methods),
      auth: context.authType,
    });
  } else if (layer.name === 'router' && layer.handle.stack !== undefined) {
    const regexMatch = layer.regexp.source.match(/\\\/(?<route>[^\\]+)/u);
    const routePrefix = regexMatch?.groups?.route ?? '';
    extractFn(layer.handle.stack, {
      routes: context.routes,
      prefix: context.prefix + routePrefix,
      authType: context.authType,
    });
  }
};

/**
 * Extract routes from Express layer stack.
 * @param {IExpressLayer[]} stack - Express layer stack.
 * @param {IRouteContext} context - Route extraction context.
 * @returns {void} Nothing.
 */
const extractRoutes = (stack: IExpressLayer[], context: IRouteContext): void => {
  stack.forEach((layer: IExpressLayer): void => {
    processLayer(layer, context, extractRoutes);
  });
};

/**
 * Get route summary for debugging.
 * @param {Express} app - Express application instance.
 * @returns {IRouteInfo[]} Array of route information.
 */
export const getRouteSummary = (app: Express): IRouteInfo[] => {
  const routes: IRouteInfo[] = [];
  const expressApp = app as Express & { _router?: { stack: unknown[] } };

  if (expressApp._router && Array.isArray(expressApp._router.stack)) {
    const context: IRouteContext = {
      routes,
      prefix: '',
      authType: 'public',
    };
    extractRoutes(expressApp._router.stack as IExpressLayer[], context);
  }

  return routes;
};
